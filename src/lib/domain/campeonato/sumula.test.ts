import { describe, expect, it } from 'vitest';
import { aplicarChaveamento } from './chaveamento';
import { aplicarModelo } from './modelo';
import { ErroDoJogo } from './relogio';
import { lancarEvento } from './sumula';
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

  it('no máximo dois amarelos por jogador no mesmo jogo', () => {
    const c = campeonato();
    const p = c.partidas.find((x) => x.numero === 1)!;
    const j = `${p.visitanteId}1`;
    cartao(c, p.id, j, 'amarelo');
    cartao(c, p.id, j, 'amarelo');
    expect(() => cartao(c, p.id, j, 'amarelo')).toThrow(/dois amarelos/);
    // O vermelho depois do segundo amarelo continua entrando.
    cartao(c, p.id, j, 'vermelho');
  });

  it('gol continua entrando normalmente', () => {
    const c = campeonato();
    const p = c.partidas.find((x) => x.numero === 1)!;
    lancarEvento(c, p.id, { id: 'g1', tipo: 'gol', jogadorId: `${p.mandanteId}1` });
    lancarEvento(c, p.id, { id: 'g2', tipo: 'gol', jogadorId: `${p.mandanteId}1` });
    expect(p.golsMandante).toBe(2);
  });
});
