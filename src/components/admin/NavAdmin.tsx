'use client';

// Menu do admin (decisão do operador em 25/11/2026): barra lateral fixa no
// computador e, no celular, uma gaveta que abre pelo botão de três linhas. O item
// ativo leva o dourado metálico com a ponta cortada.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface ItemAdmin {
  href: string;
  rotulo: string;
}

function Lista({ itens, aoEscolher }: { itens: readonly ItemAdmin[]; aoEscolher?: () => void }) {
  const pathname = usePathname();
  const ativo = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));
  return (
    <ul className="space-y-0.5">
      {itens.map((i) => {
        const atual = ativo(i.href);
        return (
          <li key={i.href}>
            <Link
              href={i.href}
              onClick={aoEscolher}
              aria-current={atual ? 'page' : undefined}
              className="item-nav-admin flex min-h-[2.75rem] items-center px-4 text-[16px] transition-colors duration-150"
              data-ativo={atual || undefined}
            >
              {i.rotulo}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NavAdmin({ itens, modo }: { itens: readonly ItemAdmin[]; modo: 'lateral' | 'gaveta' }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  // Fecha a gaveta ao trocar de página e com Esc.
  useEffect(() => setAberto(false), [pathname]);
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [aberto]);

  if (modo === 'lateral') {
    return (
      <nav aria-label="Admin" className="sticky top-4">
        <Lista itens={itens} />
      </nav>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn-mini inline-flex items-center gap-2.5 lg:hidden"
        aria-expanded={aberto}
        aria-controls="gaveta-admin"
        aria-label="Abrir o menu do admin"
        onClick={() => setAberto(true)}
      >
        <span aria-hidden className="flex flex-col gap-[5px]">
          <span className="block h-[2px] w-[18px] bg-current" />
          <span className="block h-[2px] w-[18px] bg-current" />
          <span className="block h-[2px] w-[18px] bg-current" />
        </span>
        <span>Menu</span>
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fechar o menu" className="veu-gaveta absolute inset-0" onClick={() => setAberto(false)} />
          <nav id="gaveta-admin" aria-label="Admin" className="gaveta-admin absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] overflow-y-auto pb-8 pt-5">
            <div className="mb-4 flex items-center justify-between px-4">
              <span className="hud-label" style={{ color: 'var(--accent)' }}>
                Área dos admins
              </span>
              <button type="button" className="btn-mini" onClick={() => setAberto(false)}>
                Fechar
              </button>
            </div>
            <Lista itens={itens} aoEscolher={() => setAberto(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
