// Cronômetro da partida para o Modo Mesário (pedido do operador em 21/11/2026).
// Guardado na partida (partida.relogio) e calculado a partir de instantes (ms), para
// que o mesário, o telão e quem abrir a súmula vejam o mesmo tempo. Puro e testado.
//
// Os comandos dizem o estado desejado de um tempo ("começar o 1º tempo", "fim do
// 2º tempo"), não um botão de liga/desliga: repetir um comando já aplicado não muda
// nada. É isso que deixa a fila offline reenviar sem estragar o relógio.

/** Erro de regra do jogo (súmula ou cronômetro): vai para a tela do admin, nunca é reenviado. */
export class ErroDoJogo extends Error {}

export type FaseRelogio = 'antes' | 'tempo1' | 'intervalo' | 'tempo2' | 'fim';

export interface Relogio {
  fase: FaseRelogio;
  /** Instante em que o trecho atual começou a correr; ausente com o tempo pausado. */
  correndoDesde?: number;
  /** Milissegundos já corridos no tempo atual antes do trecho em andamento. */
  acumuladoMs: number;
  /** Instante em que o intervalo começou. */
  intervaloDesde?: number;
  /** Tempo corrido no 1º tempo (com acréscimo), guardado ao fim dele. */
  primeiroTempoMs?: number;
}

export type AcaoRelogio = 'iniciar' | 'pausar' | 'retomar' | 'fim';

export interface ComandoRelogio {
  acao: AcaoRelogio;
  tempo: 1 | 2;
}

export const RELOGIO_INICIAL: Relogio = { fase: 'antes', acumuladoMs: 0 };

const ORDEM: Record<FaseRelogio, number> = { antes: 0, tempo1: 1, intervalo: 2, tempo2: 3, fim: 4 };

function corrido(r: Relogio, agora: number): number {
  return r.acumuladoMs + (r.correndoDesde !== undefined ? Math.max(0, agora - r.correndoDesde) : 0);
}

/**
 * Aplica um comando no instante `em`. Comando de um tempo que já passou, ou já
 * aplicado, devolve o relógio como está (idempotente). Comando fora de ordem
 * (começar o 2º sem ter fechado o 1º) é erro.
 */
export function aplicarComando(r: Relogio, { acao, tempo }: ComandoRelogio, em: number): Relogio {
  const fase: FaseRelogio = tempo === 1 ? 'tempo1' : 'tempo2';
  const antesDoTempo: FaseRelogio = tempo === 1 ? 'antes' : 'intervalo';
  const depoisDoTempo: FaseRelogio = tempo === 1 ? 'intervalo' : 'fim';

  if (acao === 'iniciar') {
    if (ORDEM[r.fase] >= ORDEM[fase]) return r;
    if (r.fase !== antesDoTempo) throw new ErroDoJogo(tempo === 2 ? 'Feche o 1º tempo antes de começar o 2º.' : 'O jogo já começou.');
    return { ...r, fase, correndoDesde: em, acumuladoMs: 0, intervaloDesde: undefined };
  }

  if (ORDEM[r.fase] > ORDEM[fase]) return r; // o tempo já acabou: nada a fazer
  if (r.fase !== fase) throw new ErroDoJogo(`O ${tempo}º tempo ainda não começou.`);

  if (acao === 'pausar') {
    if (r.correndoDesde === undefined) return r;
    return { ...r, acumuladoMs: corrido(r, em), correndoDesde: undefined };
  }
  if (acao === 'retomar') {
    if (r.correndoDesde !== undefined) return r;
    return { ...r, correndoDesde: em };
  }
  // fim do tempo
  const total = corrido(r, em);
  return {
    fase: depoisDoTempo,
    acumuladoMs: total,
    correndoDesde: undefined,
    intervaloDesde: tempo === 1 ? em : undefined,
    primeiroTempoMs: tempo === 1 ? total : r.primeiroTempoMs,
  };
}

export interface LeituraRelogio {
  fase: FaseRelogio;
  tempo?: 1 | 2;
  correndo: boolean;
  /** Tempo corrido no tempo atual (ou no último, no intervalo e no fim). */
  decorridoMs: number;
  /** Passou da duração do tempo: o que está em acréscimo. */
  acrescimoMs: number;
  /** Minuto de jogo para a súmula (1º tempo 1..d, 2º tempo d+1..2d); ausente antes do jogo. */
  minuto?: number;
  /** "07:42" do tempo atual; no acréscimo, "08:00". */
  mostrador: string;
  /** No intervalo, quanto tempo de intervalo já passou. */
  intervaloMs?: number;
}

export function formatarMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Lê o relógio no instante `agora`, para uma partida com tempos de `duracaoMin`. */
export function lerRelogio(r: Relogio | undefined, agora: number, duracaoMin: number): LeituraRelogio {
  const rel = r ?? RELOGIO_INICIAL;
  const duracaoMs = duracaoMin * 60_000;
  const tempo: 1 | 2 | undefined =
    rel.fase === 'tempo1' || rel.fase === 'intervalo' ? 1 : rel.fase === 'tempo2' || rel.fase === 'fim' ? 2 : undefined;
  const decorridoMs = rel.fase === 'antes' ? 0 : corrido(rel, agora);
  const noTempo = Math.min(decorridoMs, duracaoMs);
  const minutoNoTempo = rel.fase === 'antes' ? undefined : Math.min(duracaoMin, Math.floor(decorridoMs / 60_000) + 1);
  return {
    fase: rel.fase,
    tempo,
    correndo: rel.correndoDesde !== undefined,
    decorridoMs,
    acrescimoMs: Math.max(0, decorridoMs - duracaoMs),
    minuto: minutoNoTempo === undefined ? undefined : minutoNoTempo + (tempo === 2 ? duracaoMin : 0),
    mostrador: formatarMs(noTempo),
    intervaloMs: rel.fase === 'intervalo' && rel.intervaloDesde !== undefined ? Math.max(0, agora - rel.intervaloDesde) : undefined,
  };
}

/** Texto curto da fase, para o mesário e o telão. */
export function rotuloFase(l: LeituraRelogio): string {
  switch (l.fase) {
    case 'antes':
      return 'Antes do jogo';
    case 'tempo1':
      return l.correndo ? '1º tempo' : '1º tempo · pausado';
    case 'intervalo':
      return 'Intervalo';
    case 'tempo2':
      return l.correndo ? '2º tempo' : '2º tempo · pausado';
    case 'fim':
      return 'Fim de jogo';
  }
}
