'use server';

// Login, troca de senha e gestão das contas de admin (CLAUDE.md §4.1).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { destinoSeguro } from '@/lib/auth/sessao';
import { encerrarSessao, exigirAdmin, exigirMesario, iniciarSessao } from '@/lib/auth/servidor';
import {
  ERRO_LOGIN,
  ErroConta,
  autenticar,
  criarAdmin,
  desativarAdmin,
  redefinirSenha,
  trocarSenha,
} from '@/lib/repo/admins-repo';

function texto(f: FormData, campo: string): string {
  const v = f.get(campo);
  return typeof v === 'string' ? v : '';
}

function comParametro(url: string, nome: string, valor: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${nome}=${encodeURIComponent(valor)}`;
}

// ---------- sessão ----------

export async function entrar(f: FormData): Promise<void> {
  const volta = destinoSeguro(texto(f, 'volta'));
  const conta = await autenticar(texto(f, 'usuario'), texto(f, 'senha'));
  if (!conta) redirect(comParametro(`/admin/entrar?volta=${encodeURIComponent(volta)}`, 'erro', ERRO_LOGIN));
  await iniciarSessao(conta);
  // Conta de mesário só tem o Modo Mesário: vai direto para a lista de jogos.
  redirect(conta.papel === 'mesario' && !volta.startsWith('/admin/mesario') ? '/admin/mesario' : volta);
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect('/');
}

// ---------- senha da própria conta ----------

export interface EstadoTroca {
  erro?: string;
}

/**
 * Troca da senha. Sem `senhaAtual` no formulário, só vale para a troca obrigatória
 * (a pessoa acabou de entrar com a temporária); em Minha conta a atual é exigida.
 */
export async function trocarMinhaSenha(_anterior: EstadoTroca, f: FormData): Promise<EstadoTroca> {
  const conta = await exigirMesario({ permitirTrocaPendente: true });
  const obrigatoria = conta.deveTrocarSenha;
  let nova;
  try {
    nova = await trocarSenha(conta.id, {
      nova: texto(f, 'nova'),
      confirmacao: texto(f, 'confirmacao'),
      senhaAtual: obrigatoria ? undefined : texto(f, 'senhaAtual'),
    });
  } catch (e) {
    if (e instanceof ErroConta) return { erro: e.message };
    throw e;
  }
  // Esta sessão segue com a versão nova; as outras sessões da conta caem.
  await iniciarSessao(nova);
  revalidatePath('/admin', 'layout');
  redirect(comParametro(destinoSeguro(texto(f, 'volta')), 'ok', 'Senha alterada.'));
}

// ---------- gestão das contas ----------

export type EstadoGestao = { erro?: string; senhaTemporaria?: { usuario: string; senha: string } };

export async function criarAdminAcao(_anterior: EstadoGestao, f: FormData): Promise<EstadoGestao> {
  await exigirAdmin();
  try {
    const papel = texto(f, 'papel') === 'mesario' ? 'mesario' : 'admin';
    const { admin, senhaTemporaria } = await criarAdmin(texto(f, 'usuario'), texto(f, 'nome'), undefined, papel);
    revalidatePath('/admin/admins');
    // A senha só volta nesta resposta: não vai para URL, log nem banco.
    return { senhaTemporaria: { usuario: admin.usuario, senha: senhaTemporaria } };
  } catch (e) {
    if (e instanceof ErroConta) return { erro: e.message };
    throw e;
  }
}

export async function redefinirSenhaAcao(_anterior: EstadoGestao, f: FormData): Promise<EstadoGestao> {
  await exigirAdmin();
  try {
    const { admin, senhaTemporaria } = await redefinirSenha(Number(texto(f, 'adminId')));
    revalidatePath('/admin/admins');
    return { senhaTemporaria: { usuario: admin.usuario, senha: senhaTemporaria } };
  } catch (e) {
    if (e instanceof ErroConta) return { erro: e.message };
    throw e;
  }
}

export async function desativarAdminAcao(f: FormData): Promise<void> {
  const eu = await exigirAdmin();
  let erro: string | null = null;
  try {
    await desativarAdmin(Number(texto(f, 'adminId')), eu.id);
  } catch (e) {
    if (e instanceof ErroConta) erro = e.message;
    else throw e;
  }
  revalidatePath('/admin/admins');
  redirect(erro ? comParametro('/admin/admins', 'erro', erro) : '/admin/admins?ok=Conta%20desativada.');
}
