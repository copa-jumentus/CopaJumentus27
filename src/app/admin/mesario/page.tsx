import Link from 'next/link';
import { exigirMesario } from '@/lib/auth/servidor';
import { formatarDataHora, indices, nomeDoLado } from '@/lib/campeonato/consultas';
import { idDoCampeonatoDoMesario } from '@/lib/campeonato/selecao';
import { ordenarPartidas } from '@/lib/domain/campeonato/suspensoes';
import type { Partida } from '@/lib/domain/campeonato/tipos';
import { carregarCampeonato } from '@/lib/repo/campeonato-repo';
import { sair } from '../acoes-conta';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jogos — Modo Mesário' };

function situacao(p: Partida): string {
  if (p.status === 'ao-vivo') return 'AO VIVO';
  if (p.status === 'encerrada') return `FIM · ${p.golsMandante}:${p.golsVisitante}`;
  return formatarDataHora(p.dataHora) || 'Sem horário';
}

/** Lista de jogos do Modo Mesário: a única tela de quem tem conta de mesário. */
export default async function JogosDoMesario() {
  const conta = await exigirMesario({ permitirTrocaPendente: true });
  const c = await carregarCampeonato(await idDoCampeonatoDoMesario(conta.papel));
  const { equipe } = indices(c);
  const jogos = ordenarPartidas(c.partidas);
  const daVez = jogos.find((p) => p.status === 'ao-vivo') ?? jogos.find((p) => p.status === 'agendada' && p.mandanteId && p.visitanteId);

  return (
    <div className="min-h-dvh bg-[var(--bg)] pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-hud bg-[var(--surface1)] px-3 py-2">
        {conta.papel === 'admin' && (
          <Link href="/admin" className="btn-mini">
            ← Painel
          </Link>
        )}
        <p className="hud-label min-w-0 flex-1 truncate !text-[13px]">Modo Mesário · {c.nome}</p>
        <form action={sair}>
          <button type="submit" className="btn-mini">
            Sair
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-3 pt-4">
        <div>
          <p className="hud-label" style={{ color: 'var(--accent)' }}>
            {conta.nome}
          </p>
          <h1 className="titulo-hero t-xl mt-1 text-4xl">Jogos</h1>
          <div className="filete mt-3 w-16" aria-hidden="true" />
        </div>

        {jogos.length === 0 ? (
          <p className="text-sm text-text-2">Este campeonato ainda não tem jogos.</p>
        ) : (
          <ul className="space-y-2">
            {jogos.map((p) => {
              const pronto = Boolean(p.mandanteId && p.visitanteId);
              const conteudo = (
                <>
                  <span className="numero w-10 shrink-0 text-xl text-text-3">{p.numero !== undefined ? `J${p.numero}` : '—'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-text-1">
                      {nomeDoLado(c, p, 'mandante', equipe)} <span className="text-text-3">x</span> {nomeDoLado(c, p, 'visitante', equipe)}
                    </span>
                    <span className="hud-label block !text-[12px]" style={{ color: p.status === 'ao-vivo' ? 'var(--error)' : undefined }}>
                      {[p.rotulo, situacao(p)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {pronto && <span className="hud-label shrink-0 !text-[12px]">Abrir →</span>}
                </>
              );
              const destaque = p.id === daVez?.id;
              return (
                <li key={p.id}>
                  {pronto ? (
                    <Link
                      href={`/admin/mesario/${p.id}`}
                      className={`hud-card relative flex items-center gap-3 px-3 py-3 ${destaque ? 'modulo' : ''}`}
                      aria-current={destaque ? 'true' : undefined}
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="hud-card relative flex items-center gap-3 px-3 py-3 opacity-60">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
