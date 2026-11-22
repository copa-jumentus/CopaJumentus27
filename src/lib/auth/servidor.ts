// Sessão do admin no servidor (server actions e layouts). Ver CLAUDE.md §4.1.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Admin } from '@/lib/repo/admins-repo';
import { decidirAcesso, type OpcoesAcesso } from './acesso';
import { COOKIE_ADMIN, DURACAO_SESSAO_MS, assinarSessao, segredoDaSessao } from './sessao';

export const ERRO_TROCA_PENDENTE = 'Troque a senha temporária antes de qualquer outra ação.';

/**
 * Conta do admin logado. Sem sessão válida, vai para o login.
 * Com troca de senha pendente, recusa (volta ao painel, onde o pop-up pede a troca),
 * a não ser com `permitirTrocaPendente` (layout do admin e a ação de troca).
 */
export async function exigirAdmin(opcoes: OpcoesAcesso = {}): Promise<Admin> {
  const loja = await cookies();
  const acesso = await decidirAcesso(loja.get(COOKIE_ADMIN)?.value, segredoDaSessao(), opcoes);
  if (acesso.tipo === 'sem-sessao') redirect('/admin/entrar');
  // Conta de mesário fora do Modo Mesário: volta para a lista de jogos dele.
  if (acesso.tipo === 'sem-permissao') redirect('/admin/mesario');
  if (acesso.tipo === 'troca-pendente') redirect(`${acesso.admin.papel === 'mesario' ? '/admin/mesario' : '/admin'}?erro=${encodeURIComponent(ERRO_TROCA_PENDENTE)}`);
  return acesso.admin;
}

export async function iniciarSessao(admin: Pick<Admin, 'id' | 'versaoSessao'>): Promise<void> {
  const segredo = segredoDaSessao();
  if (!segredo) throw new Error('Defina SESSAO_SEGREDO (32+ caracteres) nas variáveis de ambiente do servidor.');
  const token = await assinarSessao({ adminId: admin.id, versao: admin.versaoSessao, expira: Date.now() + DURACAO_SESSAO_MS }, segredo);
  const loja = await cookies();
  loja.set(COOKIE_ADMIN, token, {
    httpOnly: true,
    // secure sempre: navegadores aceitam cookie secure em http://localhost.
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_MS / 1000,
  });
}

export async function encerrarSessao(): Promise<void> {
  const loja = await cookies();
  loja.delete(COOKIE_ADMIN);
}

/** Admin ou mesário: só para o Modo Mesário (lista de jogos, tela do jogo e as ações dele) e a troca de senha. */
export async function exigirMesario(opcoes: Omit<OpcoesAcesso, 'papeis'> = {}): Promise<Admin> {
  return exigirAdmin({ ...opcoes, papeis: ['admin', 'mesario'] });
}
