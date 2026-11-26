import { describe, expect, it } from 'vitest';
import {
  blocosDeJogos,
  campeaoArte,
  chaveArte,
  classificacaoArte,
  diasArte,
  elencosArte,
  gruposArte,
  jogadoresDaPartida,
  melhorDaPartidaArte,
  partidasAte,
  rankingArte,
} from './artes';
import { aplicarChaveamento } from './chaveamento';
import { aplicarModelo } from './modelo';
import { CRITERIOS_PADRAO, type Campeonato, type EventoPartida } from './tipos';

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
    // a e b com cores que somem no marinho: a arte usa a outra cor do time.
    equipes: IDS.map((id, i) => ({
      id,
      nome: id.toUpperCase(),
      sigla: id.toUpperCase(),
      escudo: `/imagens/escudos/${id}.webp`,
      corPrimaria: i < 2 ? '#000000' : '#EE7FA6',
      corSecundaria: '#C39E6D',
      corTexto: '#fff',
      numeroTabela: i + 1,
    })),
    jogadores: IDS.flatMap((e) => [1, 2].map((k) => ({ id: `${e}${k}`, nome: `Jogador ${e}${k}`, equipeId: e, posicao: 'LIN' as const, pago: false }))),
    fases: [],
    grupos: [],
    partidas: [],
  };
  aplicarModelo(c, () => `id${++n}`);
  return aplicarChaveamento(c);
}

let n = 0;
const gol = (jogadorId: string, assistenciaId?: string): EventoPartida => ({ id: `ev${++n}`, tipo: 'gol', jogadorId, equipeId: jogadorId[0], assistenciaId });

describe('artes do Instagram', () => {
  it('um bloco por rodada do Grupo Único e por etapa do mata-mata', () => {
    const blocos = blocosDeJogos(campeonato());
    expect(blocos.map((b) => b.titulo)).toEqual(['Rodada 1', 'Rodada 2', 'Rodada 3', 'Rodada 4', 'Rodada 5', 'Rodada 6', 'Rodada 7', 'Repescagem', 'Semifinais', 'Finais']);
    expect(blocos[2]).toMatchObject({ legenda: 'Grupo Único · Dia 1', faixa: 'Jogos 9 a 12' });
    expect(blocos[2].jogos).toHaveLength(4);
    // Vaga ainda aberta mostra a origem.
    expect(blocos[7].jogos[0].mandante.texto).toBe('3º do Grupo Único');
  });

  it('placar, vencedor e jogo ainda por jogar', () => {
    const c = campeonato();
    const j1 = c.partidas.find((p) => p.numero === 1)!;
    Object.assign(j1, { status: 'encerrada', golsMandante: 1, golsVisitante: 3 });
    const [r1] = blocosDeJogos(c);
    expect(r1.jogos[0]).toMatchObject({ situacao: 'FIM', golsMandante: 1, golsVisitante: 3, vencedor: 'visitante' });
    expect(r1.jogos[1]).toMatchObject({ encerrado: false, golsMandante: undefined, vencedor: undefined });
    // Cor do time que some no marinho vira a secundária.
    expect(r1.jogos[0].mandante.cor === '#C39E6D' || r1.jogos[0].visitante.cor === '#C39E6D').toBe(true);
  });

  it('pênaltis só no mata-mata empatado, decidindo o vencedor', () => {
    const c = campeonato();
    const j29 = c.partidas.find((p) => p.numero === 29)!;
    Object.assign(j29, { status: 'encerrada', golsMandante: 2, golsVisitante: 2, penaltisMandante: 3, penaltisVisitante: 4 });
    const rep = blocosDeJogos(c).find((b) => b.titulo === 'Repescagem')!;
    expect(rep.jogos[0]).toMatchObject({ penaltis: [3, 4], vencedor: 'visitante' });
  });

  it('arte de um jogo: lances de cada lado em ordem de minuto, gol contra para quem ganhou', () => {
    const c = campeonato();
    const j1 = c.partidas.find((p) => p.numero === 1)!;
    const m = j1.mandanteId!;
    const v = j1.visitanteId!;
    j1.dataHora = '2027-01-15T16:00';
    j1.status = 'encerrada';
    j1.eventos = [
      { id: 'x1', tipo: 'gol', jogadorId: `${m}1`, equipeId: m, assistenciaId: `${m}2`, minuto: 12 },
      { id: 'x2', tipo: 'amarelo', jogadorId: `${v}1`, equipeId: v, minuto: 3 },
      { id: 'x3', tipo: 'gol-contra', jogadorId: `${m}2`, equipeId: m, minuto: 9 },
      { id: 'x4', tipo: 'gol_penalti', jogadorId: `${v}2`, equipeId: v },
      { id: 'x5', tipo: 'defesa', jogadorId: `${v}1`, equipeId: v, minuto: 5 },
    ];
    const [r1] = blocosDeJogos(c);
    const j = r1.jogos[0];
    expect(j).toMatchObject({ id: j1.id, rotulo: 'Rodada 1', quando: 'SEX 15/01 · 16:00' });
    expect(j.lances.mandante).toEqual([{ tipo: 'gol', minuto: 12, nome: `Jogador ${m}1`, assistencia: `Jogador ${m}2` }]);
    expect(j.lances.visitante.map((l) => [l.tipo, l.minuto])).toEqual([
      ['amarelo', 3],
      ['contra', 9],
      ['penalti', undefined],
    ]);
  });

  it('ranking: top 8, empatados dividem a posição, com o momento do campeonato', () => {
    const c = campeonato();
    const j1 = c.partidas.find((p) => p.numero === 1)!;
    Object.assign(j1, { status: 'encerrada', golsMandante: 3, golsVisitante: 1, eventos: [gol('a1', 'a2'), gol('a1', 'a2'), gol('c1'), gol('h1', 'h2')] });
    const art = rankingArte(c, 'artilharia');
    expect(art.itens.map((i) => [i.posicao, i.nome, i.valor])).toEqual([
      [1, 'Jogador a1', 2],
      [2, 'Jogador c1', 1],
      [2, 'Jogador h1', 1],
    ]);
    expect(art.momento).toBe('Após 1 de 34 jogos');
    const ass = rankingArte(c, 'assistencias');
    expect(ass.titulo).toBe('Garçons');
    expect(ass.itens.map((i) => [i.posicao, i.sigla, i.valor])).toEqual([
      [1, 'A', 2],
      [2, 'H', 1],
    ]);
  });

  it('ranking e classificação podem parar numa rodada', () => {
    const c = campeonato();
    const j1 = c.partidas.find((p) => p.numero === 1)!;
    const j5 = c.partidas.find((p) => p.numero === 5)!;
    Object.assign(j1, { status: 'encerrada', golsMandante: 1, golsVisitante: 0, eventos: [gol(`${j1.mandanteId}1`)] });
    Object.assign(j5, { status: 'encerrada', golsMandante: 2, golsVisitante: 0, eventos: [gol(`${j5.mandanteId}1`), gol(`${j5.mandanteId}1`)] });
    const [r1] = blocosDeJogos(c);
    expect(partidasAte(c, r1.id)).toHaveLength(4);
    expect(rankingArte(c, 'artilharia', 8, r1.id).itens).toHaveLength(1);
    expect(rankingArte(c, 'artilharia').itens).toHaveLength(2);

    const [g] = gruposArte(c);
    expect(g.nome).toBe('Grupo Único');
    const ate1 = classificacaoArte(c, g.id, r1.id)!;
    expect(ate1.momento).toBe('Durante a Rodada 1');
    expect(ate1.linhas[0]).toMatchObject({ posicao: 1, pontos: 3, equipe: { id: j1.mandanteId }, zona: 'semifinal' });
    expect(ate1.linhas.map((l) => l.zona)).toEqual(['semifinal', 'semifinal', 'repescagem', 'repescagem', 'repescagem', 'repescagem', 'eliminado', 'eliminado']);
    expect(ate1.zonas.map((z) => z.texto)).toEqual(['1º e 2º · semifinal', '3º ao 6º · repescagem', '7º e 8º · eliminados']);
    expect(classificacaoArte(c, g.id)!.momento).toBe('Durante a Rodada 2');
    expect(classificacaoArte(campeonato(), g.id)!.momento).toBe('Antes da Rodada 1');
  });

  it('programação: jogos agrupados por data, em ordem de horário', () => {
    const c = campeonato();
    c.partidas.forEach((p) => (p.dataHora = undefined));
    const [a, b, d] = [1, 2, 20].map((n) => c.partidas.find((p) => p.numero === n)!);
    a.dataHora = '2027-01-16T16:21';
    b.dataHora = '2027-01-16T16:00';
    d.dataHora = '2027-01-17T16:00';
    const dias = diasArte(c);
    expect(dias.map((x) => x.titulo)).toEqual(['Sábado · 16 de janeiro', 'Domingo · 17 de janeiro', 'Dia 1', 'Dia 2']);
    expect(dias[0].jogos.map((j) => j.numero)).toEqual([2, 1]);
  });

  it('elenco: goleiro primeiro, depois o capitão', () => {
    const c = campeonato();
    c.jogadores.push({ id: 'a3', nome: 'Zé Goleiro', equipeId: 'a', posicao: 'GOL', pago: false });
    c.equipes[0].capitaoId = 'a2';
    c.equipes[0].escudo = '/imagens/escudos/inter-miami.webp';
    const [a] = elencosArte(c);
    expect(a.equipe.slug).toBe('inter-miami');
    expect(a.jogadores.map((j) => [j.nome, j.goleiro, j.capitao])).toEqual([
      ['Zé Goleiro', true, false],
      ['Jogador a2', false, true],
      ['Jogador a1', false, false],
    ]);
  });

  it('chave do mata-mata e campeão só com a final encerrada', () => {
    const c = campeonato();
    const chave = chaveArte(c)!;
    expect(Object.keys(chave)).toEqual(['29', '30', '31', '32', '33', '34']);
    expect(campeaoArte(c)).toBeNull();
    expect(chaveArte({ ...c, modelo: 'livre' })).toBeNull();
  });

  it('melhor da partida: jogadores dos dois times e gols do escolhido', () => {
    const c = campeonato();
    const j1 = c.partidas.find((p) => p.numero === 1)!;
    const m = j1.mandanteId!;
    Object.assign(j1, { status: 'encerrada', golsMandante: 2, golsVisitante: 0, eventos: [gol(`${m}1`, `${m}2`), gol(`${m}1`)] });
    expect(jogadoresDaPartida(c, j1.id)).toHaveLength(4);
    expect(melhorDaPartidaArte(c, j1.id, `${m}1`)).toMatchObject({ nome: `Jogador ${m}1`, gols: 2, assistencias: 0, equipe: { id: m } });
    expect(melhorDaPartidaArte(c, j1.id, `${m}2`)).toMatchObject({ gols: 0, assistencias: 1 });
  });
});
