// Decisão de acesso do admin, pura (testável sem Next). Ver exigirAdmin() em servidor.ts.

import type { Banco } from '@/lib/db/cliente';
import { adminDaSessao, type Admin } from '@/lib/repo/admins-repo';
import { lerSessao } from './sessao';

export type Papel = Admin['papel'];

export type Acesso =
  | { tipo: 'ok'; admin: Admin }
  | { tipo: 'sem-sessao' }
  | { tipo: 'troca-pendente'; admin: Admin }
  /** Conta válida, mas o papel dela não entra aqui (mesário fora do Modo Mesário). */
  | { tipo: 'sem-permissao'; admin: Admin };

export interface OpcoesAcesso {
  permitirTrocaPendente?: boolean;
  /** Papéis aceitos. Padrão: só admin (contas de mesário ficam de fora de tudo que não as aceita). */
  papeis?: readonly Papel[];
}

/**
 * Cookie → conta. O middleware já conferiu assinatura e validade; aqui confere
 * no banco que a conta está ativa e com a mesma versão de sessão.
 * Com troca de senha pendente, nenhuma ação é aceita (só a própria troca).
 */
export async function decidirAcesso(
  token: string | undefined,
  segredo: string | null,
  opcoes: OpcoesAcesso = {},
  agora = Date.now(),
  db?: Banco,
): Promise<Acesso> {
  const sessao = await lerSessao(token, segredo, agora);
  if (!sessao) return { tipo: 'sem-sessao' };
  const admin = await adminDaSessao(sessao, db);
  if (!admin) return { tipo: 'sem-sessao' };
  if (!(opcoes.papeis ?? ['admin']).includes(admin.papel)) return { tipo: 'sem-permissao', admin };
  if (admin.deveTrocarSenha && !opcoes.permitirTrocaPendente) return { tipo: 'troca-pendente', admin };
  return { tipo: 'ok', admin };
}
