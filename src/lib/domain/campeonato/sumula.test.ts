import { describe, expect, it } from 'vitest';
import { aplicarChaveamento } from './chaveamento';
import { aplicarModelo } from './modelo';
import { ErroDoJogo } from './relogio';
import { apagarEvento, lancarEvento } from './sumula';
import { calcularSuspensoes } from './suspensoes';
import { CRITERIOS_PADRAO, type Campeonato } from './tipos';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function campeonato(): Campeonato {
  let n = 0;
  const c: Campeonato = {
    versao: 1,
    id: 1,
    slug: 't',
    nome: 'T',
    status: 'andamento',
    modelo: 'livre',
    pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
    criterios: [...CRITERIOS_PADRAO],
    valorInscricao: 0,
    equipes: IDS.map((id, i) => ({ id, nome: id, sigla: id.toUpperCase(), corPrimaria: '#EE7FA6', corSecundaria: '#231F20', corTexto: '#fff', numeroTabela: i + 1 })),
    jogadores: IDS.flatMap((e) => [1, 2].map((k) => ({ id: `${e}${k}`, nome: `Jogador ${e}${k}`, equipeId: e, posicao: 'LIN' as const, pago: false }))),
    fases: [],
    grupos: [],
    partidas: [],
  };
  aplicarModelo(c, () => `id${++n}`);
  return aplicarChaveamento(c);
}

describe('cartões na súmula', () => {
  let n = 0;
  const cartao = (c: Campeonato, partidaId: string, jogadorId: string, tipo: string) => lancarEvento(c, partidaId, { id: `ev${++n}`, tipo, jogadorId });

  it('quem levou vermelho não recebe outro cartão no mesmo jogo', () => {
    const c = campeonato();
    const p = c.partidas.find((x) => x.numero === 1)!;
    const j = `${p.mandanteId}1`;
    cartao(c, p.id, j, 'amarelo');
    cartao(c, p.id, j, 'vermelho');
    expect(() => cartao(c, p.id, j, 'vermelho')).toThrow(ErroDoJogo);
    expect(() => cartao(c, p.id, j, 'amarelo')).toThrow(/já levou vermelho/);
    expect(p.eventos.filter((e) => e.jogadorId === j)).toHaveLength(2);
    // Outro jogador e outro jogo seguem livres.
    cartao(c, p.id, `${p.mandanteId}2`, 'vermelho');
    const p2 = c.partidas.find((x) => x.numero === 2)!;
    const doMesmoTime = p2.mandanteId === p.mandanteId || p2.visitanteId === p.mandanteId;
    if (doMesmoTime) cartao(c, p2.id, j, 'amarelo');
  });

  it('segundo amarelo no mesmo jogo vira vermelho; reenviar não duplica', () => {
    const c = campeonato();
    const p = c.partidas.find((x) => x.numero === 1)!;
    const j = `${p.visitanteId}1`;
    lancarEvento(c, p.id, { id: 'am1', tipo: 'amarelo', jogadorId: j, minuto: 3 });
    const msg = lancarEvento(c, p.id, { id: 'am2', tipo: 'amarelo', jogadorId: j, minuto: 7 });
    expect(msg).toMatch(/expulso/);
    expect(p.eventos.filter((e) => e.jogadorId === j).map((e) => [e.tipo, e.minuto])).toEqual([
      ['amarelo', 3],
      ['amarelo', 7],
      ['vermelho', 7],
    ]);
    lancarEvento(c, p.id, { id: 'am2', tipo: 'amarelo', jogadorId: j, minuto: 7 });
    expect(p.eventos.filter((e) => e.jogadorId === j)).toHaveLength(3);
    expect(() => cartao(c, p.id, j, 'amarelo')).toThrow(/já levou vermelho/);
  });

  it('apagar um dos dois amarelos tira o vermelho automático junto', () => {
    const c = campeonato();
    const p = c.partidas.find((x) => x.numero === 1)!;
    const j = `${p.visitanteId}1`;
    lancarEvento(c, p.id, { id: 'a1', tipo: 'amarelo', jogadorId: j });
    lancarEvento(c, p.id, { id: 'a2', tipo: 'amarelo', jogadorId: j });
    apagarEvento(c, p.id, 'a1');
    expect(p.eventos.filter((e) => e.jogadorId === j).map((e) => e.tipo)).toEqual(['amarelo']);
  });

  it('expulsão por dois amarelos suspende o jogo seguinte e não soma nos 3 acumulados', () => {
    const c = campeonato();
    const p = c.partidas.find((x) => x.numero === 1)!;
    const j = `${p.visitanteId}1`;
    lancarEvento(c, p.id, { id: 'b1', tipo: 'amarelo', jogadorId: j });
    lancarEvento(c, p.id, { id: 'b2', tipo: 'amarelo', jogadorId: j });
    p.status = 'encerrada';
    const s = calcularSuspensoes(c.partidas, new Map(c.jogadores.map((x) => [x.id, x.equipeId])));
    expect(s.get(j)).toMatchObject({ suspenso: true, motivo: 'vermelho', amarelos: 0 });
  });

  it('gol continua entrando normalmente', () => {
    const c = campeonato();
    const p = c.partidas.find((x) => x.numero === 1)!;
    lancarEvento(c, p.id, { id: 'g1', tipo: 'gol', jogadorId: `${p.mandanteId}1` });
    lancarEvento(c, p.id, { id: 'g2', tipo: 'gol', jogadorId: `${p.mandanteId}1` });
    expect(p.golsMandante).toBe(2);
  });
});
