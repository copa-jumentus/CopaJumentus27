import { FormNovoAdmin, FormRedefinirSenha } from '@/components/admin/FormsAdmins';
import { Aviso, Secao } from '@/components/campeonato/ui';
import { estaBloqueado } from '@/lib/auth/bloqueio';
import { exigirAdmin } from '@/lib/auth/servidor';
import { listarAdmins } from '@/lib/repo/admins-repo';
import { desativarAdminAcao } from '../../acoes-conta';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admins — Admin Copa Jumentus' };

export default async function Admins({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const eu = await exigirAdmin();
  const contas = await listarAdmins();
  const agora = new Date();

  return (
    <div className="space-y-6">
      <h1 className="titulo-hero t-xl text-4xl">Admins</h1>
      <Aviso texto={ok} tipo="ok" />
      <Aviso texto={erro} />

      <Secao titulo="Nova conta">
        <p className="mb-4 text-sm text-text-3">
          A conta nasce com senha temporária, mostrada uma única vez. No primeiro acesso a pessoa cria a própria senha. Conta de mesário só abre o Modo Mesário dos jogos: não vê
          inscrições, financeiro, sorteio nem as outras contas.
        </p>
        <FormNovoAdmin />
      </Secao>

      <Secao titulo="Contas">
        <ul className="divide-y divide-[var(--panel-stroke)]">
          {contas.map((c) => {
            const situacao = !c.ativo
              ? 'Desativada'
              : estaBloqueado(c, agora)
                ? 'Bloqueada por tentativas'
                : c.deveTrocarSenha
                  ? 'Aguardando primeira troca de senha'
                  : 'Ativa';
            return (
              <li key={c.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
                <div className="min-w-[12rem] flex-1">
                  <p className="font-semibold text-text-1">
                    {c.nome} {c.id === eu.id && <span className="hud-label !text-[11px]">(você)</span>}
                  </p>
                  <p className="font-mono text-sm text-text-3">
                    {c.usuario} · {c.papel === 'mesario' ? 'Mesário' : 'Admin'} · {situacao}
                  </p>
                </div>
                {c.ativo && (
                  <div className="flex flex-wrap items-start gap-2">
                    <FormRedefinirSenha adminId={c.id} usuario={c.usuario} />
                    {c.id !== eu.id && (
                      <form action={desativarAdminAcao}>
                        <input type="hidden" name="adminId" value={c.id} />
                        <button type="submit" className="btn-mini" data-perigo aria-label={`Desativar ${c.usuario}`}>
                          Desativar
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Secao>
    </div>
  );
}
