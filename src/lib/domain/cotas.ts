// Cotas de estrelas do sorteio com composição idêntica (decisão do operador em
// 19/11/2026, CLAUDE.md §3.3). Todo time recebe a mesma quantidade de jogadores
// de cada nível; por isso cada nível precisa ter um múltiplo do número de times.
// Tudo derivado do cadastro: vagas por time = linha ÷ times; 1 vaga por nível e a
// sobra no NIVEL_DUPLO. PURO e testado.

import { ESTRELAS_MAX, ESTRELAS_MIN, NIVEL_DUPLO } from '@/lib/config';
import type { Estrelas, Jogador } from './tipos';
import { poteDeLinha } from './validacao';

export interface CotaNivel {
  nivel: Estrelas;
  /** Quantos jogadores deste nível cada time recebe. */
  porTime: number;
  /** porTime × número de times. */
  necessario: number;
  /** Quantos jogadores de linha deste nível estão no cadastro. */
  tem: number;
}

export interface Cotas {
  times: number;
  jogadoresDeLinha: number;
  vagasPorTime: number;
  niveis: CotaNivel[];
  /** Pendências em texto, por nível ("4★: 14 de 16, faltam 2"). Só para Admin › Inscrições. */
  pendencias: string[];
  fechou: boolean;
}

/** Níveis do mais forte para o mais fraco. */
export function niveisDeEstrela(): Estrelas[] {
  const niveis: Estrelas[] = [];
  for (let n = ESTRELAS_MAX; n >= ESTRELAS_MIN; n--) {
    if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6) niveis.push(n);
  }
  return niveis;
}

export function calcularCotas(jogadores: readonly Jogador[], times: number): Cotas {
  const linha = poteDeLinha(jogadores);
  const niveis = niveisDeEstrela();
  const pendencias: string[] = [];

  if (times < 1) {
    return { times, jogadoresDeLinha: linha.length, vagasPorTime: 0, niveis: [], pendencias: ['Cadastre as equipes do campeonato.'], fechou: false };
  }

  const vagasPorTime = Math.max(niveis.length, Math.round(linha.length / times));
  const extra = vagasPorTime - niveis.length;

  if (linha.length % times !== 0) {
    pendencias.push(
      `${linha.length} jogadores de linha não se dividem igualmente entre ${times} times (${times * vagasPorTime} fecham ${vagasPorTime} por time).`,
    );
  }
  if (Math.round(linha.length / times) < niveis.length) {
    pendencias.push(`Cada time precisa de pelo menos ${niveis.length} jogadores de linha, um de cada nível.`);
  }

  const cotas = niveis.map((nivel): CotaNivel => {
    const porTime = 1 + (nivel === NIVEL_DUPLO ? extra : 0);
    const necessario = porTime * times;
    const tem = linha.filter((j) => j.estrelas === nivel).length;
    if (tem !== necessario) {
      const dif = Math.abs(necessario - tem);
      pendencias.push(`${nivel}★: ${tem} de ${necessario}, ${tem < necessario ? 'faltam' : 'sobram'} ${dif}.`);
    }
    return { nivel, porTime, necessario, tem };
  });

  return { times, jogadoresDeLinha: linha.length, vagasPorTime, niveis: cotas, pendencias, fechou: pendencias.length === 0 };
}

/** Aviso da tela de sorteio: não cita níveis nem quem tem quantas estrelas. */
export const AVISO_COTAS_SORTEIO = 'As cotas de estrelas ainda não fecharam. Ajuste em Admin › Inscrições.';
