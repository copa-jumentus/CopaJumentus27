// Prepara o banco descartável dos testes de ponta a ponta: apaga dados/e2e-pglite,
// aplica as migrações e cria a conta de admin "e2e" com a senha inicial conhecida
// (troca obrigatória no primeiro acesso, como uma conta nova de verdade).
// Roda antes do `next dev` do Playwright (playwright.config.ts → webServer).

import { rm } from 'node:fs/promises';
import path from 'node:path';
import { hashScrypt } from '../scripts/criar-admin.mjs';

const pasta = process.env.PGLITE_PASTA;
if (!pasta || !pasta.includes('e2e')) {
  console.error('preparar: PGLITE_PASTA precisa apontar para a pasta dos testes (ex.: dados/e2e-pglite).');
  process.exit(1);
}
await rm(pasta, { recursive: true, force: true });

const { PGlite } = await import('@electric-sql/pglite');
const { drizzle } = await import('drizzle-orm/pglite');
const { migrate } = await import('drizzle-orm/pglite/migrator');
const pg = new PGlite(pasta);
await migrate(drizzle(pg), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
await pg.query('insert into admin (usuario, nome, senha_hash, deve_trocar_senha) values ($1, $2, $3, true)', [
  'e2e',
  'Teste E2E',
  hashScrypt(process.env.E2E_SENHA_INICIAL ?? 'senha-inicial-e2e'),
]);
await pg.close();
console.log(`preparar: banco de teste pronto em ${pasta}, admin "e2e" criado.`);
