import Link from 'next/link';
import { GuardaAdmin } from '@/components/admin/GuardaAdmin';
import { NavAdmin } from '@/components/admin/NavAdmin';
import { exigirAdmin } from '@/lib/auth/servidor';
import { idDoCampeonatoDoAdmin } from '@/lib/campeonato/selecao';
import { ROTULO_STATUS_CAMPEONATO } from '@/lib/domain/campeonato/tipos';
import { listarCampeonatos } from '@/lib/repo/campeonato-repo';
import { sair } from '../acoes-conta';

const ITENS = [
  { href: '/admin', rotulo: 'Painel' },
  { href: '/admin/campeonatos', rotulo: 'Campeonatos' },
  { href: '/admin/inscricoes', rotulo: 'Inscrições' },
  { href: '/admin/campeonato', rotulo: 'Campeonato' },
  { href: '/admin/fases', rotulo: 'Fases e grupos' },
  { href: '/admin/partidas', rotulo: 'Partidas' },
  { href: '/admin/equipes', rotulo: 'Equipes' },
  { href: '/admin/pagamentos', rotulo: 'Pagamentos' },
  { href: '/admin/financeiro', rotulo: 'Financeiro' },
  { href: '/admin/artes', rotulo: 'Artes' },
  { href: '/sorteio', rotulo: 'Sorteio' },
  { href: '/admin/admins', rotulo: 'Admins' },
];

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const conta = await exigirAdmin({ permitirTrocaPendente: true });
  const [lista, idAtual] = await Promise.all([listarCampeonatos(), idDoCampeonatoDoAdmin()]);
  const atual = lista.find((c) => c.id === idAtual);
  return (
    <GuardaAdmin>
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-4">
        <div className="mb-4 flex items-center gap-2 border-b border-hud pb-3">
          <div className="lg:hidden">
            <NavAdmin itens={ITENS} modo="gaveta" />
          </div>
          <span className="hud-label hidden lg:inline" style={{ color: 'var(--accent)' }}>
            Área dos admins
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin/conta" className="btn-mini" title="Minha conta">
              {conta.nome}
            </Link>
            <form action={sair}>
              <button type="submit" className="btn-mini">
                Sair
              </button>
            </form>
          </div>
        </div>
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden lg:block">
            <NavAdmin itens={ITENS} modo="lateral" />
          </aside>
          <div className="min-w-0">
            {atual && (
              <p className="mb-6 flex flex-wrap items-center gap-2 text-sm text-text-2">
                <span className="hud-label !text-[11px]">Editando</span>
                <span className="font-semibold text-text-1">
                  {atual.nome}
                  {atual.edicao && !atual.nome.includes(atual.edicao) ? ` ${atual.edicao}` : ''}
                </span>
                <span className="text-text-3">· {ROTULO_STATUS_CAMPEONATO[atual.status]}</span>
                {lista.length > 1 && (
                  <Link href="/admin/campeonatos" className="underline decoration-dotted underline-offset-4">
                    trocar
                  </Link>
                )}
              </p>
            )}
            {children}
          </div>
        </div>
      </div>
    </GuardaAdmin>
  );
}
