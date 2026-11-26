// Artes do Instagram geradas pelo sistema (pedido do operador em 19/11/2026):
// resultados de uma rodada, artilharia e assistências, em feed (1080×1350) e
// stories (1080×1920). Aqui só os dados de cada arte, prontos para desenhar;
// o desenho fica em components/admin/GeradorArtes.tsx. Puro e testado.

import { fundoVisivel } from '@/lib/campeonato/cores';
import { ehGoleiro } from '@/lib/domain/tipos';
import { descreverOrigem, podio } from './chaveamento';
import { calcularClassificacao } from './classificacao';
import { ETAPAS_MATA_MATA } from './modelo';
import { artilharia, assistencias } from './rankings';
import type { Campeonato, Equipe, EventoPartida, Partida } from './tipos';

export interface LadoArte {
  /** Sigla do time, ou a origem enquanto a vaga não estiver decidida ("3º Grupo Único"). */
  texto: string;
  /** Nome do time por extenso ("Inter Miami"), ou a origem enquanto a vaga não estiver decidida. */
  nome: string;
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
  if (e) return { texto: e.sigla, nome: e.nome, escudo: e.escudo, cor: corDe(e) };
  const texto = origem ? descreverOrigem(origem, c) : 'A definir';
  return { texto, nome: texto, cor: '#C9CCD1' };
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
export function rankingArte(c: Campeonato, tipo: 'artilharia' | 'assistencias', limite = 8, ateBloco?: string): RankingArte {
  const partidas = partidasAte(c, ateBloco);
  const lista = (tipo === 'artilharia' ? artilharia : assistencias)(partidas).filter((i) => i.valor > 0);
  const itens: ItemRankingArte[] = [];
  lista.slice(0, limite).forEach((item, i) => {
    const jogador = c.jogadores.find((j) => j.id === item.jogadorId);
    const equipe = c.equipes.find((e) => e.id === jogador?.equipeId);
    const posicao = i > 0 && lista[i - 1].valor === item.valor ? itens[i - 1].posicao : i + 1;
    itens.push({ posicao, nome: jogador?.nome ?? '—', sigla: equipe?.sigla ?? '', escudo: equipe?.escudo, cor: corDe(equipe), valor: item.valor });
  });
  const encerrados = partidas.filter((p) => p.status === 'encerrada').length;
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

// ---------- Artes novas (Admin › Artes, pedido do operador em 25/11/2026) ----------

/** Time numa arte: nome, cores e o slug que escolhe o fundo do time. */
export interface EquipeArte {
  id: string;
  nome: string;
  sigla: string;
  escudo?: string;
  /** Slug do arquivo do escudo ("inter-miami"); escolhe o fundo do time. */
  slug: string;
  corPrimaria: string;
  corSecundaria: string;
  corTexto: string;
}

export function slugDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function equipeArte(e: Equipe): EquipeArte {
  const arquivo = /([^/]+)\.(webp|png|jpe?g|svg)$/i.exec(e.escudo ?? '')?.[1];
  return {
    id: e.id,
    nome: e.nome,
    sigla: e.sigla,
    escudo: e.escudo,
    slug: arquivo ?? slugDe(e.nome),
    corPrimaria: e.corPrimaria,
    corSecundaria: e.corSecundaria,
    corTexto: e.corTexto,
  };
}

/** Partidas dos blocos até `ateBloco` (inclusive), na ordem de blocosDeJogos. Sem bloco: todas. */
export function partidasAte(c: Campeonato, ateBloco?: string): Partida[] {
  if (!ateBloco) return c.partidas;
  const blocos = blocosDeJogos(c);
  const i = blocos.findIndex((b) => b.id === ateBloco);
  if (i < 0) return c.partidas;
  const ids = new Set(blocos.slice(0, i + 1).flatMap((b) => b.jogos.map((j) => j.id)));
  return c.partidas.filter((p) => ids.has(p.id));
}

const artigo = (titulo: string) => (/s$/i.test(titulo) ? 'as' : 'a');

/** "Após a Rodada 3", "Após as Semifinais", "Antes da Rodada 1" (nenhum jogo encerrado). */
function momentoAte(c: Campeonato, ateBloco?: string): string {
  const blocos = blocosDeJogos(c);
  const ate = ateBloco ? blocos.findIndex((b) => b.id === ateBloco) : blocos.length - 1;
  for (let i = ate; i >= 0; i--) {
    if (blocos[i].jogos.some((j) => j.encerrado)) {
      const b = blocos[i];
      return b.jogos.every((j) => j.encerrado) ? `Após ${artigo(b.titulo)} ${b.titulo}` : `Durante ${artigo(b.titulo)} ${b.titulo}`;
    }
  }
  return blocos[0] ? `Antes ${artigo(blocos[0].titulo) === 'as' ? 'das' : 'da'} ${blocos[0].titulo}` : '';
}

export interface GrupoArte {
  id: string;
  nome: string;
  faseNome: string;
}

/** Grupos que viram arte de classificação (fases de pontos corridos). */
export function gruposArte(c: Campeonato): GrupoArte[] {
  return c.grupos
    .map((g) => ({ g, f: c.fases.find((f) => f.id === g.faseId) }))
    .filter(({ f }) => f?.tipo === 'grupos')
    .map(({ g, f }) => ({ id: g.id, nome: g.nome, faseNome: f!.nome }));
}

export interface LinhaClassificacaoArte {
  posicao: number;
  equipe: EquipeArte;
  cor: string;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  saldo: number;
  zona?: 'semifinal' | 'repescagem' | 'eliminado';
}

export interface ClassificacaoArte {
  /** "Grupo Único". */
  grupo: string;
  momento: string;
  linhas: LinhaClassificacaoArte[];
  /** Legenda das zonas, na ordem: "1º e 2º · semifinal". */
  zonas: Array<{ zona: 'semifinal' | 'repescagem' | 'eliminado'; texto: string }>;
}

const NOME_ZONA = { semifinal: 'semifinal', repescagem: 'repescagem', eliminado: 'eliminados' } as const;

export function classificacaoArte(c: Campeonato, grupoId: string, ateBloco?: string): ClassificacaoArte | null {
  const grupo = c.grupos.find((g) => g.id === grupoId);
  const fase = c.fases.find((f) => f.id === grupo?.faseId);
  if (!grupo || !fase) return null;
  const partidas = partidasAte(c, ateBloco).filter((p) => p.faseId === fase.id);
  const tabela = calcularClassificacao(grupo.equipeIds, partidas, c.pontuacao, c.criterios, { desempates: fase.desempates });
  const zonaDe = (pos: number) => fase.zonas?.find((z) => pos >= z.de && pos <= z.ate)?.zona;
  const linhas: LinhaClassificacaoArte[] = [];
  for (const [i, l] of tabela.entries()) {
    const e = c.equipes.find((x) => x.id === l.equipeId);
    if (!e) continue;
    linhas.push({
      posicao: l.posicao,
      equipe: equipeArte(e),
      cor: corDe(e),
      pontos: l.pontos,
      jogos: l.jogos,
      vitorias: l.vitorias,
      empates: l.empates,
      derrotas: l.derrotas,
      saldo: l.saldo,
      // A zona segue a linha da tabela: empatados dividem a posição, mas não a vaga.
      zona: zonaDe(i + 1),
    });
  }
  const ord = (n: number) => `${n}º`;
  const zonas = (fase.zonas ?? []).map((z) => ({
    zona: z.zona,
    texto: `${z.de === z.ate ? ord(z.de) : z.ate === z.de + 1 ? `${ord(z.de)} e ${ord(z.ate)}` : `${ord(z.de)} ao ${ord(z.ate)}`} · ${NOME_ZONA[z.zona]}`,
  }));
  return { grupo: grupo.nome, momento: momentoAte(c, ateBloco), linhas, zonas };
}

export interface DiaArte {
  /** Chave do dia: a data (AAAA-MM-DD) ou "dia-2" sem data. */
  id: string;
  /** "Sábado · 16 de janeiro" ou "Dia 2". */
  titulo: string;
  jogos: JogoArte[];
}

const DIAS_EXTENSO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Jogos de cada dia, em ordem de horário (programação do dia). */
export function diasArte(c: Campeonato): DiaArte[] {
  const mapa = new Map<string, { titulo: string; ordem: string; ps: Partida[] }>();
  for (const p of c.partidas) {
    const m = p.dataHora ? /^(\d{4})-(\d{2})-(\d{2})/.exec(p.dataHora) : null;
    let id: string;
    let titulo: string;
    if (m) {
      id = `${m[1]}-${m[2]}-${m[3]}`;
      const dia = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
      titulo = `${DIAS_EXTENSO[dia]} · ${Number(m[3])} de ${MESES[Number(m[2]) - 1]}`;
    } else if (p.dia !== undefined) {
      id = `dia-${p.dia}`;
      titulo = `Dia ${p.dia}`;
    } else continue;
    const item = mapa.get(id) ?? { titulo, ordem: id.startsWith('dia-') ? `z${id}` : id, ps: [] };
    item.ps.push(p);
    mapa.set(id, item);
  }
  return [...mapa.entries()]
    .sort((a, b) => a[1].ordem.localeCompare(b[1].ordem))
    .map(([id, d]) => ({
      id,
      titulo: d.titulo,
      jogos: d.ps.sort((a, b) => (a.dataHora ?? '').localeCompare(b.dataHora ?? '') || porNumero(a, b)).map((p) => jogoArte(c, p)),
    }));
}

export interface JogadorElencoArte {
  id: string;
  nome: string;
  goleiro: boolean;
  capitao: boolean;
}

export interface ElencoArte {
  equipe: EquipeArte;
  /** Goleiros primeiro; depois o capitão; depois os outros em ordem alfabética. */
  jogadores: JogadorElencoArte[];
}

export function elencosArte(c: Campeonato): ElencoArte[] {
  return c.equipes.map((e) => {
    const jogadores = c.jogadores
      .filter((j) => j.equipeId === e.id)
      .map((j) => ({ id: j.id, nome: j.nome, goleiro: ehGoleiro(j.posicao), capitao: j.id === e.capitaoId }))
      .sort((a, b) => Number(b.goleiro) - Number(a.goleiro) || Number(b.capitao) - Number(a.capitao) || a.nome.localeCompare(b.nome, 'pt-BR'));
    return { equipe: equipeArte(e), jogadores };
  });
}

/** Chave do mata-mata do modelo oficial (jogos 29 a 34). Fora do modelo, null. */
export function chaveArte(c: Campeonato): Record<number, JogoArte> | null {
  if (c.modelo !== 'copa-jumentus-8') return null;
  const chave: Record<number, JogoArte> = {};
  for (const p of c.partidas) if (p.numero !== undefined && p.numero >= 29 && p.numero <= 34) chave[p.numero] = jogoArte(c, p);
  return [29, 30, 31, 32, 33, 34].every((n) => chave[n]) ? chave : null;
}

export interface CampeaoArte {
  campeao: EquipeArte;
  vice: EquipeArte;
  terceiro?: EquipeArte;
  final: JogoArte;
}

/** Só com a final encerrada. */
export function campeaoArte(c: Campeonato): CampeaoArte | null {
  const p = podio(c);
  const final = c.partidas.find((x) => x.numero === 34);
  const eq = (id?: string) => c.equipes.find((e) => e.id === id);
  const [a, b] = [eq(p?.primeiro), eq(p?.segundo)];
  if (!p || !final || !a || !b) return null;
  const t = eq(p.terceiro);
  return { campeao: equipeArte(a), vice: equipeArte(b), terceiro: t ? equipeArte(t) : undefined, final: jogoArte(c, final) };
}

export interface MelhorDaPartidaArte {
  jogo: JogoArte;
  nome: string;
  equipe: EquipeArte;
  gols: number;
  assistencias: number;
}

/** Jogadores das duas equipes da partida, para escolher o melhor em campo. */
export function jogadoresDaPartida(c: Campeonato, partidaId: string): Array<{ id: string; nome: string; sigla: string }> {
  const p = c.partidas.find((x) => x.id === partidaId);
  if (!p) return [];
  return [p.mandanteId, p.visitanteId].flatMap((eid) => {
    const e = c.equipes.find((x) => x.id === eid);
    return c.jogadores
      .filter((j) => j.equipeId === eid)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((j) => ({ id: j.id, nome: j.nome, sigla: e?.sigla ?? '' }));
  });
}

export function melhorDaPartidaArte(c: Campeonato, partidaId: string, jogadorId: string): MelhorDaPartidaArte | null {
  const p = c.partidas.find((x) => x.id === partidaId);
  const j = c.jogadores.find((x) => x.id === jogadorId);
  const e = c.equipes.find((x) => x.id === j?.equipeId);
  if (!p || !j || !e) return null;
  const gols = p.eventos.filter((ev) => ev.jogadorId === j.id && (ev.tipo === 'gol' || ev.tipo === 'gol_penalti')).length;
  const assistencias = p.eventos.filter((ev) => ev.tipo === 'gol' && ev.assistenciaId === j.id).length;
  return { jogo: jogoArte(c, p), nome: j.nome, equipe: equipeArte(e), gols, assistencias };
}

/** Jogador escolhido para a Seleção da Copa (a organização escolhe na tela). */
export interface JogadorSelecaoArte {
  nome: string;
  equipe: EquipeArte;
  goleiro: boolean;
}

export function jogadorSelecaoArte(c: Campeonato, jogadorId: string): JogadorSelecaoArte | null {
  const j = c.jogadores.find((x) => x.id === jogadorId);
  const e = c.equipes.find((x) => x.id === j?.equipeId);
  return j && e ? { nome: j.nome, equipe: equipeArte(e), goleiro: ehGoleiro(j.posicao) } : null;
}
