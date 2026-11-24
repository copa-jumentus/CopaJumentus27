// Páginas públicas: só leitura. Roda no banco de teste (npm run e2e) e também
// contra o site no ar (npm run e2e:producao), no desktop e no celular.

import { expect, test } from '@playwright/test';

const PAGINAS = [
  { caminho: '/', titulo: /Copa Jumentus/i },
  { caminho: '/classificacao', titulo: /Tabela|Classificação/i },
  { caminho: '/jogos', titulo: /Jogos/i },
  { caminho: '/rankings', titulo: /Rankings/i },
  { caminho: '/equipes', titulo: /Equipes/i },
  { caminho: '/regulamento', titulo: /Regulamento/i },
  { caminho: '/edicoes', titulo: /Edições/i },
];

/** Nada que entregue o nível de um jogador pode aparecer em página pública. */
const SINAIS_DE_ESTRELA = /★|\bestrelas?\b/i;

test.describe('páginas públicas', () => {
  for (const { caminho, titulo } of PAGINAS) {
    test(`${caminho} abre, sem erro e sem estrelas`, async ({ page }) => {
      const erros: string[] = [];
      page.on('pageerror', (e) => erros.push(e.message));
      const resposta = await page.goto(caminho);
      expect(resposta?.status(), `status de ${caminho}`).toBeLessThan(400);
      await expect(page.locator('main')).toContainText(titulo);
      await expect(page.locator('body')).not.toContainText(SINAIS_DE_ESTRELA);
      // Tela de erro do site ("Falta técnica") não pode aparecer.
      await expect(page.locator('body')).not.toContainText('Falta técnica');
      expect(erros, `erros de JavaScript em ${caminho}`).toEqual([]);
    });
  }

  test('regulamento traz as regras que o sistema aplica', async ({ page }) => {
    await page.goto('/regulamento');
    for (const secao of ['Pontuação', 'Desempate na classificação', 'Cartões e suspensões']) {
      await expect(page.getByRole('heading', { name: secao })).toBeVisible();
    }
  });

  test('menu leva às páginas principais', async ({ page }) => {
    // No desktop o menu fica na barra de cima; no celular, na barra inferior. As duas usam links visíveis.
    for (const [item, url] of [['Tabela', /\/classificacao/], ['Jogos', /\/jogos/], ['Rankings', /\/rankings/]] as const) {
      await page.goto('/');
      await page.getByRole('link', { name: item, exact: true }).locator('visible=true').first().click();
      await expect(page).toHaveURL(url);
    }
  });

  test('prévia do link (WhatsApp) com imagem e título', async ({ page, request }) => {
    await page.goto('/');
    const imagem = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(imagem).toBeTruthy();
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /COPA JUMENTUS/i);
    const resposta = await request.get('/opengraph-image.jpg');
    expect(resposta.ok()).toBe(true);
  });

  test('área dos admins pede login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/entrar/);
    await page.goto('/sorteio');
    await expect(page).toHaveURL(/\/admin\/entrar/);
  });

  test('login errado mostra a mensagem genérica', async ({ page }) => {
    await page.goto('/admin/entrar');
    // Usuário que não existe: não bloqueia nenhuma conta real em produção.
    await page.fill('input[name=usuario]', 'e2e-usuario-inexistente');
    await page.fill('input[name=senha]', 'senha-errada-qualquer');
    await page.getByRole('button', { name: /Entrar/i }).click();
    await expect(page.locator('body')).toContainText(/Usuário ou senha/i);
    await expect(page).toHaveURL(/\/admin\/entrar/);
  });

  test('olhinho mostra e esconde a senha', async ({ page }) => {
    await page.goto('/admin/entrar');
    const campo = page.locator('input[name=senha]');
    await campo.fill('abc');
    await expect(campo).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /Mostrar senha/i }).click();
    await expect(campo).toHaveAttribute('type', 'text');
  });
});
