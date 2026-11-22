// Modo Mesário (pedido do operador em 21/11/2026): operações que a tela da beira do
// campo manda ao servidor, uma por vez, por uma fila que sobrevive à queda da
// internet. Cada operação tem id próprio e é idempotente: reenviar não duplica
// gol nem bagunça o cronômetro. Puro e testado.

import { lerRelogio, type AcaoRelogio, type LeituraRelogio, type Relogio, aplicarComando, RELOGIO_INICIAL } from './relogio';
import { acharPartida, apagarEvento, comandarRelogio, definirPenaltis, duracaoDoTempo, ladoQueMarca, lancarEvento, mudarStatus, NOME_EVENTO } from './sumula';
import type { Campeonato, StatusPartida, TipoEvento } from './tipos';

interface OperacaoBase {
  /** Id da operação, gerado no celular. Num lançamento, vira o id do evento. */
  id: string;
  partidaId: string;
  /** Quando o mesário tocou (relógio do celular corrigido pelo do servidor). */
  em: number;
}

export type OperacaoMesario =
  | (OperacaoBase & { tipo: 'evento'; evento: { tipo: TipoEvento; jogadorId: string; assistenciaId?: string; minuto?: number } })
  | (OperacaoBase & { tipo: 'apagar'; eventoId: string })
  | (OperacaoBase & { tipo: 'relogio'; acao: AcaoRelogio; tempo: 1 | 2 })
  | (OperacaoBase & { tipo: 'status'; status: Extract<StatusPartida, 'ao-vivo' | 'encerrada'> })
  /** Placar absoluto da disputa de pênaltis (mata-mata empatado). */
  | (OperacaoBase & { tipo: 'penaltis'; mandante: number; visitante: number });

/** Até onde o servidor aceita o instante informado pelo celular. */
const TOLERANCIA_FUTURO_MS = 5_000;

/**
 * Aplica uma operação no campeonato (dentro de atualizarCampeonato). O instante do
 * cronômetro vem do celular, porque a fila pode chegar minutos depois do toque;
 * nunca no futuro do servidor.
 */
export function aplicarOperacao(c: Campeonato, op: OperacaoMesario, agoraServidor: number): string {
  const em = Math.min(op.em, agoraServidor + TOLERANCIA_FUTURO_MS);
  switch (op.tipo) {
    case 'evento':
      return lancarEvento(c, op.partidaId, { id: op.id, ...op.evento });
    case 'apagar':
      apagarEvento(c, op.partidaId, op.eventoId);
      return 'Lance apagado.';
    case 'relogio':
      comandarRelogio(c, op.partidaId, { acao: op.acao, tempo: op.tempo }, em);
      return 'Cronômetro atualizado.';
    case 'status':
      mudarStatus(c, op.partidaId, op.status);
      return op.status === 'encerrada' ? 'Jogo encerrado.' : 'Jogo ao vivo.';
    case 'penaltis':
      definirPenaltis(c, op.partidaId, op.mandante, op.visitante);
      return `Pênaltis ${op.mandante}:${op.visitante}.`;
  }
}

export interface LanceMesario {
  id: string;
  tipo: TipoEvento;
  rotulo: string;
  jogador: string;
  assistente?: string;
  lado: 'mandante' | 'visitante';
  minuto?: number;
  /** Ainda na fila do celular, não confirmado pelo servidor. */
  pendente?: boolean;
}

/** O que a tela do mesário e o telão precisam de uma partida. Sem estrelas, sem dados de pagamento. */
export interface EstadoMesario {
  partidaId: string;
  status: StatusPartida;
  golsMandante: number;
  golsVisitante: number;
  penaltisMandante?: number;
  penaltisVisitante?: number;
  relogio: Relogio;
  duracaoMin: number;
  lances: LanceMesario[];
  /** Relógio do servidor no momento da leitura, para o celular corrigir o seu. */
  agoraServidor: number;
}

export function estadoMesario(c: Campeonato, partidaId: string, agoraServidor: number): EstadoMesario {
  const p = acharPartida(c, partidaId);
  const nome = new Map(c.jogadores.map((j) => [j.id, j.nome]));
  const ladoDe = (equipeId: string): 'mandante' | 'visitante' => (equipeId === p.mandanteId ? 'mandante' : 'visitante');
  return {
    partidaId: p.id,
    status: p.status,
    golsMandante: p.golsMandante,
    golsVisitante: p.golsVisitante,
    penaltisMandante: p.penaltisMandante,
    penaltisVisitante: p.penaltisVisitante,
    relogio: p.relogio ?? RELOGIO_INICIAL,
    duracaoMin: duracaoDoTempo(c, p),
    lances: p.eventos
      .map((e) => ({
        id: e.id,
        tipo: e.tipo,
        rotulo: NOME_EVENTO[e.tipo],
        jogador: nome.get(e.jogadorId) ?? '—',
        assistente: e.assistenciaId ? nome.get(e.assistenciaId) : undefined,
        lado: ladoDe(e.equipeId),
        minuto: e.minuto,
      }))
      .reverse(),
    agoraServidor,
  };
}

/** Jogadores da partida que a tela conhece, para montar os lances pendentes. */
export interface JogadorDaPartida {
  id: string;
  nome: string;
  lado: 'mandante' | 'visitante';
}

/**
 * Estado que a tela mostra: o último confirmado pelo servidor mais o que ainda está
 * na fila do celular (lances marcados como pendentes, gols já no placar, cronômetro
 * já com os toques). Operação que daria erro é ignorada aqui; o erro aparece quando
 * o servidor responder.
 */
export function comPendentes(base: EstadoMesario, fila: readonly OperacaoMesario[], jogadores: readonly JogadorDaPartida[]): EstadoMesario {
  const porId = new Map(jogadores.map((j) => [j.id, j]));
  let estado: EstadoMesario = { ...base, lances: [...base.lances] };
  for (const op of fila) {
    if (op.partidaId !== base.partidaId) continue;
    if (op.tipo === 'evento') {
      if (estado.lances.some((l) => l.id === op.id)) continue;
      const j = porId.get(op.evento.jogadorId);
      if (!j) continue;
      const lado = ladoQueMarca(op.evento.tipo, j.lado);
      estado = {
        ...estado,
        golsMandante: estado.golsMandante + (lado === 'mandante' ? 1 : 0),
        golsVisitante: estado.golsVisitante + (lado === 'visitante' ? 1 : 0),
        status: estado.status === 'agendada' ? 'ao-vivo' : estado.status,
        lances: [
          {
            id: op.id,
            tipo: op.evento.tipo,
            rotulo: NOME_EVENTO[op.evento.tipo],
            jogador: j.nome,
            assistente: op.evento.assistenciaId ? porId.get(op.evento.assistenciaId)?.nome : undefined,
            lado: j.lado,
            minuto: op.evento.minuto,
            pendente: true,
          },
          ...estado.lances,
        ],
      };
    } else if (op.tipo === 'apagar') {
      const lance = estado.lances.find((l) => l.id === op.eventoId);
      if (!lance) continue;
      const lado = ladoQueMarca(lance.tipo, lance.lado);
      estado = {
        ...estado,
        golsMandante: Math.max(0, estado.golsMandante - (lado === 'mandante' ? 1 : 0)),
        golsVisitante: Math.max(0, estado.golsVisitante - (lado === 'visitante' ? 1 : 0)),
        lances: estado.lances.filter((l) => l.id !== op.eventoId),
      };
    } else if (op.tipo === 'relogio') {
      try {
        estado = {
          ...estado,
          relogio: aplicarComando(estado.relogio, { acao: op.acao, tempo: op.tempo }, op.em),
          status: estado.status === 'agendada' ? 'ao-vivo' : estado.status,
        };
      } catch {
        // fora de ordem: o servidor vai recusar e a tela mostra o erro
      }
    } else if (op.tipo === 'penaltis') {
      estado = { ...estado, penaltisMandante: op.mandante, penaltisVisitante: op.visitante };
    } else {
      estado = { ...estado, status: op.status };
    }
  }
  return estado;
}

/** Leitura do cronômetro de um estado, no instante corrigido pelo relógio do servidor. */
export function lerCronometro(e: Pick<EstadoMesario, 'relogio' | 'duracaoMin'>, agora: number): LeituraRelogio {
  return lerRelogio(e.relogio, agora, e.duracaoMin);
}

// ---------- leitura segura do que chega do celular ----------

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
const textoCurto = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 && x.length <= 64 ? x : undefined);
const TIPOS: readonly TipoEvento[] = ['gol', 'gol_penalti', 'gol-contra', 'penalti_perdido', 'amarelo', 'vermelho', 'defesa'];
const ACOES: readonly AcaoRelogio[] = ['iniciar', 'pausar', 'retomar', 'fim'];

/** Valida uma operação recebida pela server action (entrada não confiável). Null se inválida. */
export function lerOperacao(x: unknown): OperacaoMesario | null {
  if (!ehObjeto(x)) return null;
  const id = textoCurto(x.id);
  const partidaId = textoCurto(x.partidaId);
  const em = typeof x.em === 'number' && Number.isFinite(x.em) ? x.em : undefined;
  if (!id || !partidaId || em === undefined) return null;
  const base = { id, partidaId, em };
  if (x.tipo === 'evento' && ehObjeto(x.evento)) {
    const ev = x.evento;
    const tipo = TIPOS.find((t) => t === ev.tipo);
    const jogadorId = textoCurto(ev.jogadorId);
    if (!tipo || !jogadorId) return null;
    const minuto = typeof ev.minuto === 'number' && Number.isFinite(ev.minuto) ? ev.minuto : undefined;
    return { ...base, tipo: 'evento', evento: { tipo, jogadorId, assistenciaId: textoCurto(ev.assistenciaId), minuto } };
  }
  if (x.tipo === 'apagar') {
    const eventoId = textoCurto(x.eventoId);
    return eventoId ? { ...base, tipo: 'apagar', eventoId } : null;
  }
  if (x.tipo === 'relogio') {
    const acao = ACOES.find((a) => a === x.acao);
    const tempo = x.tempo === 1 ? 1 : x.tempo === 2 ? 2 : undefined;
    return acao && tempo ? { ...base, tipo: 'relogio', acao, tempo } : null;
  }
  if (x.tipo === 'status' && (x.status === 'ao-vivo' || x.status === 'encerrada')) {
    return { ...base, tipo: 'status', status: x.status };
  }
  if (x.tipo === 'penaltis') {
    const placar = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 50 ? n : undefined);
    const mandante = placar(x.mandante);
    const visitante = placar(x.visitante);
    return mandante !== undefined && visitante !== undefined ? { ...base, tipo: 'penaltis', mandante, visitante } : null;
  }
  return null;
}

type SemBase<T> = T extends unknown ? Omit<T, 'id' | 'partidaId' | 'em'> : never;
/** O que a tela pede (sem id, partida e instante, que a fila completa). */
export type PedidoMesario = SemBase<OperacaoMesario>;

export function completarOperacao(p: PedidoMesario, id: string, partidaId: string, em: number): OperacaoMesario {
  const base = { id, partidaId, em };
  switch (p.tipo) {
    case 'evento':
      return { ...base, tipo: 'evento', evento: p.evento };
    case 'apagar':
      return { ...base, tipo: 'apagar', eventoId: p.eventoId };
    case 'relogio':
      return { ...base, tipo: 'relogio', acao: p.acao, tempo: p.tempo };
    case 'status':
      return { ...base, tipo: 'status', status: p.status };
    case 'penaltis':
      return { ...base, tipo: 'penaltis', mandante: p.mandante, visitante: p.visitante };
  }
}

/** Mata-mata empatado no tempo normal ainda sem vencedor nos pênaltis: não pode encerrar. */
export function faltaDecidirPenaltis(e: Pick<EstadoMesario, 'golsMandante' | 'golsVisitante' | 'penaltisMandante' | 'penaltisVisitante'>, mataMata: boolean): boolean {
  if (!mataMata || e.golsMandante !== e.golsVisitante) return false;
  return (e.penaltisMandante ?? 0) === (e.penaltisVisitante ?? 0);
}
