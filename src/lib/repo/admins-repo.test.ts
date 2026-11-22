import { beforeEach, describe, expect, it } from 'vitest';
import { bancoDeTeste, type Banco } from '@/lib/db/cliente';
import { sql } from 'drizzle-orm';
import { admin } from '@/lib/db/schema';
import { BLOQUEIO_MS } from '@/lib/auth/bloqueio';
import {
  ErroConta,
  adminDaSessao,
  autenticar,
  criarAdmin,
  desativarAdmin,
  listarAdmins,
  redefinirSenha,
  trocarSenha,
} from './admins-repo';

let db: Banco;
beforeEach(async () => {
  db = await bancoDeTeste();
});

const t0 = new Date('2026-11-17T12:00:00Z');

describe('contas de admin', () => {
  it('a tabela recebe o insert do arquivo de contas iniciais', async () => {
    await db.execute(
      `insert into admin (usuario, nome, senha_hash, deve_trocar_senha) values ('guilherme', 'Guilherme', 'scrypt$16384$8$1$AAECAwQFBgcICQoLDA0ODw$HXWHHXy_x79glNuat1wjTCAYP-k4q4sBxNzxXa4HbBdH32bOUjRF8zFuvwt9xHvByKuhN831XENXKgd0rcc9Og', true)`,
    );
    const conta = await autenticar('Guilherme', 'senha-de-teste-123', t0, db);
    expect(conta).toMatchObject({ usuario: 'guilherme', deveTrocarSenha: true, versaoSessao: 1, ativo: true });
  });

  it('usuário sem diferenciar maiúsculas; inexistente e senha errada dão o mesmo resultado', async () => {
    const { senhaTemporaria } = await criarAdmin('Rommel', '', db);
    expect(await autenticar('  ROMMEL ', senhaTemporaria, t0, db)).toMatchObject({ usuario: 'rommel', nome: 'Rommel' });
    expect(await autenticar('rommel', 'errada-errada', t0, db)).toBeNull();
    expect(await autenticar('ninguem', senhaTemporaria, t0, db)).toBeNull();
  });

  it('5 erros seguidos bloqueiam por 15 minutos, mesmo com a senha certa', async () => {
    const { senhaTemporaria } = await criarAdmin('vini', 'Vini', db);
    for (let i = 0; i < 5; i++) expect(await autenticar('vini', 'errada-errada', t0, db)).toBeNull();
    expect(await autenticar('vini', senhaTemporaria, new Date(t0.getTime() + BLOQUEIO_MS - 1000), db)).toBeNull();
    const depois = await autenticar('vini', senhaTemporaria, new Date(t0.getTime() + BLOQUEIO_MS + 1000), db);
    expect(depois).toMatchObject({ tentativasFalhas: 0, bloqueadoAte: null });
  });

  it('acerto zera a contagem de erros', async () => {
    const { senhaTemporaria } = await criarAdmin('arthur', 'Arthur', db);
    for (let i = 0; i < 4; i++) await autenticar('arthur', 'errada-errada', t0, db);
    await autenticar('arthur', senhaTemporaria, t0, db);
    for (let i = 0; i < 4; i++) await autenticar('arthur', 'errada-errada', t0, db);
    expect(await autenticar('arthur', senhaTemporaria, t0, db)).not.toBeNull();
  });

  it('trocar a senha incrementa versao_sessao e derruba a sessão antiga', async () => {
    const { admin: conta, senhaTemporaria } = await criarAdmin('domingos', 'Domingos', db);
    const sessaoAntiga = { adminId: conta.id, versao: conta.versaoSessao, expira: Date.now() + 60_000 };
    expect(await adminDaSessao(sessaoAntiga, db)).not.toBeNull();

    const nova = await trocarSenha(conta.id, { nova: 'senha-nova-123', confirmacao: 'senha-nova-123' }, t0, db);
    expect(nova).toMatchObject({ deveTrocarSenha: false, versaoSessao: 2 });
    expect(nova.senhaAlteradaEm).toEqual(t0);
    expect(await adminDaSessao(sessaoAntiga, db)).toBeNull();
    expect(await adminDaSessao({ ...sessaoAntiga, versao: 2 }, db)).not.toBeNull();
    expect(await autenticar('domingos', senhaTemporaria, t0, db)).toBeNull();
    expect(await autenticar('domingos', 'senha-nova-123', t0, db)).not.toBeNull();
  });

  it('troca recusa senha curta, confirmação diferente, igual à atual e senha atual errada', async () => {
    const { admin: conta, senhaTemporaria } = await criarAdmin('francisco', 'Francisco', db);
    const tentar = (d: Parameters<typeof trocarSenha>[1]) => trocarSenha(conta.id, d, t0, db);
    await expect(tentar({ nova: 'curta', confirmacao: 'curta' })).rejects.toThrow(ErroConta);
    await expect(tentar({ nova: 'senha-nova-123', confirmacao: 'senha-nova-124' })).rejects.toThrow(/confirmação/);
    await expect(tentar({ nova: senhaTemporaria, confirmacao: senhaTemporaria })).rejects.toThrow(/diferente/);
    await expect(tentar({ nova: 'senha-nova-123', confirmacao: 'senha-nova-123', senhaAtual: 'errada' })).rejects.toThrow(/atual/);
    const [linha] = await listarAdmins(db);
    expect(linha).toMatchObject({ deveTrocarSenha: true, versaoSessao: 1 });
  });

  it('criar conta: usuário único, minúsculo e com caracteres simples', async () => {
    await criarAdmin('vitinho', 'Vitinho', db);
    await expect(criarAdmin('VITINHO', 'Outro', db)).rejects.toThrow(/Já existe/);
    await expect(criarAdmin('joão', 'João', db)).rejects.toThrow(/Usuário/);
    await expect(criarAdmin('x', 'X', db)).rejects.toThrow(/Usuário/);
  });

  it('redefinir senha força a troca, desbloqueia e encerra as sessões', async () => {
    const { admin: conta } = await criarAdmin('guilherme', 'Guilherme', db);
    await trocarSenha(conta.id, { nova: 'senha-nova-123', confirmacao: 'senha-nova-123' }, t0, db);
    for (let i = 0; i < 5; i++) await autenticar('guilherme', 'errada-errada', t0, db);
    const { admin: depois, senhaTemporaria } = await redefinirSenha(conta.id, db);
    expect(depois).toMatchObject({ deveTrocarSenha: true, versaoSessao: 3, tentativasFalhas: 0, bloqueadoAte: null });
    expect(await autenticar('guilherme', senhaTemporaria, t0, db)).not.toBeNull();
  });

  it('desativar: derruba a sessão, não entra mais, não vale para si mesmo nem para o último ativo', async () => {
    const { admin: a, senhaTemporaria } = await criarAdmin('rommel', 'Rommel', db);
    const { admin: b } = await criarAdmin('vini', 'Vini', db);
    await expect(desativarAdmin(a.id, a.id, db)).rejects.toThrow(/própria/);
    await desativarAdmin(a.id, b.id, db);
    expect(await adminDaSessao({ adminId: a.id, versao: 1, expira: Date.now() + 60_000 }, db)).toBeNull();
    expect(await autenticar('rommel', senhaTemporaria, t0, db)).toBeNull();
    // Sobrou só b ativo: ninguém pode desativá-lo (nem a própria conta, nem uma inativa).
    await expect(desativarAdmin(b.id, a.id, db)).rejects.toThrow(/último/);
  });

  it('conta de mesário não conta como "último admin" e não é admin por padrão', async () => {
    const { admin: a } = await criarAdmin('rommel', 'Rommel', db);
    const { admin: m } = await criarAdmin('mesa', 'Mesa', db, 'mesario');
    expect(a.papel).toBe('admin');
    expect(m.papel).toBe('mesario');
    // Com um admin e um mesário ativos, o admin continua sendo o último admin.
    await expect(desativarAdmin(a.id, m.id, db)).rejects.toThrow(/último/);
    await desativarAdmin(m.id, a.id, db);
  });

  it('o banco recusa papel fora de admin/mesário', async () => {
    await expect(db.execute(sql`insert into admin (usuario, nome, senha_hash, papel) values ('x1', 'X', 'x', 'dono')`)).rejects.toThrow();
  });

  it('o banco recusa usuário com maiúscula inserido por fora', async () => {
    await expect(db.insert(admin).values({ usuario: 'Maiusculo', nome: 'M', senhaHash: 'x' })).rejects.toThrow();
  });
});

describe('acesso (exigirAdmin)', () => {
  const segredo = 's'.repeat(40);
  it('recusa ações com troca pendente; libera só a troca; versão antiga cai', async () => {
    const { decidirAcesso } = await import('@/lib/auth/acesso');
    const { assinarSessao } = await import('@/lib/auth/sessao');
    const { admin: conta } = await criarAdmin('guilherme', 'Guilherme', db);
    const token = await assinarSessao({ adminId: conta.id, versao: 1, expira: Date.now() + 60_000 }, segredo);

    expect(await decidirAcesso(token, segredo, {}, Date.now(), db)).toMatchObject({ tipo: 'troca-pendente' });
    expect(await decidirAcesso(token, segredo, { permitirTrocaPendente: true }, Date.now(), db)).toMatchObject({ tipo: 'ok' });

    await trocarSenha(conta.id, { nova: 'senha-nova-123', confirmacao: 'senha-nova-123' }, t0, db);
    expect(await decidirAcesso(token, segredo, {}, Date.now(), db)).toEqual({ tipo: 'sem-sessao' });
    const novo = await assinarSessao({ adminId: conta.id, versao: 2, expira: Date.now() + 60_000 }, segredo);
    expect(await decidirAcesso(novo, segredo, {}, Date.now(), db)).toMatchObject({ tipo: 'ok', admin: { usuario: 'guilherme' } });
    expect(await decidirAcesso(novo, 'outro'.repeat(10), {}, Date.now(), db)).toEqual({ tipo: 'sem-sessao' });
  });

  it('conta de mesário só passa onde o papel é aceito', async () => {
    const { decidirAcesso } = await import('@/lib/auth/acesso');
    const { assinarSessao } = await import('@/lib/auth/sessao');
    const { admin: conta } = await criarAdmin('mesa', 'Mesa', db, 'mesario');
    await trocarSenha(conta.id, { nova: 'senha-nova-123', confirmacao: 'senha-nova-123' }, t0, db);
    const token = await assinarSessao({ adminId: conta.id, versao: 2, expira: Date.now() + 60_000 }, segredo);

    expect(await decidirAcesso(token, segredo, {}, Date.now(), db)).toMatchObject({ tipo: 'sem-permissao' });
    expect(await decidirAcesso(token, segredo, { papeis: ['admin'] }, Date.now(), db)).toMatchObject({ tipo: 'sem-permissao' });
    expect(await decidirAcesso(token, segredo, { papeis: ['admin', 'mesario'] }, Date.now(), db)).toMatchObject({ tipo: 'ok', admin: { papel: 'mesario' } });
  });
});
