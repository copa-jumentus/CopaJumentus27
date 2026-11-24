// Fila do Modo Mesário no celular (localStorage): operações tocadas na beira do
// campo que ainda não chegaram ao servidor. Sobrevive a recarregar a página, a
// fechar o navegador e à queda da internet. Só a tela do mesário usa (§4.2:
// nenhum componente importa localStorage direto).

import type { OperacaoMesario } from '@/lib/domain/campeonato/mesario';

const CHAVE = 'copa-jumentus:fila-mesario:v1';

export interface ItemFila {
  campeonatoId: number;
  op: OperacaoMesario;
}

function ehItem(x: unknown): x is ItemFila {
  return typeof x === 'object' && x !== null && 'campeonatoId' in x && 'op' in x;
}

export function lerFila(): ItemFila[] {
  try {
    const bruto: unknown = JSON.parse(window.localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(bruto) ? bruto.filter(ehItem) : [];
  } catch {
    return [];
  }
}

export function gravarFila(itens: readonly ItemFila[]): boolean {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(itens));
    return true;
  } catch {
    // Sem localStorage (aba anônima cheia, bloqueio): a fila vive só na memória.
    return false;
  }
}
