'use client';

// Barra de transmissão: brasão oficial como assinatura à esquerda, links em
// Barlow Condensed e filete dourado na base (manual, "Cabeçalho padrão").
// No celular os links descem para uma barra inferior fixa, ao alcance do polegar.
// A área dos admins não é item do menu público: é um botão "Admin" no canto
// direito da barra de cima (decisão do operador, 18/11/2026).

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Icone = 'inicio' | 'tabela' | 'jogos' | 'rankings' | 'equipes' | 'edicoes';

const LINKS: Array<{ href: string; rotulo: string; curto: string; icone: Icone }> = [
  { href: '/', rotulo: 'Início', curto: 'Início', icone: 'inicio' },
  { href: '/classificacao', rotulo: 'Tabela', curto: 'Tabela', icone: 'tabela' },
  { href: '/jogos', rotulo: 'Jogos', curto: 'Jogos', icone: 'jogos' },
  { href: '/rankings', rotulo: 'Rankings', curto: 'Rankings', icone: 'rankings' },
  { href: '/equipes', rotulo: 'Equipes', curto: 'Times', icone: 'equipes' },
  // Histórico: sempre a lista geral de edições, mesmo dentro de uma edição antiga.
  { href: '/edicoes', rotulo: 'Edições', curto: 'Edições', icone: 'edicoes' },
];

const fixo = (href: string) => href === '/edicoes';

/** Telas de operação (admin, sorteio, cerimônia) e o link do resultado não levam o menu público. */
const SEM_MENU_PUBLICO = /^\/(admin|sorteio|cerimonia|resultado)(\/|$)/;

function caminhos(pathname: string) {
  // Dentro do histórico (/edicoes/<slug>/...), os links ficam na mesma edição.
  const edicao = /^\/edicoes\/[^/]+/.exec(pathname)?.[0] ?? '';
  const caminho = edicao ? pathname.slice(edicao.length) || '/' : pathname;
  return { edicao, caminho };
}

function destino(edicao: string, href: string) {
  if (fixo(href)) return href;
  return edicao ? (href === '/' ? edicao : edicao + href) : href;
}

function ativoEm(pathname: string, caminho: string, href: string) {
  if (fixo(href)) return pathname === href;
  if (pathname === '/edicoes') return false;
  return href === '/' ? caminho === '/' : caminho.startsWith(href);
}

function IconeNav({ nome }: { nome: Icone }) {
  const comum = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {nome === 'inicio' && <path {...comum} d="M12 3l7 3v6c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6l7-3z" />}
      {nome === 'tabela' && (
        <>
          <path {...comum} d="M4 6h16M4 12h16M4 18h16" />
          <path {...comum} d="M8 4v16" />
        </>
      )}
      {nome === 'jogos' && (
        <>
          <circle {...comum} cx="12" cy="12" r="8.5" />
          <path {...comum} d="M12 7.5l3.4 2.5-1.3 4h-4.2l-1.3-4L12 7.5zM12 3.5v4M20.2 9.5l-4.8.5M17 19.5l-2.9-5.5M7 19.5l2.9-5.5M3.8 9.5l4.8.5" />
        </>
      )}
      {nome === 'rankings' && <path {...comum} d="M4 20V12h5v8M9 20V6h6v14M15 20v-9h5v9M3 20h18" />}
      {nome === 'equipes' && <path {...comum} d="M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-.6 1.4-2.1 2.3-4 2.3S8.6 5.4 8 4z" />}
      {nome === 'edicoes' && <path {...comum} d="M7 4h10v4a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 13v4M8 20h8M9 17h6" />}
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { edicao, caminho } = caminhos(pathname);
  const menuPublico = !SEM_MENU_PUBLICO.test(pathname);
  // Cerimônia e telão são projetados, e o Modo Mesário é a beira do campo: tela
  // inteira, sem barra (cada um tem os próprios controles).
  if (/^\/(cerimonia|telao|admin\/mesario)(\/|$)/.test(pathname)) return null;

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 nao-imprimir" aria-label="Principal">
        <div
          className="mx-auto flex h-14 w-full items-center gap-2 px-4 sm:px-6"
          style={{ background: 'rgba(6, 18, 42, 0.92)', backdropFilter: 'blur(14px)' }}
        >
          <Link href={edicao || '/'} className="flex shrink-0 items-center gap-2 py-2" aria-label="Copa Jumentus — início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/imagens/logo/copa-jumentus-logo.png" alt="" width={30} height={41} className="h-10 w-auto" />
            <span className="titulo-hero t-sm text-xl text-text-1">
              Copa <span style={{ color: 'var(--accent)' }}>Jumentus</span>
            </span>
          </Link>

          {menuPublico && (
            <div className="ml-auto hidden items-stretch self-stretch sm:flex">
              {LINKS.map((l) => {
                const ativo = ativoEm(pathname, caminho, l.href);
                return (
                  <Link
                    key={l.href}
                    href={destino(edicao, l.href)}
                    aria-current={ativo ? 'page' : undefined}
                    className="relative flex items-center px-3 font-mono text-[15px] font-bold uppercase tracking-[0.07em] transition-colors duration-200 ease-hud"
                    style={{ color: ativo ? 'var(--text1)' : 'var(--text2)' }}
                  >
                    {l.rotulo}
                    {ativo && <span className="absolute inset-x-2 bottom-0 h-[3px]" style={{ backgroundImage: 'var(--gradient-leonida)' }} />}
                  </Link>
                );
              })}
            </div>
          )}
          {menuPublico && (
            <Link
              href="/admin"
              className="btn-hud ml-auto !min-h-9 gap-1.5 px-3 !text-[13px] tracking-[0.06em] sm:ml-3"
              title="Área dos admins"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" />
                <path d="M8 11V8a4 4 0 018 0v3" />
              </svg>
              Admin
            </Link>
          )}
        </div>
        <div className="filete !h-[2px] opacity-80" aria-hidden="true" />
      </nav>

      {menuPublico && (
        <nav
          className="nav-inferior nao-imprimir fixed inset-x-0 bottom-0 z-50 sm:hidden"
          aria-label="Seções"
          style={{ background: 'rgba(6, 18, 42, 0.96)', backdropFilter: 'blur(14px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="filete !h-[2px] opacity-80" aria-hidden="true" />
          <ul className="grid grid-cols-6">
            {LINKS.map((l) => {
              const ativo = ativoEm(pathname, caminho, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={destino(edicao, l.href)}
                    aria-current={ativo ? 'page' : undefined}
                    className="relative flex h-16 flex-col items-center justify-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.04em] transition-colors duration-150 active:scale-95"
                    style={{ color: ativo ? 'var(--dourado-claro)' : 'var(--text2)', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                  >
                    {ativo && <span className="absolute inset-x-3 top-0 h-[3px]" style={{ backgroundImage: 'var(--gradient-leonida)' }} />}
                    <IconeNav nome={l.icone} />
                    {l.curto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

/** Rodapé discreto (o acesso dos admins fica no botão da barra de cima). */
export function Rodape() {
  const pathname = usePathname();
  if (SEM_MENU_PUBLICO.test(pathname)) return null;
  return (
    <footer className="nao-imprimir mx-auto max-w-6xl px-4 pb-28 pt-6 sm:pb-10">
      <div className="filete mb-4 w-full opacity-40" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-text-3">
        <span>@c.r.jumentus</span>
        <Link href="/regulamento" className="underline decoration-dotted underline-offset-4 hover:text-text-1">
          Regulamento
        </Link>
      </div>
    </footer>
  );
}
