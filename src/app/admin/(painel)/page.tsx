import Link from 'next/link';
import { LinhaPartida } from '@/components/campeonato/Partidas';
import { Aviso, Numero, Secao, Vazio } from '@/components/campeonato/ui';
import { formatarReais, grupoEncerrado, indices, nomeDoLado } from '@/lib/campeonato/consultas';
import { andamento } from '@/lib/domain/campeonato/andamento';
import { calcularClassificacao, empatesPendentes } from '@/lib/domain/campeonato/classificacao';
import { ordenarPartidas } from '@/lib/domain/campeonato/suspensoes';
import { campeonatoDoAdmin } from '@/lib/campeonato/selecao';
import { resumirFinanceiro } from '@/lib/domain/campeonato/financeiro';
import { listarInscricoes } from '@/lib/repo/inscricoes-repo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Copa Jumentus' };

export default async function Painel({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const c = await campeonatoDoAdmin();
  const { equipe } = indices(c);
  const pagos = c.jogadores.filter((j) => j.pago).length;
  // Antes de oficializar o sorteio ainda não há jogadores nas equipes: o que existe são as inscrições.
  const inscricoes = await listarInscricoes(c.id);
  const confirmados = inscricoes.filter((i) => i.status === 'confirmado').length;
  const naEspera = inscricoes.length - confirmados;
  const fin = c.financeiro ? resumirFinanceiro(c.financeiro, c.jogadores.length, Math.round(pagos * c.valorInscricao * 100)) : null;
  const a = andamento(c.partidas);
  // O jogo da vez: o ao vivo ou, sem ele, o próximo. É para ele que o admin vai na beira do campo.
  const daVez = a.aoVivo[0] ?? a.proxima;
  const proximas = ordenarPartidas(c.partidas)
    .filter((p) => p.status !== 'encerrada' && p.id !== daVez?.id)
    .slice(0, 4);
  const semTabela = c.modelo === 'copa-jumentus-8' && c.equipes.some((e) => e.numeroTabela === undefined);
  const empates = c.fases.flatMap((f) =>
    c.grupos
      .filter((g) => g.faseId === f.id && grupoEncerrado(c, g.id))
      .flatMap((g) => empatesPendentes(calcularClassificacao(g.equipeIds, c.partidas.filter((p) => p.grupoId === g.id), c.pontuacao, c.criterios, { desempates: f.desempates }))),
  );

  return (
    <div className="space-y-6">
      <h1 className="titulo-hero t-xl text-4xl">{c.nome}</h1>
      <Aviso texto={ok} tipo="ok" />
      <Aviso texto={erro} />
      {semTabela && c.sorteioOficializadoEm && (
        <Aviso tipo="info" texto="Elencos oficializados: falta sortear T1 a T8 (Partidas) para os 28 jogos do Grupo Único terem equipes." />
      )}
      {empates.length > 0 && (
        <Aviso tipo="info" texto={`Há ${empates.length} empate(s) em todos os critérios esperando decisão em Fases e grupos.`} />
      )}

      {!c.sorteioOficializadoEm && (
        <Aviso
          tipo="info"
          texto="Os elencos ainda não vieram do sorteio. Faça a cerimônia e use “Oficializar no campeonato” no final, ou cadastre os jogadores em Equipes."
        />
      )}

      {daVez && (
        <section className="hud-card hud-clip modulo relative p-4 sm:p-5" aria-label="Jogo da vez">
          <p className="hud-label mb-2 !text-[13px]" style={{ color: daVez.status === 'ao-vivo' ? 'var(--error-text)' : 'var(--accent)' }}>
            {daVez.status === 'ao-vivo' ? 'Ao vivo agora' : 'Próximo jogo'}
          </p>
          <p className="titulo-hero t-sm text-2xl leading-tight sm:text-3xl">
            {daVez.numero !== undefined && <span className="numero mr-2 text-[var(--accent)]">J{daVez.numero}</span>}
            {nomeDoLado(c, daVez, 'mandante', equipe)} <span className="text-text-3">x</span> {nomeDoLado(c, daVez, 'visitante', equipe)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/admin/mesario/${daVez.id}`} className="btn-cta w-full sm:w-auto">
              <span>Modo Mesário</span>
            </Link>
            <Link href={`/admin/partidas/${daVez.id}`} className="btn-hud w-full sm:w-auto">
              {daVez.status === 'ao-vivo' ? 'Súmula completa' : 'Súmula completa e começar'}
            </Link>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="hud-card relative px-3 py-4">
          <Numero valor={`${a.encerrados}/${a.total}`} rotulo="Jogos encerrados" />
        </div>
        {c.jogadores.length > 0 ? (
          <Link href="/admin/pagamentos" className="hud-card relative px-3 py-4 transition-colors hover:bg-[var(--surface2)]">
            <Numero valor={`${pagos}/${c.jogadores.length}`} rotulo="Inscrições pagas" />
          </Link>
        ) : (
          <Link href="/admin/inscricoes" className="hud-card relative px-3 py-4 transition-colors hover:bg-[var(--surface2)]">
            <Numero valor={String(confirmados)} rotulo={naEspera > 0 ? `Inscritos · ${naEspera} na espera` : 'Inscritos confirmados'} />
          </Link>
        )}
        <Link href="/admin/financeiro" className="hud-card relative px-3 py-4 transition-colors hover:bg-[var(--surface2)]">
          <Numero valor={formatarReais((fin?.patrocinioFechado ?? 0) / 100)} rotulo="Patrocínio fechado" />
        </Link>
        <Link href="/admin/financeiro" className="hud-card relative px-3 py-4 transition-colors hover:bg-[var(--surface2)]">
          <Numero
            valor={fin?.valorPorAtleta != null ? formatarReais(fin.valorPorAtleta / 100) : formatarReais(pagos * c.valorInscricao)}
            rotulo={fin?.valorPorAtleta != null ? 'Valor por atleta' : 'Arrecadado'}
          />
        </Link>
      </div>

      <Secao
        titulo="Na sequência"
        acao={
          <Link href="/admin/partidas" className="btn-mini">
            Todas
          </Link>
        }
      >
        {proximas.length === 0 ? (
          a.terminou ? (
            <Vazio texto="Todos os jogos foram encerrados." detalhe="Quando quiser, marque o campeonato como encerrado em Campeonato." />
          ) : (
            <Vazio texto="Nenhuma partida pendente." detalhe="Crie as partidas em Fases e grupos ou em Partidas." />
          )
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {proximas.map((p) => (
              <LinhaPartida key={p.id} c={c} partida={p} equipe={equipe} href={`/admin/partidas/${p.id}`} />
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}
