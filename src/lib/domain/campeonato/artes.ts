// Artes do Instagram geradas pelo sistema (pedido do operador em 19/11/2026):
// resultados de uma rodada, artilharia e assistências, em feed (1080×1350) e
// stories (1080×1920). Aqui só os dados de cada arte, prontos para desenhar;
// o desenho fica em components/admin/GeradorArtes.tsx. Puro e testado.

import { fundoVisivel } from '@/lib/campeonato/cores';
import { descreverOrigem } from './chaveamento';
import { ETAPAS_MATA_MATA } from './modelo';
import { artilharia, assistencias } from './rankings';
import type { Campeonato, Equipe, EventoPartida, Partida } from './tipos';

export interface LadoArte {
  /** Sigla do time, ou a origem enquanto a vaga não estiver decidida ("3º Grupo Único"). */
  texto: string;
  escudo?: string;
  /** Cor do time que aparece sobre o marinho (barra lateral). */
  cor: string;
}

/** Lance da arte de um jogo: gol (com assistência) ou cartão. */
export interface LanceArte {
  tipo: 'gol' | 'penalti' | 'contra' | 'amarelo' | 'vermelho';
  minuto?: number;
  /** Quem fez (no gol contra, o jogador do outro time). */
  nome: string;
  assistencia?: string;
}

export interface JogoArte {
  /** Id da partida. */
  id: string;
  numero?: number;
  /** "Rodada 3", "Semifinal 1", "Final". */
  rotulo: string;
  /** Nome da fase ("Grupo Único", "Mata-mata"). */
  fase: string;
  /** "SEX 16/01 · 16:42", vazio sem data. */
  quando: string;
  /** Lances de cada lado, em ordem de minuto. Gol contra fica do lado que ganhou o gol. */
  lances: { mandante: LanceArte[]; visitante: LanceArte[] };
  /** "FIM", "AO VIVO" ou o horário ("16:21"). */
  situacao: string;
  encerrado: boolean;
  mandante: LadoArte;
  visitante: LadoArte;
  golsMandante?: number;
  golsVisitante?: number;
  /** Só no mata-mata empatado. */
  penaltis?: [number, number];
  vencedor?: 'mandante' | 'visitante';
}

export interface BlocoDeJogos {
  id: string;
  /** "Rodada 3", "Semifinais". */
  titulo: string;
  /** "Grupo Único · Dia 1". */
  legenda: string;
  /** "Jogos 9 a 12". */
  faixa: string;
  jogos: JogoArte[];
}

export interface ItemRankingArte {
  posicao: number;
  nome: string;
  sigla: string;
  escudo?: string;
  cor: string;
  valor: number;
}

export interface RankingArte {
  tipo: 'artilharia' | 'assistencias';
  titulo: string;
  legenda: string;
  unidade: string;
  /** "Após 12 de 34 jogos". */
  momento: string;
  itens: ItemRankingArte[];
}

const MARINHO = '#0B1F3F';
const DOURADO = '#D4A12A';

function corDe(e: Equipe | undefined): string {
  if (!e) return '#C9CCD1';
  return fundoVisivel([e.corPrimaria, e.corSecundaria], MARINHO) ?? DOURADO;
}

function lado(c: Campeonato, equipeId: string | undefined, origem: Partida['origemMandante']): LadoArte {
  const e = c.equipes.find((x) => x.id === equipeId);
  if (e) return { texto: e.sigla, escudo: e.escudo, cor: corDe(e) };
  return { texto: origem ? descreverOrigem(origem, c) : 'A definir', cor: '#C9CCD1' };
}

function hora(dataHora?: string): string {
  return dataHora?.slice(11, 16) || 'A DEFINIR';
}

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
function quando(dataHora?: string): string {
  const m = dataHora ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(dataHora) : null;
  if (!m) return '';
  const dia = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${DIAS[dia]} ${m[3]}/${m[2]} · ${m[4]}`;
}

const TIPO_LANCE: Partial<Record<EventoPartida['tipo'], LanceArte['tipo']>> = {
  gol: 'gol',
  gol_penalti: 'penalti',
  'gol-contra': 'contra',
  amarelo: 'amarelo',
  vermelho: 'vermelho',
};

function lances(c: Campeonato, p: Partida): JogoArte['lances'] {
  const nome = (id?: string) => c.jogadores.find((j) => j.id === id)?.nome;
  const res: JogoArte['lances'] = { mandante: [], visitante: [] };
  // Ordem do minuto; sem minuto, na ordem em que foi lançado, depois dos com minuto.
  const ordem = p.eventos.map((e, i) => ({ e, i })).sort((a, b) => (a.e.minuto ?? 999) - (b.e.minuto ?? 999) || a.i - b.i);
  for (const { e } of ordem) {
    const tipo = TIPO_LANCE[e.tipo];
    if (!tipo) continue;
    const doMandante = e.equipeId === p.mandanteId;
    const lado = tipo === 'contra' ? (doMandante ? 'visitante' : 'mandante') : doMandante ? 'mandante' : 'visitante';
    res[lado].push({ tipo, minuto: e.minuto, nome: nome(e.jogadorId) ?? '—', assistencia: tipo === 'gol' ? nome(e.assistenciaId) : undefined });
  }
  return res;
}

function rotuloDoJogo(c: Campeonato, p: Partida): string {
  if (p.rotulo) return p.rotulo;
  const fase = c.fases.find((f) => f.id === p.faseId);
  if (p.rodada) return `Rodada ${p.rodada}`;
  return fase?.nome ?? 'Jogo';
}

export function jogoArte(c: Campeonato, p: Partida): JogoArte {
  const encerrado = p.status === 'encerrada';
  const comPlacar = p.status !== 'agendada';
  const empate = p.golsMandante === p.golsVisitante;
  const fase = c.fases.find((f) => f.id === p.faseId);
  const penaltis: [number, number] | undefined =
    encerrado && empate && fase?.tipo === 'mata-mata' && p.penaltisMandante !== undefined && p.penaltisVisitante !== undefined
      ? [p.penaltisMandante, p.penaltisVisitante]
      : undefined;
  const [a, b] = penaltis ?? [p.golsMandante, p.golsVisitante];
  return {
    id: p.id,
    numero: p.numero,
    rotulo: rotuloDoJogo(c, p),
    fase: fase?.nome ?? '',
    quando: quando(p.dataHora),
    lances: lances(c, p),
    situacao: encerrado ? 'FIM' : p.status === 'ao-vivo' ? 'AO VIVO' : hora(p.dataHora),
    encerrado,
    mandante: lado(c, p.mandanteId, p.origemMandante),
    visitante: lado(c, p.visitanteId, p.origemVisitante),
    golsMandante: comPlacar ? p.golsMandante : undefined,
    golsVisitante: comPlacar ? p.golsVisitante : undefined,
    penaltis,
    vencedor: encerrado && a !== b ? (a > b ? 'mandante' : 'visitante') : undefined,
  };
}

const porNumero = (a: Partida, b: Partida) => (a.numero ?? 0) - (b.numero ?? 0) || (a.dataHora ?? '').localeCompare(b.dataHora ?? '');

function faixa(ps: readonly Partida[]): string {
  const nums = ps.map((p) => p.numero).filter((n): n is number => n !== undefined);
  if (nums.length === 0) return `${ps.length} ${ps.length === 1 ? 'jogo' : 'jogos'}`;
  const [min, max] = [Math.min(...nums), Math.max(...nums)];
  return min === max ? `Jogo ${min}` : `Jogos ${min} a ${max}`;
}

function legendaDia(ps: readonly Partida[], nomeFase: string): string {
  const dias = [...new Set(ps.map((p) => p.dia).filter((d): d is number => d !== undefined))];
  return dias.length === 1 ? `${nomeFase} · Dia ${dias[0]}` : nomeFase;
}

/**
 * Blocos que viram arte de resultados: cada rodada da fase de grupos e, no
 * mata-mata do modelo, cada etapa (Repescagem, Semifinais, Finais). No formato
 * livre, o mata-mata vira um bloco por fase.
 */
export function blocosDeJogos(c: Campeonato): BlocoDeJogos[] {
  const blocos: BlocoDeJogos[] = [];
  for (const fase of c.fases) {
    const daFase = c.partidas.filter((p) => p.faseId === fase.id).sort(porNumero);
    if (daFase.length === 0) continue;
    if (fase.tipo === 'grupos') {
      const rodadas = [...new Set(daFase.map((p) => p.rodada ?? 0))].sort((a, b) => a - b);
      for (const r of rodadas) {
        const ps = daFase.filter((p) => (p.rodada ?? 0) === r);
        blocos.push({
          id: `${fase.id}:r${r}`,
          titulo: r > 0 ? `Rodada ${r}` : fase.nome,
          legenda: legendaDia(ps, fase.nome),
          faixa: faixa(ps),
          jogos: ps.map((p) => jogoArte(c, p)),
        });
      }
    } else if (c.modelo === 'copa-jumentus-8') {
      for (const etapa of ETAPAS_MATA_MATA) {
        const ps = daFase.filter((p) => p.numero !== undefined && etapa.jogos.includes(p.numero));
        if (ps.length === 0) continue;
        blocos.push({ id: `${fase.id}:${etapa.titulo}`, titulo: etapa.titulo, legenda: legendaDia(ps, 'Mata-mata'), faixa: faixa(ps), jogos: ps.map((p) => jogoArte(c, p)) });
      }
    } else {
      blocos.push({ id: fase.id, titulo: fase.nome, legenda: 'Mata-mata', faixa: faixa(daFase), jogos: daFase.map((p) => jogoArte(c, p)) });
    }
  }
  return blocos;
}

/** Top `limite` (com quem empata na última posição também cortado), posições divididas no empate. */
export function rankingArte(c: Campeonato, tipo: 'artilharia' | 'assistencias', limite = 8): RankingArte {
  const lista = (tipo === 'artilharia' ? artilharia : assistencias)(c.partidas).filter((i) => i.valor > 0);
  const itens: ItemRankingArte[] = [];
  lista.slice(0, limite).forEach((item, i) => {
    const jogador = c.jogadores.find((j) => j.id === item.jogadorId);
    const equipe = c.equipes.find((e) => e.id === jogador?.equipeId);
    const posicao = i > 0 && lista[i - 1].valor === item.valor ? itens[i - 1].posicao : i + 1;
    itens.push({ posicao, nome: jogador?.nome ?? '—', sigla: equipe?.sigla ?? '', escudo: equipe?.escudo, cor: corDe(equipe), valor: item.valor });
  });
  const encerrados = c.partidas.filter((p) => p.status === 'encerrada').length;
  return {
    tipo,
    titulo: tipo === 'artilharia' ? 'Artilharia' : 'Garçons',
    legenda: tipo === 'artilharia' ? 'Os goleadores da Copa' : 'Líderes em assistências',
    unidade: tipo === 'artilharia' ? 'Gols' : 'Assist.',
    momento: `Após ${encerrados} de ${c.partidas.length} jogos`,
    itens,
  };
}

/** "COPA JUMENTUS 2027" no rodapé das artes: nome mais a edição, sem repetir. */
export function assinaturaDasArtes(c: Pick<Campeonato, 'nome' | 'edicao'>): string {
  return c.nome.toUpperCase().includes((c.edicao ?? '').toUpperCase()) ? c.nome : `${c.nome} ${c.edicao ?? ''}`.trim();
}
