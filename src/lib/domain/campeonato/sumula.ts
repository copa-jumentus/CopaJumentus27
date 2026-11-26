// Regras de lançamento da súmula, compartilhadas pela súmula completa
// (/admin/partidas/[id]) e pelo Modo Mesário. Antes viviam nas server actions;
// vieram para o domínio para ficarem testadas e para o mesário reaproveitar.
// Puro: muda o documento do campeonato recebido (dentro de atualizarCampeonato).

import { normalizarProgramacao, programacaoPadrao } from './programacao';
import { aplicarComando, type ComandoRelogio, ErroDoJogo, RELOGIO_INICIAL } from './relogio';
import { ehGol, TIPOS_EVENTO, type Campeonato, type Partida, type StatusPartida, type TipoEvento } from './tipos';

export const NOME_EVENTO: Record<TipoEvento, string> = {
  gol: 'Gol',
  gol_penalti: 'Gol de pênalti',
  'gol-contra': 'Gol contra',
  penalti_perdido: 'Pênalti perdido',
  amarelo: 'Amarelo',
  vermelho: 'Vermelho',
  defesa: 'Defesa',
};

export function acharPartida(c: Campeonato, id: string): Partida {
  const p = c.partidas.find((x) => x.id === id);
  if (!p) throw new ErroDoJogo('Partida não encontrada.');
  return p;
}

/** Lado do placar que um evento altera, dado o lado de quem fez (gol contra soma para o outro). */
export function ladoQueMarca(tipo: TipoEvento, ladoDoJogador: 'mandante' | 'visitante'): 'mandante' | 'visitante' | null {
  if (!ehGol(tipo)) return null;
  if (tipo !== 'gol-contra') return ladoDoJogador;
  return ladoDoJogador === 'mandante' ? 'visitante' : 'mandante';
}

/** Lado do placar que um evento de gol altera. */
export function ladoDoGol(p: Pick<Partida, 'mandanteId'>, tipo: TipoEvento, equipeId: string): 'mandante' | 'visitante' | null {
  return ladoQueMarca(tipo, equipeId === p.mandanteId ? 'mandante' : 'visitante');
}

/**
 * Cartão que não pode entrar (decisão do operador em 25/11/2026: "está dando pra
 * colocar vários cartões pro mesmo cara"): quem levou vermelho já saiu do jogo e
 * não recebe mais cartão; ninguém tem mais de dois amarelos no mesmo jogo.
 * Devolve a mensagem do erro, ou null quando o cartão pode entrar.
 */
export function problemaDoCartao(p: Pick<Partida, 'eventos'>, jogadorId: string, tipo: TipoEvento, nome: string): string | null {
  if (tipo !== 'amarelo' && tipo !== 'vermelho') return null;
  const dele = p.eventos.filter((e) => e.jogadorId === jogadorId);
  if (dele.some((e) => e.tipo === 'vermelho')) return `${nome} já levou vermelho neste jogo e não recebe outro cartão.`;
  if (tipo === 'amarelo' && dele.filter((e) => e.tipo === 'amarelo').length >= 2) return `${nome} já tem dois amarelos neste jogo.`;
  return null;
}

export interface DadosEvento {
  /** Id do evento. O mesário manda o seu (gerado no celular): repetir o mesmo id não lança de novo. */
  id: string;
  tipo: string;
  jogadorId: string;
  assistenciaId?: string;
  minuto?: number;
}

/** Lança um evento; devolve a mensagem de confirmação ("Gol · Digão. Placar 1:0."). */
export function lancarEvento(c: Campeonato, partidaId: string, d: DadosEvento): string {
  const p = acharPartida(c, partidaId);
  const ja = p.eventos.find((e) => e.id === d.id);
  if (ja) return `Já registrado. Placar ${p.golsMandante}:${p.golsVisitante}.`;

  const tipo = TIPOS_EVENTO.find((t) => t === d.tipo);
  if (!tipo) throw new ErroDoJogo('Tipo de evento inválido.');
  if (!p.mandanteId || !p.visitanteId) throw new ErroDoJogo('Esta partida ainda não tem os dois participantes definidos.');
  if (p.status === 'encerrada') throw new ErroDoJogo('Esta partida já foi encerrada. Para corrigir, use a súmula completa.');
  const jogador = c.jogadores.find((j) => j.id === d.jogadorId);
  if (!jogador) throw new ErroDoJogo('Escolha o jogador.');
  if (jogador.equipeId !== p.mandanteId && jogador.equipeId !== p.visitanteId) {
    throw new ErroDoJogo('Esse jogador não é de nenhuma das duas equipes.');
  }
  if (tipo === 'defesa') {
    const goleiro = jogador.equipeId === p.mandanteId ? p.goleiroMandanteId : p.goleiroVisitanteId;
    if (goleiro && goleiro !== jogador.id) throw new ErroDoJogo('Defesa é do goleiro registrado nesta partida.');
  }
  const cartao = problemaDoCartao(p, jogador.id, tipo, jogador.nome);
  if (cartao) throw new ErroDoJogo(cartao);
  const assistente = c.jogadores.find((j) => j.id === d.assistenciaId);
  p.eventos.push({
    id: d.id,
    tipo,
    jogadorId: jogador.id,
    equipeId: jogador.equipeId,
    assistenciaId: tipo === 'gol' && assistente && assistente.id !== jogador.id && assistente.equipeId === jogador.equipeId ? assistente.id : undefined,
    minuto: d.minuto && d.minuto > 0 ? Math.trunc(d.minuto) : undefined,
  });
  const lado = ladoDoGol(p, tipo, jogador.equipeId);
  if (lado === 'mandante') p.golsMandante += 1;
  if (lado === 'visitante') p.golsVisitante += 1;
  if (p.status === 'agendada') p.status = 'ao-vivo';
  return `${NOME_EVENTO[tipo]} · ${jogador.nome}. Placar ${p.golsMandante}:${p.golsVisitante}.`;
}

/** Apaga um evento e desconta o gol. Evento que já não existe: nada a fazer. */
export function apagarEvento(c: Campeonato, partidaId: string, eventoId: string): void {
  const p = acharPartida(c, partidaId);
  const ev = p.eventos.find((e) => e.id === eventoId);
  if (!ev) return;
  p.eventos = p.eventos.filter((e) => e.id !== ev.id);
  const lado = ladoDoGol(p, ev.tipo, ev.equipeId);
  if (lado === 'mandante') p.golsMandante = Math.max(0, p.golsMandante - 1);
  if (lado === 'visitante') p.golsVisitante = Math.max(0, p.golsVisitante - 1);
}

/** Duração de cada tempo da partida, pela programação (grupos 8, mata-mata 10 por padrão). */
export function duracaoDoTempo(c: Campeonato, p: Partida): number {
  const prog = normalizarProgramacao(c.programacao) ?? programacaoPadrao(undefined, undefined, 2);
  return c.fases.find((f) => f.id === p.faseId)?.tipo === 'mata-mata' ? prog.tempoMataMataMin : prog.tempoGrupoMin;
}

/** Comando do cronômetro; começar o 1º tempo põe a partida ao vivo. */
export function comandarRelogio(c: Campeonato, partidaId: string, comando: ComandoRelogio, em: number): void {
  const p = acharPartida(c, partidaId);
  if (!p.mandanteId || !p.visitanteId) throw new ErroDoJogo('Esta partida ainda não tem os dois participantes definidos.');
  if (p.status === 'encerrada' && comando.acao !== 'fim') throw new ErroDoJogo('Esta partida já foi encerrada.');
  p.relogio = aplicarComando(p.relogio ?? RELOGIO_INICIAL, comando, em);
  if (p.status === 'agendada') p.status = 'ao-vivo';
}

export function mudarStatus(c: Campeonato, partidaId: string, status: StatusPartida): void {
  acharPartida(c, partidaId).status = status;
}

/**
 * Placar da disputa de pênaltis (valores absolutos, então reenviar é seguro).
 * Só no mata-mata, com empate no tempo normal e o jogo ainda aberto.
 */
export function definirPenaltis(c: Campeonato, partidaId: string, mandante: number, visitante: number): void {
  const p = acharPartida(c, partidaId);
  if (p.status === 'encerrada') throw new ErroDoJogo('Esta partida já foi encerrada. Para corrigir, use a súmula completa.');
  if (c.fases.find((f) => f.id === p.faseId)?.tipo !== 'mata-mata') throw new ErroDoJogo('Pênaltis só existem no mata-mata.');
  if (p.golsMandante !== p.golsVisitante) throw new ErroDoJogo('Pênaltis só com empate no tempo normal.');
  const valido = (n: number) => Number.isInteger(n) && n >= 0 && n <= 50;
  if (!valido(mandante) || !valido(visitante)) throw new ErroDoJogo('Placar de pênaltis inválido.');
  p.penaltisMandante = mandante;
  p.penaltisVisitante = visitante;
}
