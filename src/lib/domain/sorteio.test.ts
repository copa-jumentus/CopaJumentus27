// Testes das invariantes de CLAUDE.md §3.3 (composição idêntica, 19/11/2026)
// e das regras de goleiro de §3.4.

import { describe, expect, it } from 'vitest';
import { calcularCotas } from './cotas';
import { montarElencos, sortear, type ResultadoSorteio, type ResultadoSorteioOk } from './sorteio';
import { poteDeLinha, somasDeEstrelas, validarSorteio } from './validacao';
import { JOGADORES_EXEMPLO, TIMES_EXEMPLO } from '@/lib/repo/seed';
import type { Estrelas, Jogador, Posicao, Time } from './tipos';

/** Fonte determinística para os testes (LCG) — o domínio não usa crypto aqui. */
function fonteSemente(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 0x1_0000_0000;
    return estado / 0x1_0000_0000;
  };
}

function jogador(id: string, estrelas: Estrelas, posicao: Posicao = 'LIN'): Jogador {
  return { id, nome: `Jogador ${id}`, posicao, estrelas };
}

function ok(r: ResultadoSorteio): ResultadoSorteioOk {
  if (!r.ok) throw new Error(`cotas abertas: ${r.pendencias.join(' ')}`);
  return r;
}

const NIVEIS: Estrelas[] = [6, 5, 4, 3, 2, 1];

/** Pote de linha com cotas fechadas para `n` times: 1 de cada nível por time. */
function linhaCompleta(n: number): Jogador[] {
  return Array.from({ length: n }, (_, t) => NIVEIS.map((e) => jogador(`l${t}-${e}`, e))).flat();
}

const DOIS_TIMES: Time[] = [
  { id: 't1', nome: 'A' },
  { id: 't2', nome: 'B' },
];

const sortearExemplo = (semente: number) =>
  ok(sortear({ jogadores: JOGADORES_EXEMPLO, times: TIMES_EXEMPLO }, fonteSemente(semente)));

/** Quantos jogadores de cada nível cada time recebeu. */
function composicao(r: ResultadoSorteioOk, jogadores: readonly Jogador[], times: readonly Time[]) {
  const nivel = new Map(jogadores.map((j) => [j.id, j.estrelas]));
  return times.map((t) =>
    NIVEIS.map((e) => r.sorteio.linha.filter((a) => a.timeId === t.id && nivel.get(a.jogadorId) === e).length).join(','),
  );
}

describe('cotas de estrelas', () => {
  it('8 times e 56 de linha: 1 de cada nível e 2 de 4★ por time', () => {
    const c = calcularCotas(JOGADORES_EXEMPLO, 8);
    expect(c.fechou).toBe(true);
    expect(c.vagasPorTime).toBe(7);
    expect(c.niveis.map((n) => [n.nivel, n.necessario])).toEqual([
      [6, 8],
      [5, 8],
      [4, 16],
      [3, 8],
      [2, 8],
      [1, 8],
    ]);
  });

  it('cota aberta: aponta por nível o que falta ou sobra, e o sorteio não acontece', () => {
    // Dois jogadores de 4★ viram 3★: 4★ fica com 14 de 16 e 3★ com 10 de 8.
    const trocar = new Set(JOGADORES_EXEMPLO.filter((j) => j.posicao !== 'GOL' && j.estrelas === 4).slice(0, 2).map((j) => j.id));
    const jogadores = JOGADORES_EXEMPLO.map((j) => (trocar.has(j.id) ? { ...j, estrelas: 3 as Estrelas } : j));
    const c = calcularCotas(jogadores, 8);
    expect(c.fechou).toBe(false);
    expect(c.pendencias).toContain('4★: 14 de 16, faltam 2.');
    expect(c.pendencias).toContain('3★: 10 de 8, sobram 2.');

    const r = sortear({ jogadores, times: TIMES_EXEMPLO }, fonteSemente(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.pendencias).toEqual(c.pendencias);
  });

  it('total que não divide pelos times é pendência', () => {
    const jogadores = [...linhaCompleta(2), jogador('extra', 3)];
    const c = calcularCotas(jogadores, 2);
    expect(c.fechou).toBe(false);
    expect(c.pendencias[0]).toContain('13 jogadores de linha não se dividem igualmente entre 2 times');
  });

  it('goleiros não entram nas cotas', () => {
    const jogadores = [...linhaCompleta(2), jogador('g1', 6, 'GOL'), jogador('g2', 1, 'GOL')];
    expect(calcularCotas(jogadores, 2).fechou).toBe(true);
  });

  it('quem está sem estrelas conta no tamanho dos elencos (regressão: 49 de 56 mostrava 6 por time)', () => {
    // 8 times, 49 de linha com estrelas e 7 sem: as vagas têm de sair 7 por time, com 4★ = 16.
    const comEstrelas = JOGADORES_EXEMPLO.filter((j) => j.posicao !== 'GOL').slice(0, 49);
    const c = calcularCotas(comEstrelas, 8, 7);
    expect(c.vagasPorTime).toBe(7);
    expect(c.jogadoresDeLinha).toBe(56);
    expect(c.niveis.find((n) => n.nivel === 4)?.necessario).toBe(16);
    expect(c.pendencias[0]).toBe('7 jogadores de linha sem estrelas.');
    expect(c.pendencias.some((p) => p.includes('não se dividem'))).toBe(false);
    expect(c.fechou).toBe(false);
  });
});

describe('sortear — invariantes (composição idêntica)', () => {
  const casos = [1, 2, 3, 7, 42, 99, 12345];

  it.each(casos)('seed %i: elenco de exemplo respeita todas as invariantes', (semente) => {
    expect(sortearExemplo(semente).violacoes).toEqual([]);
  });

  it.each(casos)('seed %i: mesma contagem por nível e mesma soma em todos os times', (semente) => {
    const r = sortearExemplo(semente);
    expect(new Set(composicao(r, JOGADORES_EXEMPLO, TIMES_EXEMPLO))).toEqual(new Set(['1,1,2,1,1,1']));
    const somas = [...somasDeEstrelas(JOGADORES_EXEMPLO, TIMES_EXEMPLO, r.sorteio.linha).values()];
    expect(new Set(somas)).toEqual(new Set([25]));
  });

  it('invariante 1: todo jogador do pote é alocado exatamente uma vez', () => {
    const { sorteio } = sortearExemplo(7);
    const pote = poteDeLinha(JOGADORES_EXEMPLO);
    const ids = sorteio.linha.map((a) => a.jogadorId);
    expect(ids).toHaveLength(pote.length);
    expect(new Set(ids).size).toBe(pote.length);
  });

  it('invariante 2: elencos do mesmo tamanho', () => {
    const { sorteio } = sortearExemplo(13);
    const tamanhos = TIMES_EXEMPLO.map((t) => sorteio.linha.filter((a) => a.timeId === t.id).length);
    expect(new Set(tamanhos)).toEqual(new Set([7]));
  });

  it('invariante 3 detecta composição diferente', () => {
    const jogadores = linhaCompleta(2);
    // Troca um 6★ e um 5★ de time: tamanhos iguais, composição não.
    const alocacoesLinha = jogadores.map((j) => ({
      jogadorId: j.id,
      timeId: j.id === 'l0-6' ? 't2' : j.id === 'l1-5' ? 't1' : j.id.startsWith('l0') ? 't1' : 't2',
      etapa: 'linha' as const,
    }));
    const v = validarSorteio({ jogadores, times: DOIS_TIMES, alocacoesLinha });
    expect(v.map((x) => x.invariante)).toEqual([3]);
    // A mensagem não cita jogadores nem níveis.
    expect(v[0].mensagem).not.toMatch(/★|estrela|Jogador/i);
  });

  it('a aleatoriedade decide quem cai em qual time', () => {
    const time = (semente: number) => sortearExemplo(semente).sorteio.linha.find((a) => a.jogadorId === 'j01')?.timeId;
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(time)).size).toBeGreaterThan(1);
  });

  it('não muta a entrada', () => {
    const copia = structuredClone(JOGADORES_EXEMPLO);
    sortearExemplo(5);
    expect(JOGADORES_EXEMPLO).toEqual(copia);
  });
});

describe('sortear — goleiros (§3.4)', () => {
  it('aloca exatamente 1 goleiro por time', () => {
    const { sorteio } = sortearExemplo(11);
    expect(sorteio.goleiros).toHaveLength(TIMES_EXEMPLO.length);
    expect(new Set(sorteio.goleiros.map((a) => a.timeId)).size).toBe(TIMES_EXEMPLO.length);
    expect(new Set(sorteio.goleiros.map((a) => a.jogadorId)).size).toBe(TIMES_EXEMPLO.length);
  });

  it('faltando goleiro: marca o time em vez de reutilizar ou inventar', () => {
    const jogadores: Jogador[] = [jogador('g1', 3, 'GOL'), ...linhaCompleta(2)];
    const { sorteio } = ok(sortear({ jogadores, times: DOIS_TIMES }, fonteSemente(4)));
    expect(sorteio.goleiros).toHaveLength(1);
    expect(sorteio.timesSemGoleiroIds).toHaveLength(1);
    expect(sorteio.goleirosReservaIds).toHaveLength(0);
  });

  it('goleiro sobrando vira reserva e não volta ao pote de linha', () => {
    const jogadores: Jogador[] = [jogador('g1', 3, 'GOL'), jogador('g2', 4, 'GOL'), ...linhaCompleta(1)];
    const times: Time[] = [{ id: 't1', nome: 'A' }];
    const { sorteio } = ok(sortear({ jogadores, times }, fonteSemente(6)));
    expect(sorteio.goleiros).toHaveLength(1);
    expect(sorteio.goleirosReservaIds).toHaveLength(1);
    expect(sorteio.linha.map((a) => a.jogadorId)).not.toContain(sorteio.goleirosReservaIds[0]);
  });
});

describe('sortear — ordem de revelação aleatória (decisão de 18/11/2026)', () => {
  const nivel = (id: string) => JOGADORES_EXEMPLO.find((j) => j.id === id)?.estrelas ?? 0;

  it.each([1, 2, 3, 7, 42])('seed %i: a revelação não sai agrupada do maior nível para o menor', (semente) => {
    const niveis = sortearExemplo(semente).sorteio.linha.map((a) => nivel(a.jogadorId));
    expect(niveis.every((n, i) => i === 0 || niveis[i - 1] >= n)).toBe(false);
  });

  it('em sorteios diferentes, a ordem de revelação muda', () => {
    const ordem = (semente: number) => sortearExemplo(semente).sorteio.linha.map((a) => a.jogadorId).join();
    expect(new Set([1, 2, 3, 4, 5].map(ordem)).size).toBeGreaterThan(1);
  });
});

describe('montarElencos — cerimônia parcial', () => {
  it('revela progressivamente sem vazar quem ainda não saiu', () => {
    const { sorteio } = sortearExemplo(8);
    const parcial = montarElencos(JOGADORES_EXEMPLO, TIMES_EXEMPLO, sorteio, 5, 0);
    expect(parcial.reduce((s, e) => s + e.linha.length, 0)).toBe(5);
    expect(parcial.every((e) => e.goleiro === null)).toBe(true);
  });

  it('ao final, todo o pote está distribuído', () => {
    const { sorteio } = sortearExemplo(2);
    const completo = montarElencos(JOGADORES_EXEMPLO, TIMES_EXEMPLO, sorteio);
    expect(completo.reduce((s, e) => s + e.linha.length, 0)).toBe(poteDeLinha(JOGADORES_EXEMPLO).length);
    expect(completo.every((e) => e.goleiro !== null)).toBe(true);
  });
});
