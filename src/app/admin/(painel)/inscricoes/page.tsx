import Link from 'next/link';
import { Aviso, Numero, Secao } from '@/components/campeonato/ui';
import { MARCAS } from '@/lib/campeonato/marcas';
import { idDoCampeonatoDoAdmin } from '@/lib/campeonato/selecao';
import { calcularCotas } from '@/lib/domain/cotas';
import { carregarCampeonato } from '@/lib/repo/campeonato-repo';
import { listarInscricoes, paraLinhas } from '@/lib/repo/inscricoes-repo';
import { interpretarInscricoes } from '@/lib/repo/planilha';
import {
  criarInscricaoAcao,
  editarInscricaoAcao,
  importarInscricoesAcao,
  removerInscricaoAcao,
} from '../../acoes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inscrições — Admin Copa Jumentus' };
const VOLTA = '/admin/inscricoes';

const FILTROS: ReadonlyArray<readonly [string, string]> = [
  ['', 'Todos'],
  ['confirmados', 'Confirmados'],
  ['espera', 'Lista de espera'],
  ['incompletos', 'Incompletos'],
  ['goleiros', 'Goleiros'],
  ['linha', 'Linha'],
];

function Volta({ filtro, q }: { filtro?: string; q?: string }) {
  const params = new URLSearchParams();
  if (filtro) params.set('filtro', filtro);
  if (q) params.set('q', q);
  const qs = params.toString();
  return <input type="hidden" name="volta" value={qs ? `${VOLTA}?${qs}` : VOLTA} />;
}

export default async function Inscricoes({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; filtro?: string; q?: string }>;
}) {
  const { erro, ok, filtro = '', q = '' } = await searchParams;
  const campeonatoId = await idDoCampeonatoDoAdmin();
  const inscricoes = await listarInscricoes(campeonatoId);
  const { equipes } = await carregarCampeonato(campeonatoId);
  const cadastro = interpretarInscricoes(paraLinhas(inscricoes), equipes.length ? equipes.map((e) => e.nome) : undefined);
  // Cotas de estrelas (composição idêntica, 19/11/2026): o detalhe por nível só aparece aqui.
  const confirmados = inscricoes.filter((i) => i.status === 'confirmado');
  // Quem ainda está sem estrelas conta para o tamanho dos elencos (7 por time com 56 de linha).
  const semEstrelas = confirmados.filter((i) => i.posicao !== 'GOL' && !i.estrelas).length;
  const cotas = calcularCotas(cadastro.jogadores, cadastro.times.length, semEstrelas);
  const goleiros = confirmados.filter((i) => i.posicao === 'GOL').length;
  const linha = confirmados.filter((i) => i.posicao !== 'GOL').length;

  const termo = q.trim().toLowerCase();
  const filtradas = inscricoes.filter((i) => {
    if (filtro === 'confirmados' && i.status !== 'confirmado') return false;
    if (filtro === 'espera' && i.status !== 'espera') return false;
    if (
      filtro === 'incompletos' &&
      !(i.status === 'confirmado' && i.posicao !== 'GOL' && !i.estrelas)
    ) {
      return false;
    }
    if (filtro === 'goleiros' && i.posicao !== 'GOL') return false;
    if (filtro === 'linha' && i.posicao === 'GOL') return false;
    if (!termo) return true;
    return (
      i.nome.toLowerCase().includes(termo) ||
      (i.apelido && i.apelido.toLowerCase().includes(termo))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="titulo-hero t-xl text-4xl">Inscrições</h1>
        <Link href="/sorteio" className="btn-hud">
          Ver o pote do sorteio
        </Link>
      </div>
      <p className="text-sm text-text-2">
        Cadastro que alimenta o sorteio. As estrelas só aparecem aqui: nunca na tela de sorteio, na cerimônia, no link de resultado ou em página pública.
      </p>
      <Aviso texto={erro} />
      <Aviso texto={ok} tipo="ok" />

      <div className="hud-card hud-clip modulo relative grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
        <Numero valor={confirmados.length} rotulo="Confirmados" />
        <Numero valor={inscricoes.length - confirmados.length} rotulo="Lista de espera" />
        <Numero valor={`${goleiros}/${MARCAS.length}`} rotulo="Goleiros" />
        <Numero valor={linha} rotulo="Linha" />
      </div>

      {inscricoes.length > 0 && (
        <Secao titulo={cotas.fechou ? 'Cotas de estrelas · fechadas' : 'Cotas de estrelas · abertas'}>
          <p className="mb-3 text-sm text-text-2">
            Todo time recebe a mesma quantidade de cada nível: {cotas.vagasPorTime} jogadores de linha por time em {cotas.times} times.
            Cada nível precisa ter exatamente o número abaixo. Enquanto alguma cota não fechar, o sorteio fica bloqueado.
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {cotas.niveis.map((n) => {
              const fechada = n.tem === n.necessario;
              return (
                <li
                  key={n.nivel}
                  className="border-l-[3px] bg-[var(--surface1)] px-3 py-2"
                  style={{ borderColor: fechada ? 'var(--accent)' : 'var(--error)' }}
                >
                  <p className="hud-label !text-[11px]">
                    {n.nivel}★ · {n.porTime} por time
                  </p>
                  <p className="numero text-2xl" style={{ color: fechada ? 'var(--text1)' : 'var(--error)' }}>
                    {n.tem}/{n.necessario}
                  </p>
                  <p className="text-xs text-text-3">
                    {fechada ? 'Fechada' : n.tem < n.necessario ? `Faltam ${n.necessario - n.tem}` : `Sobram ${n.tem - n.necessario}`}
                  </p>
                </li>
              );
            })}
          </ul>
          {cotas.jogadoresDeLinha % Math.max(1, cotas.times) !== 0 && (
            <p className="mt-3 text-sm" style={{ color: 'var(--error)' }}>
              {cotas.pendencias[0]}
            </p>
          )}
        </Secao>
      )}

      {inscricoes.length > 0 && cadastro.problemas.length > 0 && (
        <Secao titulo={`Pendências (${cadastro.problemas.length})`}>
          <p className="mb-2 text-sm text-text-2">Enquanto houver pendência, o botão de sortear fica bloqueado.</p>
          <ul className="max-h-60 space-y-1 overflow-y-auto font-mono text-sm text-text-2">
            {cadastro.problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Nova inscrição">
        <form action={criarInscricaoAcao} className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_8rem_9rem_auto]">
          <Volta filtro={filtro} q={q} />
          <CamposInscricao />
          <button type="submit" className="btn-mini">
            Adicionar
          </button>
        </form>
      </Secao>

      <Secao titulo={`Inscritos (${filtradas.length}/${inscricoes.length})`}>
        {inscricoes.length > 0 && (
          <div className="mb-4 space-y-3 border-b border-hud pb-4">
            <form method="get" action={VOLTA} className="flex flex-wrap items-center gap-2">
              {filtro && <input type="hidden" name="filtro" value={filtro} />}
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Buscar por nome, apelido ou time..."
                aria-label="Buscar inscrito"
                className="campo max-w-sm flex-1"
              />
              <button type="submit" className="btn-mini">
                Buscar
              </button>
              {(q || filtro) && (
                <Link href={VOLTA} className="btn-mini">
                  Limpar
                </Link>
              )}
            </form>

            <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar inscritos">
              {FILTROS.map(([valor, rotulo]) => {
                const params = new URLSearchParams();
                if (valor) params.set('filtro', valor);
                if (q) params.set('q', q);
                const href = params.toString() ? `${VOLTA}?${params.toString()}` : VOLTA;
                return (
                  <Link
                    key={valor}
                    href={href}
                    className="btn-mini !min-h-8 !px-2.5 !text-xs"
                    aria-pressed={filtro === valor}
                  >
                    {rotulo}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {inscricoes.length === 0 ? (
          <p className="text-sm text-text-3">Ninguém cadastrado ainda. Adicione acima ou importe a planilha abaixo.</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-text-3">Nenhum inscrito corresponde ao filtro atual.</p>
        ) : (
          <ul className="space-y-2">
            {filtradas.map((i) => (
              <li key={i.id}>
                <form
                  action={editarInscricaoAcao}
                  className="grid grid-cols-2 gap-2 bg-[var(--surface1)] p-2 sm:grid-cols-[1fr_1fr_6rem_8rem_9rem_auto_auto]"
                  style={{ opacity: i.status === 'espera' ? 0.65 : 1 }}
                >
                  <Volta filtro={filtro} q={q} />
                  <input type="hidden" name="inscricaoId" value={i.id} />
                  <CamposInscricao valores={i} />
                  <button type="submit" className="btn-mini">
                    Salvar
                  </button>
                  <button type="submit" formAction={removerInscricaoAcao} className="btn-mini" data-perigo>
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Importar da planilha">
        <p className="mb-3 text-sm text-text-2">
          Na planilha, abra a aba INSCRITOS e use Arquivo › Fazer download › CSV. Quem já está cadastrado (mesmo nome) é
          mantido como está.
        </p>
        <form action={importarInscricoesAcao} className="flex flex-wrap items-center gap-2">
          <Volta filtro={filtro} q={q} />
          <input name="arquivo" type="file" accept=".csv,text/csv" required className="campo max-w-sm" />
          <button type="submit" className="btn-mini">
            Importar
          </button>
        </form>
      </Secao>
    </div>
  );
}

function CamposInscricao({
  valores,
}: {
  valores?: { nome: string; apelido: string | null; posicao: string | null; estrelas: number | null; status: string };
}) {
  return (
    <>
      <input name="nome" required defaultValue={valores?.nome ?? ''} placeholder="Nome" aria-label="Nome" className="campo" />
      <input name="apelido" defaultValue={valores?.apelido ?? ''} placeholder="Apelido" aria-label="Apelido" className="campo" />
      <label className="campo flex cursor-pointer items-center gap-2 !py-0" style={{ touchAction: 'manipulation' }}>
        <input name="goleiro" type="checkbox" defaultChecked={valores?.posicao === 'GOL'} className="h-4 w-4 accent-[var(--accent)]" />
        <span className="text-sm">Goleiro</span>
      </label>
      <select name="estrelas" defaultValue={valores?.estrelas ?? ''} aria-label="Estrelas" className="campo">
        <option value="">Estrelas</option>
        {[6, 5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {'★'.repeat(n)}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={valores?.status ?? 'confirmado'} aria-label="Status" className="campo">
        <option value="confirmado">Confirmado</option>
        <option value="espera">Lista de espera</option>
      </select>
    </>
  );
}
