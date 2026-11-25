import { describe, expect, it } from 'vitest';
import {
  financeiroPadrao,
  formatarReais,
  lerReais,
  patrocinadoresPublicos,
  resumirFinanceiro,
  type Financeiro,
} from './financeiro';

let n = 0;
const id = () => `f${++n}`;

describe('financeiro', () => {
  it('modelo da planilha: uniforme de 64 × R$ 78,50 dá R$ 78,50 por atleta', () => {
    const f = financeiroPadrao(id);
    const r = resumirFinanceiro(f, 0);
    expect(r.gastos).toBe(502400);
    expect(r.atletas).toBe(64);
    expect(r.valorPorAtleta).toBe(7850);
    expect(f.patrocinios.map((p) => p.cota)).toEqual([
      'Master (frente)',
      'Costas (1)',
      'Ombro esquerdo',
      'Ombro direito',
      'Manga esquerda',
      'Manga direita',
      'Costas (2)',
      'Calção',
      'Premiação',
    ]);
    expect(f.patrocinios.reduce((t, p) => t + p.valor, 0)).toBe(305000);
  });

  it('patrocínio fechado e entradas abatem do que os atletas pagam; negociando não', () => {
    const f: Financeiro = {
      atletas: 64,
      metaPorAtleta: 7000,
      gastos: [
        { id: 'g1', descricao: 'Uniforme', categoria: 'Uniformes', quantidade: 64, valorUnitario: 7850, status: 'pago' },
        { id: 'g2', descricao: 'Campo', categoria: 'Campo', quantidade: 1, valorUnitario: 200000, status: 'previsto' },
      ],
      patrocinios: [
        { id: 'p1', patrocinador: 'Padaria', cota: 'Master (frente)', valor: 100000, status: 'recebido', exibir: true },
        { id: 'p2', patrocinador: 'Oficina', cota: 'Mangas', valor: 50000, status: 'confirmado', exibir: true },
        { id: 'p3', patrocinador: 'Bar', cota: 'Shorts', valor: 30000, status: 'negociando', exibir: true },
      ],
      entradas: [{ id: 'e1', descricao: 'Rifa', categoria: 'Rifa', valor: 20000, status: 'recebido' }],
    };
    const r = resumirFinanceiro(f, 0, 64 * 7000);
    expect(r.gastos).toBe(702400);
    expect(r.patrocinioFechado).toBe(150000);
    expect(r.patrocinioNegociando).toBe(30000);
    expect(r.aCobrarDosAtletas).toBe(702400 - 150000 - 20000);
    // 532.400 / 64 = 8.318,75 → arredonda para cima: R$ 83,19.
    expect(r.valorPorAtleta).toBe(8319);
    expect(r.faltaParaMeta).toBe(532400 - 7000 * 64);
    expect(r.caixa).toBe(64 * 7000 + 100000 + 20000 - 502400);
  });

  it('sem número de atletas informado, usa o elenco cadastrado', () => {
    const f: Financeiro = { gastos: [{ id: 'g', descricao: 'x', categoria: 'Outros', quantidade: 1, valorUnitario: 1000, status: 'previsto' }], patrocinios: [], entradas: [] };
    expect(resumirFinanceiro(f, 10).valorPorAtleta).toBe(100);
    expect(resumirFinanceiro(f, 0).valorPorAtleta).toBeNull();
  });

  it('site mostra só patrocinador fechado, com nome e marcado para exibir, master primeiro', () => {
    const f = financeiroPadrao(id);
    expect(patrocinadoresPublicos(f)).toEqual([]);
    f.patrocinios[1] = { ...f.patrocinios[1], patrocinador: 'Oficina', status: 'confirmado' };
    f.patrocinios[0] = { ...f.patrocinios[0], patrocinador: 'Padaria', status: 'recebido' };
    f.patrocinios[2] = { ...f.patrocinios[2], patrocinador: 'Bar', status: 'confirmado', exibir: false };
    expect(patrocinadoresPublicos(f).map((p) => p.patrocinador)).toEqual(['Padaria', 'Oficina']);
  });

  it('quem fechou duas cotas aparece uma vez, na de mais destaque', () => {
    const f = financeiroPadrao(id);
    const premiacao = f.patrocinios.findIndex((p) => p.cota === 'Premiação');
    f.patrocinios[premiacao] = { ...f.patrocinios[premiacao], patrocinador: 'EM Empreendimentos', status: 'confirmado' };
    f.patrocinios[0] = { ...f.patrocinios[0], patrocinador: 'em empreendimentos ', status: 'confirmado' };
    expect(patrocinadoresPublicos(f).map((p) => p.cota)).toEqual(['Master (frente)']);
  });

  it('lê valores em reais em vários formatos', () => {
    expect(lerReais('78,50')).toBe(7850);
    expect(lerReais('R$ 1.234,56')).toBe(123456);
    expect(lerReais('1234.5')).toBe(123450);
    expect(lerReais('70')).toBe(7000);
    expect(lerReais('')).toBeNull();
    expect(lerReais('abc')).toBeNull();
    expect(formatarReais(7850).replace(/\s/g, ' ')).toBe('R$ 78,50');
  });
});
