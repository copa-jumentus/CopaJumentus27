import { describe, expect, it } from 'vitest';
import { ordenarEdicoes } from './edicoes';

describe('ordenarEdicoes', () => {
  it('mais recente primeiro pelo ano, mesmo com a atual criada antes das antigas', () => {
    const lista = [
      { id: 3, edicao: '2026', inicio: undefined },
      { id: 2, edicao: '2025', inicio: undefined },
      { id: 1, edicao: '2027', inicio: '2027-01-16' },
    ];
    expect(ordenarEdicoes(lista).map((e) => e.edicao)).toEqual(['2027', '2026', '2025']);
  });

  it('sem ano na edição, usa a data de início e depois o id', () => {
    const lista = [
      { id: 1, edicao: undefined, inicio: '2024-05-01' },
      { id: 2, edicao: 'Verão', inicio: '2025-01-10' },
      { id: 3, edicao: undefined, inicio: undefined },
      { id: 4, edicao: undefined, inicio: undefined },
    ];
    expect(ordenarEdicoes(lista).map((e) => e.id)).toEqual([2, 1, 4, 3]);
  });
});
