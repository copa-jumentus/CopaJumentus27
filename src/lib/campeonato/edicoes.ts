// Ordem das edições no histórico. Puro e testado.

import type { ResumoCampeonato } from '@/lib/repo/campeonato-repo';

/**
 * Mais recente primeiro, pelo ano da edição (as edições antigas foram inseridas depois da
 * atual, então a ordem de criação não serve); sem ano, pela data de início e depois pelo id.
 */
export function ordenarEdicoes<T extends Pick<ResumoCampeonato, 'id' | 'edicao' | 'inicio'>>(lista: readonly T[]): T[] {
  const ano = (e: T) => Number(/\d{4}/.exec(e.edicao ?? '')?.[0] ?? e.inicio?.slice(0, 4) ?? 0);
  return [...lista].sort((a, b) => ano(b) - ano(a) || (b.inicio ?? '').localeCompare(a.inicio ?? '') || b.id - a.id);
}
