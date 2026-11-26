// Suspensões automáticas (CLAUDE.md §8.2):
// - 3 cartões amarelos acumulados = suspenso no jogo seguinte da equipe (a contagem zera);
// - cartão vermelho = suspenso no jogo seguinte da equipe;
// - segundo amarelo no mesmo jogo vira vermelho (sumula.ts); esses dois amarelos
//   não entram na contagem dos 3 acumulados: a expulsão já pune (operador, 26/11/2026).

import type { Partida } from './tipos';

export interface SituacaoDisciplinar {
  jogadorId: string;
  /** Amarelos acumulados desde a última suspensão por amarelo. */
  amarelos: number;
  /** Suspenso no próximo jogo da equipe que ainda não foi encerrado. */
  suspenso: boolean;
  motivo?: 'amarelos' | 'vermelho';
  /** Partidas em que o jogador cumpriu suspensão. */
  cumpridas: string[];
}

/**
 * Ordem cronológica. Quando todas têm número de jogo (modelo oficial: um campo,
 * um jogo por vez), vale o número. Senão: data/hora quando houver; sem data vai
 * para o fim, mantendo a ordem de cadastro.
 */
export function ordenarPartidas(partidas: readonly Partida[]): Partida[] {
  if (partidas.length > 0 && partidas.every((p) => p.numero !== undefined)) {
    return [...partidas].sort((a, b) => a.numero! - b.numero!);
  }
  return partidas
    .map((p, i) => ({ p, i }))
    .sort((x, y) => {
      const a = x.p.dataHora ?? '';
      const b = y.p.dataHora ?? '';
      if (a && b && a !== b) return a < b ? -1 : 1;
      if (a && !b) return -1;
      if (!a && b) return 1;
      return x.i - y.i;
    })
    .map(({ p }) => p);
}

/**
 * Calcula a situação de cada jogador a partir das partidas.
 * Cartões contam em partidas ao vivo ou encerradas. A suspensão é cumprida no
 * próximo jogo da equipe do jogador; enquanto esse jogo não termina, ele segue suspenso.
 */
export function calcularSuspensoes(
  partidas: readonly Partida[],
  equipeDoJogador: ReadonlyMap<string, string>,
): Map<string, SituacaoDisciplinar> {
  const situacao = new Map<string, SituacaoDisciplinar>();
  const obter = (id: string): SituacaoDisciplinar => {
    let s = situacao.get(id);
    if (!s) {
      s = { jogadorId: id, amarelos: 0, suspenso: false, cumpridas: [] };
      situacao.set(id, s);
    }
    return s;
  };

  for (const partida of ordenarPartidas(partidas)) {
    // 1) Quem estava suspenso cumpre neste jogo, se a equipe dele joga e o jogo terminou.
    if (partida.status === 'encerrada') {
      for (const s of situacao.values()) {
        const equipe = equipeDoJogador.get(s.jogadorId);
        const jogaAqui = equipe === partida.mandanteId || equipe === partida.visitanteId;
        if (s.suspenso && jogaAqui) {
          s.suspenso = false;
          s.motivo = undefined;
          s.cumpridas.push(partida.id);
        }
      }
    }

    // 2) Cartões desta partida geram suspensão para o jogo seguinte.
    if (partida.status === 'agendada') continue;
    const expulsosPorAmarelos = new Set(
      partida.eventos
        .filter((e) => e.tipo === 'vermelho' && partida.eventos.filter((a) => a.tipo === 'amarelo' && a.jogadorId === e.jogadorId).length >= 2)
        .map((e) => e.jogadorId),
    );
    for (const ev of partida.eventos) {
      if (ev.tipo === 'amarelo' && expulsosPorAmarelos.has(ev.jogadorId)) continue;
      if (ev.tipo === 'amarelo') {
        const s = obter(ev.jogadorId);
        s.amarelos += 1;
        if (s.amarelos >= 3) {
          s.amarelos = 0;
          s.suspenso = true;
          s.motivo = 'amarelos';
        }
      } else if (ev.tipo === 'vermelho') {
        const s = obter(ev.jogadorId);
        s.suspenso = true;
        s.motivo = 'vermelho';
      }
    }
  }
  return situacao;
}
