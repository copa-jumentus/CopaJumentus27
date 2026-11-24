// Testes de ponta a ponta (pedido do operador em 19/11/2026: "um script de
// automação que abre o site e testa todas as funcionalidades").
//
// - `npm run e2e`: sobe o site num banco descartável (dados/e2e-pglite) e roda
//   tudo: páginas públicas e o fluxo completo do admin (conta, campeonato,
//   inscrições, sorteio, cerimônia, súmula, financeiro, artes).
// - `npm run e2e:producao`: só as páginas públicas, só leitura, contra o site no ar.
//   Nunca roda o fluxo do admin em produção.

import { defineConfig, devices } from '@playwright/test';

const PORTA = 3200;
const producao = process.env.E2E_URL;
const baseURL = producao ?? `http://localhost:${PORTA}`;

export default defineConfig({
  testDir: 'e2e',
  // O fluxo do admin depende da ordem (cria o campeonato, sorteia, joga…).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Sem roleta animada na cerimônia: os testes não precisam esperar a animação.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Em máquinas sem o Chromium do Playwright, E2E_CHROME aponta para um Chrome instalado.
    launchOptions: process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {},
  },
  projects: [
    { name: 'publico', testMatch: /publico\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', testMatch: /publico\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    ...(producao ? [] : [{ name: 'admin', testMatch: /admin\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } }]),
  ],
  webServer: producao
    ? undefined
    : {
        command: `node e2e/preparar.mjs && npx next dev -p ${PORTA}`,
        url: `http://localhost:${PORTA}/regulamento`,
        timeout: 240_000,
        reuseExistingServer: false,
        env: {
          PGLITE_PASTA: 'dados/e2e-pglite',
          SESSAO_SEGREDO: 'segredo-dos-testes-e2e-com-mais-de-32-caracteres',
          E2E_SENHA_INICIAL: 'senha-inicial-e2e',
          DATABASE_URL: '',
        },
      },
});
