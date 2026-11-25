// Financeiro do campeonato (pedido do operador em 18/11/2026; base: planilha
// "Financeiro Copa Jumentus 2027"). Gastos, patrocínios e outras entradas, com o
// resumo que diz quanto cada atleta precisa pagar. Puro e testado.
// Valores sempre em centavos (inteiros), para não errar arredondamento.

export const CATEGORIAS_GASTO = ['Campo', 'Arbitragem', 'Premiação', 'Fotografia', 'Água e descartáveis', 'Uniformes', 'Outros'] as const;
/**
 * Cotas da edição 2027 (tabela aprovada pelo operador em 25/11/2026), na ordem de destaque,
 * com o valor sugerido em centavos. Mangas, Shorts e Apoio ficam no fim para dados antigos.
 */
export const COTAS_PADRAO = [
  ['Master (frente)', 60000],
  ['Costas (1)', 35000],
  ['Ombro esquerdo', 30000],
  ['Ombro direito', 30000],
  ['Manga esquerda', 30000],
  ['Manga direita', 30000],
  ['Costas (2)', 30000],
  ['Calção', 30000],
  ['Premiação', 30000],
] as const;
export const COTAS_PATROCINIO = [...COTAS_PADRAO.map(([cota]) => cota), 'Mangas', 'Shorts', 'Apoio'] as const;
export const CATEGORIAS_ENTRADA = ['Doação', 'Rifa', 'Venda', 'Outros'] as const;

export type StatusGasto = 'previsto' | 'pago';
export type StatusPatrocinio = 'negociando' | 'confirmado' | 'recebido';
export type StatusEntrada = 'previsto' | 'recebido';

export interface Gasto {
  id: string;
  descricao: string;
  categoria: string;
  quantidade: number;
  /** Centavos por unidade. */
  valorUnitario: number;
  status: StatusGasto;
}

export interface Patrocinio {
  id: string;
  /** Nome do patrocinador; "A definir" enquanto a cota não foi vendida. */
  patrocinador: string;
  cota: string;
  /** Centavos. */
  valor: number;
  status: StatusPatrocinio;
  /** Logo (caminho em /public ou URL) e site/Instagram, para o espaço dos patrocinadores. */
  logo?: string;
  link?: string;
  /** Aparece no site público (só com status confirmado ou recebido). */
  exibir: boolean;
}

export interface Entrada {
  id: string;
  descricao: string;
  categoria: string;
  /** Centavos. */
  valor: number;
  status: StatusEntrada;
}

export interface Financeiro {
  /** Quantos atletas dividem a conta (sem valor, usa o elenco cadastrado). */
  atletas?: number;
  /** Quanto se quer cobrar de cada atleta (centavos), para calcular a meta de patrocínio. */
  metaPorAtleta?: number;
  gastos: Gasto[];
  patrocinios: Patrocinio[];
  entradas: Entrada[];
}

export const totalGasto = (g: Gasto): number => g.quantidade * g.valorUnitario;

/** Patrocínio que já pode ser contado: confirmado ou recebido. */
export const patrocinioFechado = (p: Patrocinio): boolean => p.status === 'confirmado' || p.status === 'recebido';

export interface ResumoFinanceiro {
  atletas: number;
  gastos: number;
  gastosPagos: number;
  patrocinioFechado: number;
  patrocinioRecebido: number;
  patrocinioNegociando: number;
  entradas: number;
  entradasRecebidas: number;
  /** Gastos menos patrocínios fechados e outras entradas: o que os atletas cobrem. */
  aCobrarDosAtletas: number;
  /** Divisão arredondada para cima no centavo (nunca falta dinheiro). Null sem atletas. */
  valorPorAtleta: number | null;
  /** Patrocínio que ainda falta fechar para cada atleta pagar a meta. Null sem meta. */
  faltaParaMeta: number | null;
  /** Dinheiro em caixa hoje: recebido de atletas, patrocínio e entradas, menos gastos pagos. */
  caixa: number;
  recebidoAtletas: number;
}

/**
 * Resumo do financeiro. `elenco` é quantos jogadores o campeonato tem cadastrados e
 * `recebidoAtletas`, o que já entrou de inscrições (pagos × valor da inscrição).
 */
export function resumirFinanceiro(f: Financeiro, elenco: number, recebidoAtletas = 0): ResumoFinanceiro {
  const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const atletas = f.atletas && f.atletas > 0 ? f.atletas : elenco;
  const gastos = soma(f.gastos.map(totalGasto));
  const gastosPagos = soma(f.gastos.filter((g) => g.status === 'pago').map(totalGasto));
  const fechado = soma(f.patrocinios.filter(patrocinioFechado).map((p) => p.valor));
  const recebido = soma(f.patrocinios.filter((p) => p.status === 'recebido').map((p) => p.valor));
  const negociando = soma(f.patrocinios.filter((p) => p.status === 'negociando').map((p) => p.valor));
  const entradas = soma(f.entradas.map((e) => e.valor));
  const entradasRecebidas = soma(f.entradas.filter((e) => e.status === 'recebido').map((e) => e.valor));
  const aCobrar = Math.max(0, gastos - fechado - entradas);
  const meta = f.metaPorAtleta;
  return {
    atletas,
    gastos,
    gastosPagos,
    patrocinioFechado: fechado,
    patrocinioRecebido: recebido,
    patrocinioNegociando: negociando,
    entradas,
    entradasRecebidas,
    aCobrarDosAtletas: aCobrar,
    valorPorAtleta: atletas > 0 ? Math.ceil(aCobrar / atletas) : null,
    faltaParaMeta: meta !== undefined && atletas > 0 ? Math.max(0, aCobrar - meta * atletas) : null,
    caixa: recebidoAtletas + recebido + entradasRecebidas - gastosPagos,
    recebidoAtletas,
  };
}

/** Patrocinadores para o site: só cotas fechadas e marcadas para exibir, master primeiro. */
export function patrocinadoresPublicos(f: Financeiro | undefined): Patrocinio[] {
  if (!f) return [];
  const ordem = (cota: string) => {
    const i = COTAS_PATROCINIO.findIndex((c) => c === cota);
    return i < 0 ? COTAS_PATROCINIO.length : i;
  };
  const vistos = new Set<string>();
  return (
    f.patrocinios
      .filter((p) => p.exibir && patrocinioFechado(p) && p.patrocinador.trim() && !/^a definir$/i.test(p.patrocinador.trim()))
      .sort((a, b) => ordem(a.cota) - ordem(b.cota))
      // Quem fechou mais de uma cota aparece uma vez só, na cota de mais destaque.
      .filter((p) => {
        const chave = p.patrocinador.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      })
  );
}

/**
 * Lê "1.234,56", "1234.56", "R$ 78,50" ou "78" e devolve centavos. Null se não for número.
 */
export function lerReais(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/gi, '');
  if (!limpo) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normal)) return null;
  return Math.round(Number(normal) * 100);
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Para campos de formulário: "78,50" (sem R$). */
export function reaisParaCampo(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Ponto de partida igual à planilha "Financeiro Copa Jumentus 2027": custos fixos
 * zerados para preencher, uniforme da Camizzeria (64 × R$ 78,50) e as cinco cotas
 * de camisa a vender.
 */
export function financeiroPadrao(novoId: () => string, atletas = 64): Financeiro {
  const gasto = (descricao: string, categoria: string, quantidade = 1, valorUnitario = 0): Gasto => ({
    id: novoId(),
    descricao,
    categoria,
    quantidade,
    valorUnitario,
    status: 'previsto',
  });
  return {
    atletas,
    metaPorAtleta: 7000,
    gastos: [
      gasto('Aluguel do campo', 'Campo'),
      gasto('Taxa de arbitragem', 'Arbitragem'),
      gasto('Troféus e medalhas', 'Premiação'),
      gasto('Fotógrafo', 'Fotografia'),
      gasto('Água e descartáveis', 'Água e descartáveis'),
      gasto('Uniformes Camizzeria', 'Uniformes', atletas, 7850),
    ],
    patrocinios: COTAS_PADRAO.map(([cota, valor]) => ({
      id: novoId(),
      patrocinador: 'A definir',
      cota,
      valor,
      status: 'negociando',
      exibir: true,
    })),
    entradas: [],
  };
}
