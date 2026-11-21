import { describe, expect, it } from 'vitest';
import { aplicarComando, lerRelogio, RELOGIO_INICIAL, rotuloFase, type Relogio } from './relogio';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

describe('relógio da partida', () => {
  it('corre o 1º tempo, pausa, retoma e mostra o minuto da súmula', () => {
    let r = aplicarComando(RELOGIO_INICIAL, { acao: 'iniciar', tempo: 1 }, T0);
    expect(lerRelogio(r, T0 + 3 * MIN + 20_000, 8)).toMatchObject({ fase: 'tempo1', correndo: true, mostrador: '03:20', minuto: 4 });
    r = aplicarComando(r, { acao: 'pausar', tempo: 1 }, T0 + 4 * MIN);
    // Pausado: o tempo não anda.
    expect(lerRelogio(r, T0 + 10 * MIN, 8).mostrador).toBe('04:00');
    r = aplicarComando(r, { acao: 'retomar', tempo: 1 }, T0 + 10 * MIN);
    expect(lerRelogio(r, T0 + 11 * MIN, 8).mostrador).toBe('05:00');
  });

  it('acréscimo: o mostrador para na duração e o minuto fica no último do tempo', () => {
    const r = aplicarComando(RELOGIO_INICIAL, { acao: 'iniciar', tempo: 1 }, T0);
    const l = lerRelogio(r, T0 + 9 * MIN + 30_000, 8);
    expect(l).toMatchObject({ mostrador: '08:00', minuto: 8 });
    expect(l.acrescimoMs).toBe(90_000);
  });

  it('intervalo conta à parte e o 2º tempo continua a contagem de minutos', () => {
    let r = aplicarComando(RELOGIO_INICIAL, { acao: 'iniciar', tempo: 1 }, T0);
    r = aplicarComando(r, { acao: 'fim', tempo: 1 }, T0 + 8 * MIN);
    const intervalo = lerRelogio(r, T0 + 9 * MIN, 8);
    expect(intervalo).toMatchObject({ fase: 'intervalo', intervaloMs: MIN, mostrador: '08:00' });
    expect(rotuloFase(intervalo)).toBe('Intervalo');
    r = aplicarComando(r, { acao: 'iniciar', tempo: 2 }, T0 + 10 * MIN);
    expect(lerRelogio(r, T0 + 12 * MIN + 5_000, 8)).toMatchObject({ fase: 'tempo2', mostrador: '02:05', minuto: 11 });
    r = aplicarComando(r, { acao: 'fim', tempo: 2 }, T0 + 18 * MIN);
    expect(lerRelogio(r, T0 + 40 * MIN, 8)).toMatchObject({ fase: 'fim', correndo: false, mostrador: '08:00', minuto: 16 });
  });

  it('repetir um comando (fila reenviando) não muda o relógio', () => {
    const r1 = aplicarComando(RELOGIO_INICIAL, { acao: 'iniciar', tempo: 1 }, T0);
    expect(aplicarComando(r1, { acao: 'iniciar', tempo: 1 }, T0 + 5 * MIN)).toBe(r1);
    const p = aplicarComando(r1, { acao: 'pausar', tempo: 1 }, T0 + MIN);
    expect(aplicarComando(p, { acao: 'pausar', tempo: 1 }, T0 + 2 * MIN)).toBe(p);
    const f: Relogio = aplicarComando(p, { acao: 'fim', tempo: 1 }, T0 + 3 * MIN);
    // Comandos do 1º tempo chegando atrasados, depois do fim dele, são ignorados.
    expect(aplicarComando(f, { acao: 'retomar', tempo: 1 }, T0 + 4 * MIN)).toBe(f);
    expect(aplicarComando(f, { acao: 'fim', tempo: 1 }, T0 + 4 * MIN)).toBe(f);
  });

  it('fora de ordem é erro visível', () => {
    expect(() => aplicarComando(RELOGIO_INICIAL, { acao: 'iniciar', tempo: 2 }, T0)).toThrow('Feche o 1º tempo');
    expect(() => aplicarComando(RELOGIO_INICIAL, { acao: 'pausar', tempo: 1 }, T0)).toThrow('ainda não começou');
  });

  it('sem relógio, a partida está antes do jogo', () => {
    expect(lerRelogio(undefined, T0, 8)).toMatchObject({ fase: 'antes', mostrador: '00:00', minuto: undefined });
  });
});
