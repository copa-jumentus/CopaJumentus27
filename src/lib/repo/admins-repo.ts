// Contas de admin no banco (CLAUDE.md §4.1). As regras de senha, bloqueio e
// sessão ficam em src/lib/auth/; aqui só a leitura e a escrita, sempre com a
// linha travada quando a escrita depende do estado atual.

import { asc, eq, sql } from 'drizzle-orm';
import { banco, type Banco } from '@/lib/db/cliente';
import { admin } from '@/lib/db/schema';
import { ESTADO_LIMPO, aposFalha, estaBloqueado } from '@/lib/auth/bloqueio';
import { gastarTempoDeVerificacao, gerarHash, gerarSenhaTemporaria, problemaNaNovaSenha, verificarSenha } from '@/lib/auth/senha';
import type { Sessao } from '@/lib/auth/sessao';

export type Admin = typeof admin.$inferSelect;

/** Erro de regra da conta, com mensagem para mostrar ao admin. */
export class ErroConta extends Error {}

/** Mesma mensagem para usuário inexistente, desativado, bloqueado e senha errada. */
export const ERRO_LOGIN = 'Usuário ou senha inválidos. Depois de 5 tentativas erradas seguidas, o acesso fica bloqueado por 15 minutos.';

export function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase();
}

const USUARIO_VALIDO = /^[a-z0-9][a-z0-9._-]{1,31}$/;

async function conexao(db?: Banco): Promise<Banco> {
  return db ?? (await banco());
}

export async function listarAdmins(db?: Banco): Promise<Admin[]> {
  return (await conexao(db)).select().from(admin).orderBy(asc(admin.usuario));
}

export async function buscarAdmin(id: number, db?: Banco): Promise<Admin | null> {
  const [linha] = await (await conexao(db)).select().from(admin).where(eq(admin.id, id));
  return linha ?? null;
}

/**
 * Confere usuário e senha. Senha errada conta tentativa; a 5ª seguida bloqueia
 * por 15 minutos. Retorna a conta ou null (sem dizer o motivo).
 */
export async function autenticar(usuario: string, senha: string, agora = new Date(), db?: Banco): Promise<Admin | null> {
  const c = await conexao(db);
  const nome = normalizarUsuario(usuario);
  return c.transaction(async (tx) => {
    const [conta] = await tx.select().from(admin).where(eq(admin.usuario, nome)).for('update');
    if (!conta || !conta.ativo || estaBloqueado(conta, agora)) {
      await gastarTempoDeVerificacao(senha);
      return null;
    }
    if (!(await verificarSenha(senha, conta.senhaHash))) {
      const novo = aposFalha(conta, agora);
      await tx.update(admin).set(novo).where(eq(admin.id, conta.id));
      return null;
    }
    if (conta.tentativasFalhas !== 0 || conta.bloqueadoAte !== null) {
      await tx.update(admin).set(ESTADO_LIMPO).where(eq(admin.id, conta.id));
    }
    return { ...conta, ...ESTADO_LIMPO };
  });
}

/** Conta da sessão, se ainda vale: ativa e com a mesma versão de sessão. */
export async function adminDaSessao(sessao: Sessao, db?: Banco): Promise<Admin | null> {
  const conta = await buscarAdmin(sessao.adminId, db);
  if (!conta || !conta.ativo || conta.versaoSessao !== sessao.versao) return null;
  return conta;
}

/**
 * Troca a senha da própria conta. Com `senhaAtual`, confere antes (Minha conta);
 * na troca obrigatória a pessoa acabou de entrar com a temporária.
 * Incrementa a versão da sessão: as outras sessões da conta caem. Retorna a conta nova.
 */
export async function trocarSenha(
  adminId: number,
  dados: { nova: string; confirmacao: string; senhaAtual?: string },
  agora = new Date(),
  db?: Banco,
): Promise<Admin> {
  const c = await conexao(db);
  return c.transaction(async (tx) => {
    const [conta] = await tx.select().from(admin).where(eq(admin.id, adminId)).for('update');
    if (!conta || !conta.ativo) throw new ErroConta('Conta não encontrada.');
    if (dados.senhaAtual !== undefined && !(await verificarSenha(dados.senhaAtual, conta.senhaHash))) {
      throw new ErroConta('A senha atual está errada.');
    }
    const problema = await problemaNaNovaSenha(dados.nova, dados.confirmacao, conta.senhaHash);
    if (problema) throw new ErroConta(problema);
    const [nova] = await tx
      .update(admin)
      .set({
        senhaHash: await gerarHash(dados.nova),
        deveTrocarSenha: false,
        versaoSessao: sql`${admin.versaoSessao} + 1`,
        senhaAlteradaEm: agora,
        ...ESTADO_LIMPO,
      })
      .where(eq(admin.id, adminId))
      .returning();
    return nova;
  });
}

/** Cria a conta com senha temporária (mostrada uma vez) e troca obrigatória. */
export async function criarAdmin(
  usuario: string,
  nome: string,
  db?: Banco,
  papel: Admin['papel'] = 'admin',
): Promise<{ admin: Admin; senhaTemporaria: string }> {
  const u = normalizarUsuario(usuario);
  if (!USUARIO_VALIDO.test(u)) {
    throw new ErroConta('Usuário: de 2 a 32 caracteres, só letras sem acento, números, ponto, hífen e sublinhado.');
  }
  const n = nome.trim() || u.charAt(0).toUpperCase() + u.slice(1);
  const senhaTemporaria = gerarSenhaTemporaria();
  const c = await conexao(db);
  const [criado] = await c
    .insert(admin)
    .values({ usuario: u, nome: n, papel, senhaHash: await gerarHash(senhaTemporaria), deveTrocarSenha: true })
    .onConflictDoNothing({ target: admin.usuario })
    .returning();
  if (!criado) throw new ErroConta(`Já existe um admin com o usuário "${u}".`);
  return { admin: criado, senhaTemporaria };
}

/** Nova senha temporária: força a troca, desbloqueia e encerra as sessões da conta. */
export async function redefinirSenha(adminId: number, db?: Banco): Promise<{ admin: Admin; senhaTemporaria: string }> {
  const senhaTemporaria = gerarSenhaTemporaria();
  const c = await conexao(db);
  const [conta] = await c
    .update(admin)
    .set({
      senhaHash: await gerarHash(senhaTemporaria),
      deveTrocarSenha: true,
      versaoSessao: sql`${admin.versaoSessao} + 1`,
      ...ESTADO_LIMPO,
    })
    .where(eq(admin.id, adminId))
    .returning();
  if (!conta) throw new ErroConta('Conta não encontrada.');
  return { admin: conta, senhaTemporaria };
}

/** Desativa a conta e derruba as sessões dela. Ninguém desativa a si mesmo nem o último admin ativo. */
export async function desativarAdmin(adminId: number, porAdminId: number, db?: Banco): Promise<void> {
  if (adminId === porAdminId) throw new ErroConta('Você não pode desativar a própria conta.');
  const c = await conexao(db);
  await c.transaction(async (tx) => {
    // Trava todas as contas ativas: duas desativações ao mesmo tempo não zeram os admins.
    const ativos = await tx.select({ id: admin.id, papel: admin.papel }).from(admin).where(eq(admin.ativo, true)).for('update');
    const alvo = ativos.find((a) => a.id === adminId);
    if (!alvo) throw new ErroConta('Conta não encontrada ou já desativada.');
    // Conta de mesário não administra nada: o que não pode zerar são os admins.
    if (alvo.papel === 'admin' && ativos.filter((a) => a.papel === 'admin').length <= 1) {
      throw new ErroConta('Não dá para desativar o último admin ativo.');
    }
    await tx
      .update(admin)
      .set({ ativo: false, versaoSessao: sql`${admin.versaoSessao} + 1` })
      .where(eq(admin.id, adminId));
  });
}
