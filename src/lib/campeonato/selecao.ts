// Qual campeonato cada tela mostra (CLAUDE.md §8.6).
// - Admin: o "campeonato em edição", escolhido em Admin › Campeonatos e guardado
//   num cookie do navegador de cada admin. Sem escolha, o atual do site público.
// - Público: o atual (escolherAtual) nas rotas da raiz; qualquer edição não
//   rascunho em /edicoes/[slug].

import { patrocinadoresPublicos, type Patrocinio } from '@/lib/domain/campeonato/financeiro';
import { cookies } from 'next/headers';
import type { Campeonato } from '@/lib/domain/campeonato/tipos';
import { carregarCampeonato, escolherAtual, listarCampeonatos, type ResumoCampeonato } from '@/lib/repo/campeonato-repo';

export const COOKIE_CAMPEONATO = 'cj_campeonato';

export async function idDoCampeonatoDoAdmin(): Promise<number> {
  const lista = await listarCampeonatos();
  const escolhido = Number((await cookies()).get(COOKIE_CAMPEONATO)?.value);
  if (lista.some((c) => c.id === escolhido)) return escolhido;
  return (escolherAtual(lista) ?? lista[0]).id;
}

export async function campeonatoDoAdmin(): Promise<Campeonato> {
  return carregarCampeonato(await idDoCampeonatoDoAdmin());
}

/**
 * Campeonato do Modo Mesário. Admin: o em edição. Conta de mesário: sempre o atual
 * do site público (não escolhe campeonato e não mexe em rascunho), sem ler cookie.
 */
export async function idDoCampeonatoDoMesario(papel: 'admin' | 'mesario'): Promise<number> {
  if (papel === 'admin') return idDoCampeonatoDoAdmin();
  const lista = await listarCampeonatos();
  return (escolherAtual(lista) ?? lista[0]).id;
}

export async function edicoesPublicas(): Promise<ResumoCampeonato[]> {
  return (await listarCampeonatos()).filter((c) => c.status !== 'rascunho');
}

export interface CampeonatoPublico {
  c: Campeonato;
  /** Prefixo dos links internos: '' na raiz, '/edicoes/<slug>' no histórico. */
  base: string;
  /** Edições públicas, para o histórico. */
  edicoes: ResumoCampeonato[];
  /** Patrocinadores fechados e marcados para o site. O resto do financeiro nunca sai do admin. */
  patrocinadores: Patrocinio[];
}

/** Campeonato do site público: por slug (histórico) ou o atual. null = não existe ou é rascunho. */
export async function campeonatoPublico(slug?: string): Promise<CampeonatoPublico | null> {
  const edicoes = await edicoesPublicas();
  const resumo = slug ? edicoes.find((c) => c.slug === slug) : escolherAtual(edicoes);
  if (!resumo) return null;
  const c = await carregarCampeonato(resumo.id);
  const patrocinadores = patrocinadoresPublicos(c.financeiro);
  return { c: { ...c, financeiro: undefined }, base: slug ? `/edicoes/${slug}` : '', edicoes, patrocinadores };
}
