// Persistência dos campeonatos no Postgres (CLAUDE.md §8.4, §8.6 e §9).
// Vários campeonatos por instalação. As telas e as ações continuam vendo um
// documento `Campeonato`; aqui ele é montado das tabelas (com os participantes
// das partidas com origem já calculados) e gravado de volta numa transação, com
// a linha do campeonato travada (SELECT ... FOR UPDATE).
// Toda gravação passa pela trava do chaveamento e pelas regras de consistência.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { escudoDe, MARCAS } from '@/lib/campeonato/marcas';
import { banco, type Banco } from '@/lib/db/cliente';
import * as t from '@/lib/db/schema';
import { aplicarChaveamento, problemaDeConsistencia, violacaoDaTrava } from '@/lib/domain/campeonato/chaveamento';
import { aplicarModelo, DIAS_DO_MODELO } from '@/lib/domain/campeonato/modelo';
import { aplicarProgramacao, normalizarProgramacao, problemaNaProgramacao, programacaoPadrao } from '@/lib/domain/campeonato/programacao';
import {
  CRITERIOS_PADRAO,
  type Campeonato,
  type Criterio,
  type EventoPartida,
  type ModeloCampeonato,
  type StatusCampeonato,
} from '@/lib/domain/campeonato/tipos';

/** Erro de regra do campeonato, com mensagem para o admin. */
export class ErroCampeonato extends Error {}

/** Arquivo da versão antiga (antes do banco). Importado uma vez, se existir. */
export const ARQUIVO_LEGADO = path.join(process.cwd(), 'dados', 'campeonato.json');

/** Ids de texto únicos entre campeonatos (equipes, fases, partidas...). */
export function novoId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function slugDe(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'campeonato'
  );
}

function equipesDoManual(gerarIds: boolean): Campeonato['equipes'] {
  return MARCAS.map((m) => ({
    id: gerarIds ? novoId() : m.slug,
    nome: m.nome,
    sigla: m.sigla,
    escudo: escudoDe(m.slug),
    corPrimaria: m.corPrimaria,
    corSecundaria: m.corSecundaria,
    corTexto: m.corTexto,
  }));
}

/** Campeonato inicial de uma instalação vazia (formato livre, ids legíveis). */
export function campeonatoPadrao(): Campeonato {
  return {
    versao: 1,
    id: 0,
    slug: 'copa-jumentus-2027',
    nome: 'Copa Jumentus 2027',
    edicao: '2027',
    status: 'inscricoes',
    modelo: 'livre',
    subtitulo: 'Edição MLS',
    inicio: '2027-01-16',
    fim: '2027-01-17',
    pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
    criterios: [...CRITERIOS_PADRAO],
    valorInscricao: 0,
    equipes: equipesDoManual(false),
    jogadores: [],
    fases: [
      { id: 'grupos', nome: 'Fase de grupos', tipo: 'grupos' },
      { id: 'mata-mata', nome: 'Mata-mata', tipo: 'mata-mata' },
    ],
    grupos: [],
    partidas: [],
  };
}

type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0];
type Leitor = Banco | Tx;

const CRITERIOS_VALIDOS = new Set<string>(CRITERIOS_PADRAO);
const ehCriterio = (c: string): c is Criterio => CRITERIOS_VALIDOS.has(c);

/** Critérios gravados + os que faltarem (ex.: cartões, criado depois) no fim. */
function criteriosCompletos(gravados: readonly string[]): Criterio[] {
  const lista = gravados.filter(ehCriterio);
  return [...lista, ...CRITERIOS_PADRAO.filter((c) => !lista.includes(c))];
}

const indef = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
const ou = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

/** Documento do campeonato, com os participantes derivados já aplicados. null se não existir. */
async function ler(db: Leitor, id: number): Promise<Campeonato | null> {
  const [cfg] = await db.select().from(t.campeonato).where(eq(t.campeonato.id, id));
  if (!cfg) return null;

  const idsEquipes = db.select({ id: t.equipe.id }).from(t.equipe).where(eq(t.equipe.campeonatoId, id));
  const idsFases = db.select({ id: t.fase.id }).from(t.fase).where(eq(t.fase.campeonatoId, id));

  const [equipes, jogadores, fases, grupos, partidas] = await Promise.all([
    db.select().from(t.equipe).where(eq(t.equipe.campeonatoId, id)).orderBy(asc(t.equipe.ordem)),
    db.select().from(t.jogador).where(inArray(t.jogador.equipeId, idsEquipes)).orderBy(asc(t.jogador.ordem)),
    db.select().from(t.fase).where(eq(t.fase.campeonatoId, id)).orderBy(asc(t.fase.ordem)),
    db.select().from(t.grupo).where(inArray(t.grupo.faseId, idsFases)).orderBy(asc(t.grupo.ordem)),
    db.select().from(t.partida).where(inArray(t.partida.faseId, idsFases)).orderBy(asc(t.partida.ordem)),
  ]);
  const idsGrupos = grupos.map((g) => g.id);
  const idsPartidas = partidas.map((p) => p.id);
  const [membros, eventos] = await Promise.all([
    idsGrupos.length ? db.select().from(t.grupoEquipe).where(inArray(t.grupoEquipe.grupoId, idsGrupos)).orderBy(asc(t.grupoEquipe.ordem)) : [],
    idsPartidas.length ? db.select().from(t.evento).where(inArray(t.evento.partidaId, idsPartidas)).orderBy(asc(t.evento.ordem)) : [],
  ]);

  const eventosDa = new Map<string, EventoPartida[]>();
  for (const e of eventos) {
    const lista = eventosDa.get(e.partidaId) ?? [];
    lista.push({
      id: e.id,
      tipo: e.tipo,
      jogadorId: e.jogadorId,
      equipeId: e.equipeId,
      ...(e.assistenciaId ? { assistenciaId: e.assistenciaId } : {}),
      ...(e.minuto !== null ? { minuto: e.minuto } : {}),
    });
    eventosDa.set(e.partidaId, lista);
  }

  const c: Campeonato = {
    versao: 1,
    id: cfg.id,
    slug: cfg.slug,
    nome: cfg.nome,
    edicao: indef(cfg.edicao),
    status: cfg.status,
    modelo: cfg.modelo,
    banner: indef(cfg.banner),
    escudo: indef(cfg.escudo),
    duplicadoDe: indef(cfg.duplicadoDe),
    subtitulo: indef(cfg.subtitulo),
    inicio: indef(cfg.inicio),
    fim: indef(cfg.fim),
    local: indef(cfg.local),
    pontuacao: { vitoria: cfg.pontosVitoria, empate: cfg.pontosEmpate, derrota: cfg.pontosDerrota },
    criterios: criteriosCompletos(cfg.criterios),
    valorInscricao: Number(cfg.valorInscricao),
    sorteioOficializadoEm: cfg.sorteioOficializadoEm?.toISOString(),
    // Programações antigas (uma duração para todos os jogos) são convertidas na leitura.
    programacao: normalizarProgramacao(cfg.programacao),
    premios: cfg.premios ?? undefined,
    financeiro: cfg.financeiro ?? undefined,
    historico: cfg.historico ?? undefined,
    equipes: equipes.map((e) => ({
      id: e.id,
      nome: e.nome,
      sigla: e.sigla,
      escudo: indef(e.escudo),
      corPrimaria: e.corPrimaria,
      corSecundaria: e.corSecundaria,
      corTexto: e.corTexto,
      capitaoId: indef(e.capitaoId),
      numeroTabela: indef(e.numeroTabela),
    })),
    jogadores: jogadores.map((j) => ({
      id: j.id,
      nome: j.nome,
      equipeId: j.equipeId,
      posicao: j.posicao,
      numero: indef(j.numero),
      pago: j.pago,
    })),
    fases: fases.map((f) => ({
      id: f.id,
      nome: f.nome,
      tipo: f.tipo,
      ...(f.zonas ? { zonas: f.zonas } : {}),
      ...(f.desempates?.length ? { desempates: f.desempates } : {}),
    })),
    grupos: grupos.map((g) => ({
      id: g.id,
      faseId: g.faseId,
      nome: g.nome,
      equipeIds: membros.filter((m) => m.grupoId === g.id).map((m) => m.equipeId),
    })),
    partidas: partidas.map((p) => ({
      id: p.id,
      faseId: p.faseId,
      grupoId: indef(p.grupoId),
      rotulo: indef(p.rotulo),
      numero: indef(p.numero),
      rodada: indef(p.rodada),
      dia: indef(p.dia),
      campo: indef(p.campo),
      mandanteId: indef(p.mandanteId),
      visitanteId: indef(p.visitanteId),
      origemMandante: indef(p.origemMandante),
      origemVisitante: indef(p.origemVisitante),
      goleiroMandanteId: indef(p.goleiroMandanteId),
      goleiroVisitanteId: indef(p.goleiroVisitanteId),
      dataHora: indef(p.dataHora),
      local: indef(p.local),
      relogio: indef(p.relogio),
      status: p.status,
      golsMandante: p.golsMandante,
      golsVisitante: p.golsVisitante,
      penaltisMandante: indef(p.penaltisMandante),
      penaltisVisitante: indef(p.penaltisVisitante),
      eventos: eventosDa.get(p.id) ?? [],
    })),
  };
  return aplicarChaveamento(c);
}

function configuracao(c: Campeonato) {
  return {
    slug: c.slug,
    nome: c.nome,
    edicao: ou(c.edicao),
    status: c.status,
    modelo: c.modelo,
    banner: ou(c.banner),
    escudo: ou(c.escudo),
    duplicadoDe: ou(c.duplicadoDe),
    subtitulo: ou(c.subtitulo),
    inicio: ou(c.inicio),
    fim: ou(c.fim),
    local: ou(c.local),
    pontosVitoria: c.pontuacao.vitoria,
    pontosEmpate: c.pontuacao.empate,
    pontosDerrota: c.pontuacao.derrota,
    criterios: c.criterios,
    valorInscricao: c.valorInscricao.toFixed(2),
    sorteioOficializadoEm: c.sorteioOficializadoEm ? new Date(c.sorteioOficializadoEm) : null,
    programacao: c.programacao ?? null,
    premios: c.premios?.length ? c.premios : null,
    financeiro: c.financeiro ?? null,
    historico: c.historico ?? null,
    atualizadoEm: new Date(),
  };
}

/** Grava o documento inteiro do campeonato `id` (dentro de uma transação). Só toca nas linhas dele. */
async function gravar(tx: Tx, id: number, c: Campeonato): Promise<void> {
  const idsFases = tx.select({ id: t.fase.id }).from(t.fase).where(eq(t.fase.campeonatoId, id));
  const idsEquipes = tx.select({ id: t.equipe.id }).from(t.equipe).where(eq(t.equipe.campeonatoId, id));
  const idsPartidas = tx.select({ id: t.partida.id }).from(t.partida).where(inArray(t.partida.faseId, idsFases));
  const idsGrupos = tx.select({ id: t.grupo.id }).from(t.grupo).where(inArray(t.grupo.faseId, idsFases));
  await tx.delete(t.evento).where(inArray(t.evento.partidaId, idsPartidas));
  await tx.delete(t.partida).where(inArray(t.partida.faseId, idsFases));
  await tx.delete(t.grupoEquipe).where(inArray(t.grupoEquipe.grupoId, idsGrupos));
  await tx.delete(t.grupo).where(inArray(t.grupo.faseId, idsFases));
  await tx.delete(t.fase).where(eq(t.fase.campeonatoId, id));
  await tx.delete(t.jogador).where(inArray(t.jogador.equipeId, idsEquipes));
  await tx.delete(t.equipe).where(eq(t.equipe.campeonatoId, id));

  await tx.update(t.campeonato).set(configuracao(c)).where(eq(t.campeonato.id, id));

  if (c.equipes.length) {
    await tx.insert(t.equipe).values(
      c.equipes.map((e, i) => ({
        id: e.id,
        campeonatoId: id,
        nome: e.nome,
        sigla: e.sigla,
        escudo: ou(e.escudo),
        corPrimaria: e.corPrimaria,
        corSecundaria: e.corSecundaria,
        corTexto: e.corTexto,
        capitaoId: ou(e.capitaoId),
        numeroTabela: ou(e.numeroTabela),
        ordem: i,
      })),
    );
  }
  if (c.jogadores.length) {
    await tx.insert(t.jogador).values(
      c.jogadores.map((j, i) => ({
        id: j.id,
        nome: j.nome,
        equipeId: j.equipeId,
        posicao: j.posicao,
        numero: ou(j.numero),
        pago: j.pago,
        ordem: i,
      })),
    );
  }
  if (c.fases.length) {
    await tx.insert(t.fase).values(
      c.fases.map((f, i) => ({
        id: f.id,
        campeonatoId: id,
        nome: f.nome,
        tipo: f.tipo,
        ordem: i,
        zonas: ou(f.zonas),
        desempates: f.desempates?.length ? f.desempates : null,
      })),
    );
  }
  if (c.grupos.length) {
    await tx.insert(t.grupo).values(c.grupos.map((g, i) => ({ id: g.id, faseId: g.faseId, nome: g.nome, ordem: i })));
    const membros = c.grupos.flatMap((g) => g.equipeIds.map((equipeId, i) => ({ grupoId: g.id, equipeId, ordem: i })));
    if (membros.length) await tx.insert(t.grupoEquipe).values(membros);
  }
  if (c.partidas.length) {
    await tx.insert(t.partida).values(
      c.partidas.map((p, i) => ({
        id: p.id,
        faseId: p.faseId,
        grupoId: ou(p.grupoId),
        rotulo: ou(p.rotulo),
        numero: ou(p.numero),
        rodada: ou(p.rodada),
        dia: ou(p.dia),
        campo: ou(p.campo),
        // Participante com origem é calculado; não se grava.
        mandanteId: p.origemMandante ? null : ou(p.mandanteId),
        visitanteId: p.origemVisitante ? null : ou(p.visitanteId),
        origemMandante: ou(p.origemMandante),
        origemVisitante: ou(p.origemVisitante),
        goleiroMandanteId: ou(p.goleiroMandanteId),
        goleiroVisitanteId: ou(p.goleiroVisitanteId),
        dataHora: ou(p.dataHora),
        local: ou(p.local),
        relogio: ou(p.relogio),
        status: p.status,
        golsMandante: p.golsMandante,
        golsVisitante: p.golsVisitante,
        penaltisMandante: ou(p.penaltisMandante),
        penaltisVisitante: ou(p.penaltisVisitante),
        ordem: i,
      })),
    );
    const eventos = c.partidas.flatMap((p) =>
      p.eventos.map((e, i) => ({
        id: e.id,
        partidaId: p.id,
        tipo: e.tipo,
        jogadorId: e.jogadorId,
        equipeId: e.equipeId,
        assistenciaId: ou(e.assistenciaId),
        minuto: ou(e.minuto),
        ordem: i,
      })),
    );
    if (eventos.length) await tx.insert(t.evento).values(eventos);
  }
}

/** Valida e grava: chaveamento recalculado, trava e consistência. */
async function validarEGravar(tx: Tx, id: number, antes: Campeonato | null, c: Campeonato): Promise<Campeonato> {
  aplicarChaveamento(c);
  const trava = antes ? violacaoDaTrava(antes, c) : null;
  if (trava) throw new ErroCampeonato(trava);
  const problema = problemaDeConsistencia(c);
  if (problema) throw new ErroCampeonato(problema);
  await gravar(tx, id, c);
  return c;
}

async function slugLivre(db: Leitor, base: string, ignorarId?: number): Promise<string> {
  const raiz = slugDe(base);
  for (let n = 1; ; n++) {
    const candidato = n === 1 ? raiz : `${raiz}-${n}`;
    const filtro = ignorarId ? and(eq(t.campeonato.slug, candidato), ne(t.campeonato.id, ignorarId)) : eq(t.campeonato.slug, candidato);
    const [ocupado] = await db.select({ id: t.campeonato.id }).from(t.campeonato).where(filtro);
    if (!ocupado) return candidato;
  }
}

/** Cria a linha e grava o documento. Retorna o id. */
async function inserir(db: Banco, c: Campeonato): Promise<number> {
  return db.transaction(async (tx) => {
    const slug = await slugLivre(tx, c.slug || c.nome);
    const [linha] = await tx
      .insert(t.campeonato)
      .values({ ...configuracao({ ...c, slug }) })
      .returning({ id: t.campeonato.id });
    await validarEGravar(tx, linha.id, null, { ...c, id: linha.id, slug });
    return linha.id;
  });
}

// ---------- API usada pelas telas e ações ----------

export interface ResumoCampeonato {
  id: number;
  slug: string;
  nome: string;
  edicao?: string;
  status: StatusCampeonato;
  modelo: ModeloCampeonato;
  inicio?: string;
  fim?: string;
  escudo?: string;
  duplicadoDe?: number;
}

/** Garante pelo menos um campeonato (instalação nova: arquivo legado ou o padrão). */
export async function garantirCampeonato(db?: Banco): Promise<void> {
  const conexao = db ?? (await banco());
  const [algum] = await conexao.select({ id: t.campeonato.id }).from(t.campeonato).limit(1);
  if (algum) return;
  let inicial = campeonatoPadrao();
  try {
    const legado = JSON.parse(await readFile(ARQUIVO_LEGADO, 'utf8')) as Partial<Campeonato>;
    inicial = { ...inicial, ...legado, versao: 1, id: 0, slug: inicial.slug, status: 'inscricoes', modelo: 'livre', criterios: criteriosCompletos(legado.criterios ?? []) };
  } catch {
    // sem arquivo legado
  }
  try {
    await inserir(conexao, inicial);
  } catch (erro) {
    // Outra requisição criou ao mesmo tempo (slug repetido): basta seguir.
    const [depois] = await conexao.select({ id: t.campeonato.id }).from(t.campeonato).limit(1);
    if (!depois) throw erro;
  }
}

export async function listarCampeonatos(db?: Banco): Promise<ResumoCampeonato[]> {
  const conexao = db ?? (await banco());
  await garantirCampeonato(conexao);
  const linhas = await conexao.select().from(t.campeonato).orderBy(desc(t.campeonato.id));
  return linhas.map((l) => ({
    id: l.id,
    slug: l.slug,
    nome: l.nome,
    edicao: indef(l.edicao),
    status: l.status,
    modelo: l.modelo,
    inicio: indef(l.inicio),
    fim: indef(l.fim),
    escudo: indef(l.escudo),
    duplicadoDe: indef(l.duplicadoDe),
  }));
}

/**
 * Campeonato que o site público mostra: o mais recente em andamento; senão em
 * inscrições; senão o último encerrado. Rascunho nunca aparece.
 */
export function escolherAtual(lista: readonly ResumoCampeonato[]): ResumoCampeonato | null {
  for (const s of ['andamento', 'inscricoes', 'encerrado'] as const) {
    const achado = lista.find((c) => c.status === s);
    if (achado) return achado;
  }
  return null;
}

export async function carregarCampeonato(id: number, db?: Banco): Promise<Campeonato> {
  const conexao = db ?? (await banco());
  const c = await ler(conexao, id);
  if (!c) throw new ErroCampeonato('Campeonato não encontrado.');
  return c;
}

/** Lê, aplica a alteração e grava, tudo numa transação com a linha travada. */
export async function atualizarCampeonato(id: number, alterar: (c: Campeonato) => void, db?: Banco): Promise<Campeonato> {
  const conexao = db ?? (await banco());
  return conexao.transaction(async (tx) => {
    await tx.select({ id: t.campeonato.id }).from(t.campeonato).where(eq(t.campeonato.id, id)).for('update');
    const c = await ler(tx, id);
    if (!c) throw new ErroCampeonato('Campeonato não encontrado.');
    const antes = structuredClone(c);
    alterar(c);
    if (c.slug !== antes.slug) c.slug = await slugLivre(tx, c.slug, id);
    return validarEGravar(tx, id, antes, c);
  });
}

export interface DadosNovoCampeonato {
  nome: string;
  edicao?: string;
  modelo: ModeloCampeonato;
  inicio?: string;
  fim?: string;
  local?: string;
}

/**
 * Programação sugerida para o modelo (grade da comissão: 16:00, grupos 2 × 8, mata-mata 2 × 10).
 * Com o período do campeonato preenchido, os 34 jogos já nascem com horário; o admin ajusta em Partidas.
 */
function programarModelo(c: Campeonato): void {
  c.programacao ??= programacaoPadrao(c.inicio, c.fim, DIAS_DO_MODELO);
  if (!problemaNaProgramacao(c.programacao, DIAS_DO_MODELO)) aplicarProgramacao(c.partidas, c.fases, c.programacao);
}

/** Novo campeonato com as 8 equipes do manual; no modelo oficial, já com os 34 jogos. */
export async function criarCampeonato(dados: DadosNovoCampeonato, db?: Banco): Promise<number> {
  const nome = dados.nome.trim();
  if (!nome) throw new ErroCampeonato('Dê um nome ao campeonato.');
  const c: Campeonato = {
    ...campeonatoPadrao(),
    nome,
    slug: [nome, dados.edicao].filter(Boolean).join(' '),
    edicao: dados.edicao?.trim() || undefined,
    subtitulo: undefined,
    status: 'rascunho',
    modelo: 'livre',
    inicio: dados.inicio || undefined,
    fim: dados.fim || undefined,
    local: dados.local || undefined,
    equipes: equipesDoManual(true),
    fases: [
      { id: novoId(), nome: 'Fase de grupos', tipo: 'grupos' },
      { id: novoId(), nome: 'Mata-mata', tipo: 'mata-mata' },
    ],
  };
  if (dados.modelo === 'copa-jumentus-8') {
    aplicarModelo(c, novoId);
    programarModelo(c);
  }
  return inserir(db ?? (await banco()), c);
}

/**
 * Duplica um campeonato: configuração, fases, zonas, grupos e equipes; elencos
 * se pedido. Nunca partidas, súmulas, pagamentos nem inscrições. Ids novos.
 */
export async function duplicarCampeonato(
  origemId: number,
  dados: { nome: string; edicao?: string; comElencos: boolean },
  db?: Banco,
): Promise<number> {
  const conexao = db ?? (await banco());
  const o = await carregarCampeonato(origemId, conexao);
  const nome = dados.nome.trim() || o.nome;
  const mapa = new Map<string, string>();
  const novo = (antigo: string) => {
    let n = mapa.get(antigo);
    if (!n) mapa.set(antigo, (n = novoId()));
    return n;
  };
  const jogadores = dados.comElencos ? o.jogadores.map((j) => ({ ...j, id: novo(j.id), equipeId: novo(j.equipeId), pago: false })) : [];
  const c: Campeonato = {
    ...o,
    id: 0,
    nome,
    edicao: dados.edicao?.trim() || undefined,
    slug: [nome, dados.edicao].filter(Boolean).join(' '),
    status: 'rascunho',
    duplicadoDe: o.id,
    sorteioOficializadoEm: undefined,
    // Mesmos horários e duração; as datas são da edição nova.
    programacao: o.programacao && { ...o.programacao, dias: o.programacao.dias.map((d) => ({ ...d, data: '' })) },
    // Prêmios são da edição de origem; a nova começa sem.
    premios: undefined,
    // Financeiro é de cada edição: duplicar não copia gastos, patrocínios nem entradas.
    financeiro: undefined,
    historico: undefined,
    equipes: o.equipes.map((e) => ({
      ...e,
      id: novo(e.id),
      capitaoId: dados.comElencos && e.capitaoId ? novo(e.capitaoId) : undefined,
      numeroTabela: undefined,
    })),
    jogadores,
    fases: o.fases.map((f) => ({ ...f, id: novo(f.id), zonas: f.zonas?.map((z) => ({ ...z })), desempates: undefined })),
    grupos: o.grupos.map((g) => ({ ...g, id: novo(g.id), faseId: novo(g.faseId), equipeIds: g.equipeIds.map(novo) })),
    partidas: [],
  };
  return inserir(conexao, c);
}

/** Aplica o modelo oficial a um campeonato que ainda não tem partidas. */
export async function aplicarModeloOficial(id: number, db?: Banco): Promise<Campeonato> {
  return atualizarCampeonato(
    id,
    (c) => {
      try {
        aplicarModelo(c, novoId);
        programarModelo(c);
      } catch (e) {
        throw new ErroCampeonato(e instanceof Error ? e.message : String(e));
      }
    },
    db,
  );
}
