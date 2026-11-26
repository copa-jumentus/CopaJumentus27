// Fluxo completo do admin, em ordem, no banco descartável (dados/e2e-pglite):
// primeiro acesso com troca de senha → campeonato no modelo oficial → inscrições
// com as cotas fechadas → pote sem estrelas → cerimônia → oficializar → T1 a T8 →
// súmula com gol e assistência → modo mesário → tabela e rankings públicos → financeiro →
// artes → conta de mesário restrita → sair.
// Nunca roda contra produção (playwright.config.ts só inclui este projeto localmente).

import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const USUARIO = 'e2e';
const SENHA_INICIAL = process.env.E2E_SENHA_INICIAL ?? 'senha-inicial-e2e';
const SENHA_NOVA = 'senha-nova-do-e2e-2027';
const CSV = path.join(__dirname, 'inscritos-e2e.csv');

test.describe.configure({ mode: 'serial' });

let page: Page;
/** Quem marcou o gol na súmula, para conferir nos rankings. */
let artilheiro = '';

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('dialog', (d) => void d.accept());
});

test.afterAll(async () => {
  await page.close();
});

async function irPara(caminho: string) {
  await page.goto(caminho);
  await expect(page.locator('body')).not.toContainText('Falta técnica');
}

/** Toast de confirmação das ações do admin. */
async function confirmado(texto: string | RegExp) {
  await expect(page.getByRole('status').filter({ hasText: texto })).toBeVisible();
}

test('primeiro acesso: login e troca obrigatória de senha', async () => {
  await irPara('/admin/entrar');
  await page.fill('input[name=usuario]', USUARIO.toUpperCase()); // usuário sem diferenciar maiúsculas
  await page.fill('input[name=senha]', SENHA_INICIAL);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Pop-up que não fecha até trocar a senha.
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeVisible();

  await dialogo.locator('input[name=nova]').fill(SENHA_NOVA);
  await dialogo.locator('input[name=confirmacao]').fill(SENHA_NOVA);
  await dialogo.getByRole('button', { name: /Salvar nova senha/ }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible();
});

test('cria o campeonato no modelo oficial e coloca em andamento', async () => {
  await irPara('/admin/campeonatos');
  const form = page.locator('form', { has: page.locator('input[name=inicio]') });
  await form.locator('input[name=nome]').fill('Copa E2E');
  await form.locator('input[name=edicao]').fill('2099');
  await form.locator('input[name=inicio]').fill('2099-01-16');
  await form.locator('input[name=fim]').fill('2099-01-17');
  await form.locator('input[name=modelo][value="copa-jumentus-8"]').check();
  await form.locator('button[type=submit]').click();
  await confirmado(/34 jogos/);

  await irPara('/admin/campeonato');
  await page.locator('select[name=status]').selectOption('andamento');
  await page.getByRole('button', { name: 'Salvar' }).first().click();
  await expect(page.locator('select[name=status]')).toHaveValue('andamento');
});

test('importa as inscrições e as cotas de estrelas fecham', async () => {
  await irPara('/admin/inscricoes');
  await page.setInputFiles('input[name=arquivo]', CSV);
  await page.locator('form', { has: page.locator('input[name=arquivo]') }).locator('button[type=submit]').click();
  await expect(page.getByText('Cotas de estrelas · fechadas')).toBeVisible();
  await expect(page.locator('main')).toContainText('16/16');
});

test('pote do sorteio sem estrelas, com 56 de linha e 8 goleiros', async () => {
  await irPara('/sorteio');
  const corpo = page.locator('body');
  await expect(corpo).toContainText('56 jogadores de linha e 8 goleiros');
  await expect(corpo).not.toContainText('★');
  // Nem nos dados da página.
  expect(await page.content()).not.toMatch(/"estrelas"/);
});

test('cerimônia: sorteia, revela todos e oficializa no campeonato', async () => {
  await irPara('/cerimonia');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Sortear agora' }).click();
  await expect(page.locator('body')).not.toContainText('★');

  // Primeiro goleiro, com os dois botões: nome e depois time.
  await page.getByRole('button', { name: /Sortear goleiro/ }).click();
  await page.getByRole('button', { name: /Sortear time/ }).click();

  // Modo automático: o próximo goleiro sai sozinho, nome e time; depois pausa.
  await page.getByRole('button', { name: 'Modo automático' }).click();
  await expect(page.locator('body')).toContainText('#2', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Pausar automático' }).click();
  await expect(page.getByRole('button', { name: 'Modo automático' })).toBeVisible();

  // O resto pela tecla Espaço (como o operador no projetor) até o fim.
  const oficializar = page.getByRole('button', { name: 'Oficializar no campeonato' });
  for (let i = 0; i < 200 && !(await oficializar.isVisible()); i++) {
    const revelarTodos = page.getByRole('button', { name: 'Revelar todos' });
    if (await revelarTodos.isVisible()) await revelarTodos.click();
    else await page.keyboard.press('Space');
    await page.waitForTimeout(150);
  }
  await expect(page.locator('body')).toContainText('mesma composição de níveis');
  await oficializar.click();
  await expect(page.getByRole('button', { name: 'Oficializado' })).toBeVisible();
});

test('sorteia T1 a T8', async () => {
  await irPara('/admin/partidas');
  await page.getByRole('button', { name: 'Sortear T1 a T8' }).click();
  await expect(page.getByRole('button', { name: /Refazer sorteio de T1 a T8/ })).toBeVisible();
});

test('súmula: começa o jogo 1, lança gol com assistência e encerra', async () => {
  await irPara('/admin/partidas');
  // Navega pelo endereço do link (o clique às vezes chega antes da página do dev server compilar).
  await irPara(String(await page.getByRole('link', { name: 'Súmula / placar' }).first().getAttribute('href')));
  await page.getByRole('button', { name: 'Ao vivo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ao vivo', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Lançamento rápido: jogador → Gol → assistência.
  const autor = page.locator('ol[aria-label="Lançamento"] + ul button').first();
  artilheiro = (await autor.locator('span').nth(1).innerText()).trim();
  await autor.click();
  await page.getByRole('button', { name: 'Gol', exact: true }).click();
  await expect(page.getByText('Quem deu a assistência?')).toBeVisible();
  await page.locator('p:has-text("Quem deu a assistência") ~ ul button.btn-mini').first().click();
  await confirmado(/1/);

  await page.getByRole('button', { name: 'Encerrada', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Encerrada', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('modo mesário: cronômetro, lances com minuto, internet caindo e voltando, fim do jogo', async ({ browser, baseURL }) => {
  const context = page.context();
  await page.setViewportSize({ width: 390, height: 844 });
  await irPara('/admin/partidas');
  const sumula2 = await page.getByRole('link', { name: 'Súmula / placar' }).nth(1).getAttribute('href');
  expect(sumula2).toBeTruthy();
  await irPara(String(sumula2).replace('/admin/partidas/', '/admin/mesario/'));
  const conexao = page.getByTestId('conexao');
  const cronometro = page.getByTestId('cronometro');

  await page.getByRole('button', { name: 'Começar 1º tempo' }).click();
  await expect(page.getByText('1º tempo', { exact: true })).toBeVisible();
  await expect(conexao).toHaveText(/Online/);
  await expect(cronometro).not.toHaveText('00:00', { timeout: 5_000 });

  // Gol com assistência, em três toques.
  const jogadores = page.locator('section[aria-label="Escolha o jogador"]');
  await jogadores.locator('div').first().getByRole('button').nth(1).click();
  await page.getByRole('button', { name: 'Gol', exact: true }).click();
  await page.getByRole('button', { name: 'Sem assistência' }).locator('xpath=..').getByRole('button').nth(1).click();
  await expect(page.getByLabel('Placar 1 a 0')).toBeVisible();
  await expect(page.getByText(/Entra no minuto|Gol ·/).first()).toBeVisible();

  // Internet cai: o lance fica na fila, aparece na tela e o placar não espera.
  await context.setOffline(true);
  await jogadores.locator('div').nth(1).getByRole('button').nth(1).click();
  await page.getByRole('button', { name: 'Gol', exact: true }).click();
  await page.getByRole('button', { name: 'Sem assistência' }).click();
  await expect(page.getByLabel('Placar 1 a 1')).toBeVisible();
  await expect(conexao).toHaveText(/Sem internet · 1 na fila/, { timeout: 15_000 });
  await expect(page.getByText('Na fila', { exact: true })).toBeVisible();

  // Volta a internet: a fila sobe sozinha e o gol entra uma vez só.
  await context.setOffline(false);
  await expect(conexao).toHaveText(/Online/, { timeout: 20_000 });
  await expect(page.getByText('Na fila', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Placar 1 a 1')).toBeVisible();
  await expect(page.locator('section[aria-labelledby=titulo-lances] li')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('mesario.png'), fullPage: true });

  // Pausa, fim do 1º tempo (dois toques), 2º tempo e fim do jogo.
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByText('1º tempo · pausado')).toBeVisible();
  await page.getByRole('button', { name: 'Retomar' }).click();
  await page.getByRole('button', { name: 'Fim do 1º tempo' }).click();
  await page.getByRole('button', { name: 'Confirmar fim do 1º tempo' }).click();
  await expect(page.getByText('Intervalo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Começar 2º tempo' }).click();
  await expect(page.getByText('2º tempo', { exact: true })).toBeVisible();

  // Telão público mostra o jogo ao vivo com o placar.
  // Telão é público: abre num navegador sem login.
  const publico = await browser.newContext({ baseURL });
  const telao = await publico.newPage();
  await telao.goto('/telao');
  await expect(telao.getByTestId('placar-telao')).toHaveText(/1\s*:\s*1/);
  await expect(telao.getByText('2º tempo')).toBeVisible();
  await telao.screenshot({ path: test.info().outputPath('telao.png') });
  await publico.close();

  await page.getByRole('button', { name: 'Fim do jogo' }).click();
  await page.getByRole('button', { name: 'Confirmar fim do jogo' }).click();
  await expect(page.getByText('Jogo encerrado.').first()).toBeVisible();
  // A fila precisa esvaziar antes de sair da tela.
  await expect(page.getByTestId('conexao')).toHaveText('Online');
  await page.setViewportSize({ width: 1366, height: 900 });
});

test('site público mostra o resultado: tabela, jogos e artilharia', async () => {
  await irPara('/classificacao');
  await expect(page.locator('main')).toContainText('Grupo Único');
  await irPara('/jogos');
  await expect(page.locator('main')).toContainText('2 de 34 jogos encerrados');
  await irPara('/rankings');
  await expect(page.locator('main')).toContainText(artilheiro);
  await irPara('/regulamento');
  await expect(page.locator('main')).toContainText('34 jogos');

  // Página pública do jogo 1: qualquer pessoa baixa a arte pronta do resultado.
  await irPara('/jogos');
  await irPara(String(await page.locator('a[href^="/jogos/"]').first().getAttribute('href')));
  await expect(page.getByRole('heading', { name: 'Arte do jogo' })).toBeVisible();
  const [arte] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar feed' }).click()]);
  expect(arte.suggestedFilename()).toMatch(/^copa-jumentus-j1-[a-z]+-x-[a-z]+-feed\.png$/);
});

test('financeiro: começa pelo modelo da planilha e calcula o valor por atleta', async () => {
  await irPara('/admin/financeiro');
  await page.getByRole('button', { name: 'Começar com o modelo da planilha' }).click();
  await expect(page.locator('input[name=descricao][value="Uniformes Camizzeria"]')).toHaveCount(1);
  // 64 atletas × R$ 78,50 de uniforme: R$ 78,50 por atleta.
  await expect(page.locator('main')).toContainText('R$ 5.024,00 divididos por 64 atletas');
});

test('artes: seções com escolhas, prévias e download', async () => {
  await irPara('/admin/artes');
  // Resultados abre na última rodada com jogo, com "Todos da rodada" e feed + stories.
  await expect(page.getByRole('radio', { name: 'Todos da rodada' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('canvas')).toHaveCount(2);
  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar 2 PNGs (.zip)' }).click()]);
  expect(zip.suggestedFilename()).toBe('copa-jumentus-resultados.zip');

  await page.getByRole('radio', { name: 'Só feed' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  const [rodada] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar PNG' }).click()]);
  expect(rodada.suggestedFilename()).toBe('copa-jumentus-resultados-rodada-1-feed.png');

  // Um jogo específico da rodada.
  await page.getByRole('radio', { name: /^J2 · / }).click();
  const [jogo] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar PNG' }).click()]);
  expect(jogo.suggestedFilename()).toMatch(/^copa-jumentus-j2-[a-z]+-x-[a-z]+-feed\.png$/);

  await page.getByRole('button', { name: /Classificação/ }).click();
  const [tabela] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar PNG' }).click()]);
  expect(tabela.suggestedFilename()).toBe('copa-jumentus-classificacao-grupo-unico-feed.png');

  await page.getByRole('button', { name: /^Artilharia$/ }).click();
  await page.getByRole('radio', { name: 'Só stories' }).click();
  const [ranking] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar PNG' }).click()]);
  expect(ranking.suggestedFilename()).toBe('copa-jumentus-artilharia-stories.png');

  // Melhor da partida: sem foto, feed + stories; com foto, o stories "Craque do jogo" com o nome.
  await page.getByRole('button', { name: 'Melhor da partida' }).click();
  await expect(page.getByText('Escolha o jogador.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Jogador' }).selectOption({ index: 1 });
  await page.getByRole('radio', { name: 'Feed + stories' }).click();
  await expect(page.locator('canvas')).toHaveCount(2);
  await page.setInputFiles('input[type=file]', path.join(__dirname, '..', 'public', 'imagens', 'escudos', 'inter-miami.webp'));
  const [craque] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar PNG' }).click()]);
  expect(craque.suggestedFilename()).toMatch(/^copa-jumentus-craque-do-jogo-j\d+-[a-z0-9-]+-stories\.png$/);
});

test('conta de mesário: só entra no Modo Mesário', async ({ browser, baseURL }) => {
  await irPara('/admin/admins');
  const form = page.locator('form').filter({ has: page.locator('select[name=papel]') });
  await form.locator('input[name=usuario]').fill('mesa1');
  await form.locator('input[name=nome]').fill('Mesa do campo');
  await form.locator('select[name=papel]').selectOption('mesario');
  await form.getByRole('button', { name: 'Criar conta' }).click();
  const senha = (await form.locator('p.numero').textContent())?.trim() ?? '';
  expect(senha.length).toBeGreaterThan(8);
  await irPara('/admin/admins');
  await expect(page.getByText(/mesa1 · Mesário/)).toBeVisible();

  // Outro navegador: o celular do mesário.
  const ctx = await browser.newContext({ baseURL });
  const cel = await ctx.newPage();
  await cel.goto('/admin/entrar');
  await cel.fill('input[name=usuario]', 'mesa1');
  await cel.fill('input[name=senha]', senha);
  await cel.getByRole('button', { name: 'Entrar' }).click();
  await expect(cel).toHaveURL(/\/admin\/mesario/);
  const dialogo = cel.getByRole('dialog');
  await dialogo.locator('input[name=nova]').fill('senha-do-mesario-2027');
  await dialogo.locator('input[name=confirmacao]').fill('senha-do-mesario-2027');
  await dialogo.getByRole('button', { name: /Salvar nova senha/ }).click();
  await expect(dialogo).toBeHidden();
  await expect(cel.getByRole('heading', { name: 'Jogos' })).toBeVisible();

  // Abre um jogo: sem atalho para a súmula completa.
  await cel.locator('a[href^="/admin/mesario/"]').filter({ hasText: 'J3' }).first().click();
  await expect(cel.getByTestId('cronometro')).toBeVisible();
  await expect(cel.getByRole('link', { name: 'Voltar para a lista de jogos' })).toBeVisible();
  await expect(cel.getByRole('link', { name: 'Voltar para a súmula completa' })).toHaveCount(0);

  // O resto do admin manda de volta para a lista de jogos.
  for (const rota of ['/admin', '/admin/financeiro', '/admin/inscricoes', '/admin/admins', '/sorteio', '/cerimonia', '/admin/partidas']) {
    await cel.goto(rota);
    await expect(cel).toHaveURL(/\/admin\/mesario$/);
  }
  await ctx.close();
});

test('sair encerra a sessão', async () => {
  await irPara('/admin');
  await page.getByRole('button', { name: 'Sair' }).click();
  // Sair apaga o cookie e volta para o Início.
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await irPara('/admin');
  await expect(page).toHaveURL(/\/admin\/entrar/);
});
