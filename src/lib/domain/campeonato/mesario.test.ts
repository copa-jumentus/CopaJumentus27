import { describe, expect, it } from 'vitest';
import { aplicarChaveamento } from './chaveamento';
import { aplicarOperacao, comPendentes, estadoMesario, faltaDecidirPenaltis, lerCronometro, lerOperacao, type OperacaoMesario } from './mesario';
import { aplicarModelo } from './modelo';
import { CRITERIOS_PADRAO, type Campeonato } from './tipos';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const T0 = 1_700_000_000_000;
const MIN = 60_000;

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

function jogo1(c: Campeonato) {
  const p = c.partidas.find((x) => x.numero === 1);
  if (!p?.mandanteId || !p.visitanteId) throw new Error('jogo 1 sem participantes');
  return { p, m: `${p.mandanteId}1`, m2: `${p.mandanteId}2`, v: `${p.visitanteId}1` };
}


describe('modo mesário', () => {
  it('começar o 1º tempo põe o jogo ao vivo e o minuto do lance vem do cronômetro', () => {
    const c = campeonato();
    const { p, m, m2 } = jogo1(c);
    aplicarOperacao(c, ({ em: T0, id: 'o1', partidaId: p.id, tipo: 'relogio', acao: 'iniciar', tempo: 1 }), T0);
    expect(p.status).toBe('ao-vivo');
    const minuto = lerCronometro(estadoMesario(c, p.id, T0), T0 + 3 * MIN + 1).minuto;
    expect(minuto).toBe(4);
    const msg = aplicarOperacao(c, ({ em: T0, id: 'ev1', partidaId: p.id, tipo: 'evento', evento: { tipo: 'gol', jogadorId: m, assistenciaId: m2, minuto } }), T0);
    expect(msg).toMatch(/Gol · Jogador .1\. Placar 1:0\./);
    expect(p.eventos[0]).toMatchObject({ id: 'ev1', minuto: 4, assistenciaId: m2 });
  });

  it('reenviar a mesma operação não duplica o gol (fila depois de cair a internet)', () => {
    const c = campeonato();
    const { p, m } = jogo1(c);
    const gol: OperacaoMesario = ({ em: T0, id: 'ev1', partidaId: p.id, tipo: 'evento', evento: { tipo: 'gol', jogadorId: m } });
    aplicarOperacao(c, gol, T0);
    aplicarOperacao(c, gol, T0 + 30_000);
    expect(p.golsMandante).toBe(1);
    expect(p.eventos).toHaveLength(1);
    const apagar: OperacaoMesario = ({ em: T0, id: 'o2', partidaId: p.id, tipo: 'apagar', eventoId: 'ev1' });
    aplicarOperacao(c, apagar, T0);
    aplicarOperacao(c, apagar, T0);
    expect(p.golsMandante).toBe(0);
  });

  it('gol contra soma para o outro lado; lance em jogo encerrado é recusado', () => {
    const c = campeonato();
    const { p, v } = jogo1(c);
    aplicarOperacao(c, ({ em: T0, id: 'ev1', partidaId: p.id, tipo: 'evento', evento: { tipo: 'gol-contra', jogadorId: v } }), T0);
    expect([p.golsMandante, p.golsVisitante]).toEqual([1, 0]);
    aplicarOperacao(c, ({ em: T0, id: 'o2', partidaId: p.id, tipo: 'status', status: 'encerrada' }), T0);
    expect(() => aplicarOperacao(c, ({ em: T0, id: 'ev2', partidaId: p.id, tipo: 'evento', evento: { tipo: 'gol', jogadorId: v } }), T0)).toThrow('já foi encerrada');
  });

  it('instante do celular no futuro do servidor é limitado', () => {
    const c = campeonato();
    const { p } = jogo1(c);
    aplicarOperacao(c, { id: 'o1', partidaId: p.id, tipo: 'relogio', acao: 'iniciar', tempo: 1, em: T0 + 60 * MIN }, T0);
    expect(p.relogio?.correndoDesde).toBe(T0 + 5_000);
  });

  it('a tela mostra a fila como pendente, com placar e cronômetro já atualizados', () => {
    const c = campeonato();
    const { p, m, v } = jogo1(c);
    aplicarOperacao(c, ({ em: T0, id: 'ev0', partidaId: p.id, tipo: 'evento', evento: { tipo: 'gol', jogadorId: v } }), T0);
    const base = estadoMesario(c, p.id, T0);
    const jogadores = [
      { id: m, nome: 'Autor', lado: 'mandante' as const },
      { id: v, nome: 'Visitante', lado: 'visitante' as const },
    ];
    const fila: OperacaoMesario[] = [
      ({ em: T0, id: 'r1', partidaId: p.id, tipo: 'relogio', acao: 'iniciar', tempo: 1 }),
      ({ em: T0, id: 'ev1', partidaId: p.id, tipo: 'evento', evento: { tipo: 'gol', jogadorId: m, minuto: 2 } }),
      ({ em: T0, id: 'x', partidaId: p.id, tipo: 'apagar', eventoId: 'ev0' }),
      // Comando fora de ordem fica de fora da prévia (o servidor responde o erro).
      ({ em: T0, id: 'r2', partidaId: p.id, tipo: 'relogio', acao: 'iniciar', tempo: 2 }),
    ];
    const tela = comPendentes(base, fila, jogadores);
    expect([tela.golsMandante, tela.golsVisitante]).toEqual([1, 0]);
    expect(tela.lances).toEqual([expect.objectContaining({ id: 'ev1', jogador: 'Autor', pendente: true, minuto: 2 })]);
    expect(lerCronometro(tela, T0 + MIN).fase).toBe('tempo1');
    // O que o servidor já confirmou não aparece duas vezes.
    aplicarOperacao(c, fila[1], T0);
    expect(comPendentes(estadoMesario(c, p.id, T0), fila.slice(1, 2), jogadores).lances.filter((l) => l.id === 'ev1')).toHaveLength(1);
  });

  it('estado da partida não carrega nada além do jogo', () => {
    const c = campeonato();
    const { p } = jogo1(c);
    const e = estadoMesario(c, p.id, T0);
    expect(Object.keys(e).sort()).toEqual(
      ['agoraServidor', 'duracaoMin', 'golsMandante', 'golsVisitante', 'lances', 'partidaId', 'penaltisMandante', 'penaltisVisitante', 'relogio', 'status'].sort(),
    );
    expect(e.duracaoMin).toBe(8);
  });
});

describe('operação vinda do celular', async () => {
  const { lerOperacao } = await import('./mesario');
  it('aceita só operações bem formadas', () => {
    expect(lerOperacao({ id: 'a', partidaId: 'p', em: 1, tipo: 'evento', evento: { tipo: 'gol', jogadorId: 'j', minuto: 3 } })).toMatchObject({ tipo: 'evento' });
    expect(lerOperacao({ id: 'a', partidaId: 'p', em: 1, tipo: 'relogio', acao: 'pausar', tempo: 2 })).toMatchObject({ acao: 'pausar' });
    expect(lerOperacao({ id: 'a', partidaId: 'p', em: 1, tipo: 'evento', evento: { tipo: 'hack', jogadorId: 'j' } })).toBeNull();
    expect(lerOperacao({ id: 'a', partidaId: 'p', em: 1, tipo: 'relogio', acao: 'iniciar', tempo: 3 })).toBeNull();
    expect(lerOperacao({ id: 'a', partidaId: 'p', em: 1, tipo: 'status', status: 'agendada' })).toBeNull();
    expect(lerOperacao({ id: 'x'.repeat(100), partidaId: 'p', em: 1, tipo: 'apagar', eventoId: 'e' })).toBeNull();
    expect(lerOperacao('texto')).toBeNull();
  });

  it('pênaltis: só no mata-mata empatado, valor absoluto (reenviar é seguro)', () => {
    const c = campeonato();
    const { p } = jogo1(c);
    expect(() => aplicarOperacao(c, { em: T0, id: 'p0', partidaId: p.id, tipo: 'penaltis', mandante: 1, visitante: 0 }, T0)).toThrow(/mata-mata/);

    const fase = c.fases.find((f) => f.tipo === 'mata-mata');
    if (!fase) throw new Error('sem mata-mata');
    const mm = c.partidas.find((x) => x.faseId === fase.id);
    if (!mm) throw new Error('sem jogo de mata-mata');
    mm.mandanteId = 'a';
    mm.visitanteId = 'b';
    const pen = (id: string, mandante: number, visitante: number): OperacaoMesario => ({ em: T0, id, partidaId: mm.id, tipo: 'penaltis', mandante, visitante });
    aplicarOperacao(c, pen('p1', 1, 0), T0);
    aplicarOperacao(c, pen('p2', 4, 3), T0);
    aplicarOperacao(c, pen('p2', 4, 3), T0);
    expect([mm.penaltisMandante, mm.penaltisVisitante]).toEqual([4, 3]);
    expect(faltaDecidirPenaltis(estadoMesario(c, mm.id, T0), true)).toBe(false);
    aplicarOperacao(c, pen('p3', 4, 4), T0);
    expect(faltaDecidirPenaltis(estadoMesario(c, mm.id, T0), true)).toBe(true);

    aplicarOperacao(c, { em: T0, id: 'g1', partidaId: mm.id, tipo: 'evento', evento: { tipo: 'gol', jogadorId: 'a1' } }, T0);
    expect(faltaDecidirPenaltis(estadoMesario(c, mm.id, T0), true)).toBe(false);
    expect(() => aplicarOperacao(c, pen('p4', 5, 4), T0)).toThrow(/empate/);
  });

  it('pênaltis que chegam do celular são validados', () => {
    const base = { id: 'x', partidaId: 'p', em: T0, tipo: 'penaltis' };
    expect(lerOperacao({ ...base, mandante: 3, visitante: 2 })).toMatchObject({ tipo: 'penaltis', mandante: 3, visitante: 2 });
    expect(lerOperacao({ ...base, mandante: -1, visitante: 2 })).toBeNull();
    expect(lerOperacao({ ...base, mandante: 1.5, visitante: 2 })).toBeNull();
    expect(lerOperacao({ ...base, mandante: '3', visitante: 2 })).toBeNull();
  });
});
