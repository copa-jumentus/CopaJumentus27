'use server';

// Server actions do Modo Mesário. Diferente das outras ações do admin, estas não
// redirecionam: a tela chama direto (fila offline) e precisa da resposta para
// saber se a operação entrou, se foi recusada pela regra ou se a internet caiu
// (nesse caso a chamada nem chega aqui e a fila tenta de novo).

import { revalidatePath } from 'next/cache';
import { exigirAdmin } from '@/lib/auth/servidor';
import { aplicarOperacao, estadoMesario, lerOperacao, type EstadoMesario } from '@/lib/domain/campeonato/mesario';
import { ErroDoJogo } from '@/lib/domain/campeonato/relogio';
import { atualizarCampeonato, carregarCampeonato, ErroCampeonato } from '@/lib/repo/campeonato-repo';

export type RespostaMesario = { ok: true; mensagem: string; estado: EstadoMesario } | { ok: false; erro: string; estado?: EstadoMesario };

export async function operarMesario(campeonatoId: number, entrada: unknown): Promise<RespostaMesario> {
  await exigirAdmin();
  const op = lerOperacao(entrada);
  if (!op || !Number.isInteger(campeonatoId)) return { ok: false, erro: 'Operação inválida.' };
  let mensagem = '';
  try {
    const c = await atualizarCampeonato(campeonatoId, (doc) => {
      mensagem = aplicarOperacao(doc, op, Date.now());
    });
    revalidatePath('/', 'layout');
    return { ok: true, mensagem, estado: estadoMesario(c, op.partidaId, Date.now()) };
  } catch (e) {
    // Erro de regra (súmula, cronômetro ou trava do chaveamento): volta para a tela,
    // visível, e a operação sai da fila. Qualquer outro erro (banco fora do ar) sobe:
    // o celular trata como falha de conexão e tenta de novo.
    if (e instanceof ErroDoJogo || e instanceof ErroCampeonato) {
      return { ok: false, erro: e.message, estado: await lerEstado(campeonatoId, op.partidaId) };
    }
    throw e;
  }
}

/** Estado atual da partida (para o mesário acompanhar lances lançados em outro celular). */
export async function lerEstadoMesario(campeonatoId: number, partidaId: string): Promise<EstadoMesario | null> {
  await exigirAdmin();
  return (await lerEstado(campeonatoId, partidaId)) ?? null;
}

async function lerEstado(campeonatoId: number, partidaId: string): Promise<EstadoMesario | undefined> {
  try {
    return estadoMesario(await carregarCampeonato(campeonatoId), partidaId, Date.now());
  } catch {
    return undefined;
  }
}
