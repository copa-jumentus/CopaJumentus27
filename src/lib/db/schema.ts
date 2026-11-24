// Esquema relacional (Postgres). Ver CLAUDE.md §4.2 e §9.
// Nomes em português, como o domínio. Ids são texto: slugs para equipes,
// ids curtos gerados pelo servidor para o resto.

import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { Relogio } from '../domain/campeonato/relogio';
import type { Programacao } from '../domain/campeonato/programacao';
import type { Financeiro } from '../domain/campeonato/financeiro';
import type { Historico, Premio } from '../domain/campeonato/tipos';

/** Um campeonato (edição) por linha. Vários por instalação (CLAUDE.md §8.6). */
export const campeonato = pgTable(
  'campeonato',
  {
    id: smallint('id').primaryKey().generatedByDefaultAsIdentity(),
    /** Default só para o código antigo (que não conhece a coluna) conseguir gravar. */
    slug: text('slug').notNull().unique().default(sql`gen_random_uuid()::text`),
    nome: text('nome').notNull(),
    edicao: text('edicao'),
    status: text('status', { enum: ['rascunho', 'inscricoes', 'andamento', 'encerrado'] }).notNull().default('rascunho'),
    modelo: text('modelo', { enum: ['copa-jumentus-8', 'livre'] }).notNull().default('livre'),
    banner: text('banner'),
    escudo: text('escudo'),
    duplicadoDe: smallint('duplicado_de'),
    subtitulo: text('subtitulo'),
    inicio: text('inicio'),
    fim: text('fim'),
    local: text('local'),
    pontosVitoria: smallint('pontos_vitoria').notNull().default(3),
    pontosEmpate: smallint('pontos_empate').notNull().default(1),
    pontosDerrota: smallint('pontos_derrota').notNull().default(0),
    /** Ordem dos critérios de desempate. */
    criterios: jsonb('criterios').$type<string[]>().notNull(),
    valorInscricao: numeric('valor_inscricao', { precision: 10, scale: 2 }).notNull().default('0'),
    sorteioOficializadoEm: timestamp('sorteio_oficializado_em', { withTimezone: true }),
    /** Início de cada dia, tempos e intervalos (lib/domain/campeonato/programacao.ts). Formato antigo convertido na leitura. */
    programacao: jsonb('programacao').$type<Programacao>(),
    /** Premiação individual (lib/domain/campeonato/tipos.ts, Premio). */
    premios: jsonb('premios').$type<Premio[]>(),
    /** Financeiro da edição: gastos, patrocínios, entradas (lib/domain/campeonato/financeiro.ts). */
    financeiro: jsonb('financeiro').$type<Financeiro>(),
    /** Pódio e rankings lançados à mão de edição antiga (Historico). */
    historico: jsonb('historico').$type<Historico>(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('campeonato_status', sql`${t.status} in ('rascunho', 'inscricoes', 'andamento', 'encerrado')`),
    check('campeonato_modelo', sql`${t.modelo} in ('copa-jumentus-8', 'livre')`),
  ],
);

// campeonato_id nas tabelas filhas: default 1 só para a transição (o código
// antigo, de campeonato único, grava sem a coluna). O código atual sempre informa.
const doCampeonato = () =>
  smallint('campeonato_id')
    .notNull()
    .default(1)
    .references(() => campeonato.id, { onDelete: 'restrict' });

/**
 * Inscrições: o cadastro do sorteio (substitui a aba INSCRITOS da planilha).
 * Estrelas ficam só aqui e nunca saem em página pública.
 */
export const inscricao = pgTable(
  'inscricao',
  {
    id: text('id').primaryKey(),
    campeonatoId: doCampeonato(),
    nome: text('nome').notNull(),
    apelido: text('apelido'),
    // 'GOL' ou 'LIN' desde 18/11/2026 (só a marca de goleiro); ZAG/MEI/ATA são de dados antigos.
    posicao: text('posicao', { enum: ['GOL', 'LIN', 'ZAG', 'MEI', 'ATA'] }),
    estrelas: smallint('estrelas'),
    /** Nome do time do qual é capitão (vazio = não é capitão). */
    capitaoDe: text('capitao_de'),
    status: text('status', { enum: ['confirmado', 'espera'] }).notNull().default('confirmado'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('inscricao_estrelas', sql`${t.estrelas} is null or ${t.estrelas} between 1 and 6`), index('inscricao_campeonato').on(t.campeonatoId)],
);

export const equipe = pgTable(
  'equipe',
  {
  id: text('id').primaryKey(),
  campeonatoId: doCampeonato(),
  nome: text('nome').notNull(),
  sigla: text('sigla').notNull(),
  escudo: text('escudo'),
  corPrimaria: text('cor_primaria').notNull(),
  corSecundaria: text('cor_secundaria').notNull(),
  corTexto: text('cor_texto').notNull(),
  capitaoId: text('capitao_id'),
  /** T1 a T8 do modelo oficial (sorteado no admin). */
  numeroTabela: smallint('numero_tabela'),
  ordem: smallint('ordem').notNull().default(0),
  },
  (t) => [
    index('equipe_campeonato').on(t.campeonatoId),
    check('equipe_numero_tabela', sql`${t.numeroTabela} is null or ${t.numeroTabela} between 1 and 8`),
  ],
);

/** Jogador do campeonato (elenco). Vem do sorteio oficializado ou do cadastro manual. */
export const jogador = pgTable(
  'jogador',
  {
    id: text('id').primaryKey(),
    nome: text('nome').notNull(),
    equipeId: text('equipe_id')
      .notNull()
      .references(() => equipe.id, { onDelete: 'restrict' }),
    posicao: text('posicao', { enum: ['GOL', 'LIN', 'ZAG', 'MEI', 'ATA'] }).notNull(),
    numero: smallint('numero'),
    pago: boolean('pago').notNull().default(false),
    ordem: integer('ordem').notNull().default(0),
  },
  (t) => [index('jogador_equipe').on(t.equipeId)],
);

export const fase = pgTable(
  'fase',
  {
    id: text('id').primaryKey(),
    campeonatoId: doCampeonato(),
    nome: text('nome').notNull(),
    tipo: text('tipo', { enum: ['grupos', 'mata-mata'] }).notNull(),
    ordem: smallint('ordem').notNull(),
    /** [{de, ate, zona: 'semifinal'|'repescagem'|'eliminado'}] */
    zonas: jsonb('zonas').$type<Array<{ de: number; ate: number; zona: 'semifinal' | 'repescagem' | 'eliminado' }>>(),
    /** Desempates decididos à mão: listas ordenadas de equipes totalmente empatadas. */
    desempates: jsonb('desempates').$type<string[][]>(),
  },
  (t) => [index('fase_campeonato').on(t.campeonatoId)],
);

type OrigemJson =
  | { tipo: 'tabela'; numero: number }
  | { tipo: 'posicao'; faseId: string; posicao: number }
  | { tipo: 'vencedor' | 'perdedor'; partidaNumero: number };

export const grupo = pgTable('grupo', {
  id: text('id').primaryKey(),
  faseId: text('fase_id')
    .notNull()
    .references(() => fase.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  ordem: smallint('ordem').notNull(),
});

export const grupoEquipe = pgTable(
  'grupo_equipe',
  {
    grupoId: text('grupo_id')
      .notNull()
      .references(() => grupo.id, { onDelete: 'cascade' }),
    equipeId: text('equipe_id')
      .notNull()
      .references(() => equipe.id, { onDelete: 'cascade' }),
    ordem: smallint('ordem').notNull(),
  },
  (t) => [primaryKey({ columns: [t.grupoId, t.equipeId] })],
);

export const partida = pgTable(
  'partida',
  {
    id: text('id').primaryKey(),
    faseId: text('fase_id')
      .notNull()
      .references(() => fase.id, { onDelete: 'restrict' }),
    grupoId: text('grupo_id').references(() => grupo.id, { onDelete: 'set null' }),
    rotulo: text('rotulo'),
    numero: smallint('numero'),
    rodada: smallint('rodada'),
    dia: smallint('dia'),
    campo: text('campo'),
    /** Vazio em partida com origem: os participantes são calculados (chaveamento.ts). */
    mandanteId: text('mandante_id').references(() => equipe.id, { onDelete: 'restrict' }),
    visitanteId: text('visitante_id').references(() => equipe.id, { onDelete: 'restrict' }),
    origemMandante: jsonb('origem_mandante').$type<OrigemJson>(),
    origemVisitante: jsonb('origem_visitante').$type<OrigemJson>(),
    goleiroMandanteId: text('goleiro_mandante_id').references(() => jogador.id, { onDelete: 'set null' }),
    goleiroVisitanteId: text('goleiro_visitante_id').references(() => jogador.id, { onDelete: 'set null' }),
    /** Data e hora local, formato do input datetime-local (AAAA-MM-DDTHH:mm). */
    dataHora: text('data_hora'),
    local: text('local'),
    status: text('status', { enum: ['agendada', 'ao-vivo', 'encerrada'] }).notNull().default('agendada'),
    /** Cronômetro do Modo Mesário (lib/domain/campeonato/relogio.ts). */
    relogio: jsonb('relogio').$type<Relogio>(),
    golsMandante: smallint('gols_mandante').notNull().default(0),
    golsVisitante: smallint('gols_visitante').notNull().default(0),
    penaltisMandante: smallint('penaltis_mandante'),
    penaltisVisitante: smallint('penaltis_visitante'),
    ordem: integer('ordem').notNull().default(0),
  },
  (t) => [index('partida_fase').on(t.faseId), check('partida_equipes_diferentes', sql`${t.mandanteId} <> ${t.visitanteId}`)],
);

/** Súmula: um evento por linha. Placar da partida é mantido junto (CLAUDE.md §8.3). */
export const evento = pgTable(
  'evento',
  {
    id: text('id').primaryKey(),
    partidaId: text('partida_id')
      .notNull()
      .references(() => partida.id, { onDelete: 'cascade' }),
    tipo: text('tipo', { enum: ['gol', 'gol-contra', 'gol_penalti', 'penalti_perdido', 'amarelo', 'vermelho', 'defesa'] }).notNull(),
    jogadorId: text('jogador_id')
      .notNull()
      .references(() => jogador.id, { onDelete: 'restrict' }),
    equipeId: text('equipe_id')
      .notNull()
      .references(() => equipe.id, { onDelete: 'restrict' }),
    assistenciaId: text('assistencia_id').references(() => jogador.id, { onDelete: 'set null' }),
    minuto: smallint('minuto'),
    ordem: integer('ordem').notNull().default(0),
  },
  (t) => [index('evento_partida').on(t.partidaId), index('evento_jogador').on(t.jogadorId)],
);

/**
 * Contas de admin (CLAUDE.md §1 e §4.1). A plateia não tem login.
 * `versao_sessao` entra no cookie: incrementar encerra todas as sessões da conta.
 */
export const admin = pgTable(
  'admin',
  {
    id: serial('id').primaryKey(),
    /** Sempre minúsculo; o login não diferencia maiúsculas. */
    usuario: text('usuario').notNull().unique(),
    nome: text('nome').notNull(),
    /** scrypt$N$r$p$<sal base64url>$<chave base64url> (src/lib/auth/senha.ts). */
    senhaHash: text('senha_hash').notNull(),
    deveTrocarSenha: boolean('deve_trocar_senha').notNull().default(true),
    versaoSessao: integer('versao_sessao').notNull().default(1),
    ativo: boolean('ativo').notNull().default(true),
    /** admin: tudo; mesario: só o Modo Mesário (pedido do operador em 21/11/2026). */
    papel: text('papel', { enum: ['admin', 'mesario'] }).notNull().default('admin'),
    tentativasFalhas: integer('tentativas_falhas').notNull().default(0),
    bloqueadoAte: timestamp('bloqueado_ate', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    senhaAlteradaEm: timestamp('senha_alterada_em', { withTimezone: true }),
  },
  (t) => [
    check('admin_usuario_minusculo', sql`${t.usuario} = lower(${t.usuario})`),
    check('admin_papel_valido', sql`${t.papel} in ('admin', 'mesario')`),
  ],
);
