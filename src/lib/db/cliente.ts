// Conexão com o banco (CLAUDE.md §9).
// - Com DATABASE_URL (Neon na Vercel): Postgres de verdade via postgres.js.
//   As migrações rodam no build (scripts/migrar.mjs).
// - Sem DATABASE_URL (desenvolvimento): PGlite, um Postgres embutido gravado em
//   dados/pglite (ou em PGLITE_PASTA). As migrações rodam sozinhas na primeira conexão.

import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Banco = PgDatabase<PgQueryResultHKT, typeof schema>;

const PASTA_MIGRACOES = path.join(process.cwd(), 'drizzle');

async function conectarPostgres(url: string): Promise<Banco> {
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  // prepare: false porque a URL "pooled" da Neon passa por PgBouncer.
  const sql = postgres(url, { max: 5, prepare: false });
  return drizzle(sql, { schema });
}

async function conectarPglite(pasta: string | undefined): Promise<Banco> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const cliente = pasta ? new PGlite(pasta) : new PGlite();
  const db = drizzle(cliente, { schema });
  await migrate(db, { migrationsFolder: PASTA_MIGRACOES });
  return db;
}

/** Banco em memória, já migrado. Só para testes. */
export function bancoDeTeste(): Promise<Banco> {
  return conectarPglite(undefined);
}

// Uma conexão por processo (e que sobrevive ao hot reload do next dev).
const global = globalThis as typeof globalThis & { __bancoCopa?: Promise<Banco> };

export function banco(): Promise<Banco> {
  if (!global.__bancoCopa) {
    const url = process.env.DATABASE_URL;
    global.__bancoCopa = url
      ? conectarPostgres(url)
      : // PGLITE_PASTA: banco descartável dos testes de ponta a ponta (e2e/), sem tocar no seu dados/pglite.
        conectarPglite(process.env.PGLITE_PASTA || path.join(process.cwd(), 'dados', 'pglite'));
    global.__bancoCopa.catch(() => {
      global.__bancoCopa = undefined;
    });
  }
  return global.__bancoCopa;
}
