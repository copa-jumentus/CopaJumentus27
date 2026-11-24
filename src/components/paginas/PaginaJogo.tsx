import { CronometroAoVivo } from '@/components/campeonato/CronometroAoVivo';
import { duracaoDoTempo } from '@/lib/domain/campeonato/sumula';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoAtualizar } from '@/components/campeonato/AutoAtualizar';
import { BotaoImprimir } from '@/components/campeonato/BotaoImprimir';
import { Sumula } from '@/components/campeonato/Sumula';
import { Escudo, Secao, SeloStatus } from '@/components/campeonato/ui';
import { formatarDataHora, indices, lados } from '@/lib/campeonato/consultas';
import type { Campeonato, Equipe, Partida } from '@/lib/domain/campeonato/tipos';

/** Partida com palco Matchday/Placar Final (manual §7.3) e súmula completa. */
export function PaginaJogo({ c, base, id }: { c: Campeonato; base: string; id: string }) {
  const partida = c.partidas.find((p) => p.id === id);
  if (!partida) notFound();
  const { equipe } = indices(c);
  const fase = c.fases.find((f) => f.id === partida.faseId);
  const infoLados = lados(c, partida, equipe);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-20 pt-6">
      <AutoAtualizar ativo={partida.status === 'ao-vivo'} segundos={15} />
      <div className="nao-imprimir flex items-center justify-between">
        <Link href={`${base}/jogos`} className="hud-label hover:text-text-1">
          ← Jogos
        </Link>
        <BotaoImprimir rotulo="Imprimir súmula" />
      </div>
      <div className="imprimivel space-y-6">
        <PalcoPartida
          campeonatoNome={`${c.nome}${c.edicao && !c.nome.includes(c.edicao) ? ` ${c.edicao}` : ''}`}
          faseNome={fase?.nome}
          partida={partida}
          duracaoMin={duracaoDoTempo(c, partida)}
          mandante={infoLados.mandante}
          visitante={infoLados.visitante}
          rotuloMandante={infoLados.rotuloMandante}
          rotuloVisitante={infoLados.rotuloVisitante}
        />
        <Secao titulo="Súmula">
          <Sumula partida={partida} campeonato={c} />
        </Secao>
      </div>
    </div>
  );
}

function PalcoPartida({
  campeonatoNome,
  faseNome,
  partida,
  duracaoMin,
  mandante,
  visitante,
  rotuloMandante,
  rotuloVisitante,
}: {
  campeonatoNome: string;
  faseNome?: string;
  partida: Partida;
  duracaoMin: number;
  mandante?: Equipe;
  visitante?: Equipe;
  rotuloMandante?: string;
  rotuloVisitante?: string;
}) {
  const mostraPlacar = partida.status !== 'agendada';
  const penaltis =
    partida.golsMandante === partida.golsVisitante &&
    (partida.penaltisMandante !== undefined || partida.penaltisVisitante !== undefined);
  const encerrada = partida.status === 'encerrada';
  const mandanteVenceu =
    encerrada &&
    (partida.golsMandante > partida.golsVisitante ||
      (penaltis && (partida.penaltisMandante ?? 0) > (partida.penaltisVisitante ?? 0)));
  const visitanteVenceu =
    encerrada &&
    (partida.golsVisitante > partida.golsMandante ||
      (penaltis && (partida.penaltisVisitante ?? 0) > (partida.penaltisMandante ?? 0)));

  const corA = mandante?.corPrimaria ?? '#0B1F3F';
  const corB = visitante?.corPrimaria ?? '#13284D';
  const tituloPalco =
    partida.status === 'encerrada'
      ? 'FIM DE JOGO'
      : partida.status === 'ao-vivo'
        ? 'AO VIVO'
        : 'MATCHDAY';

  return (
    <section className="hud-card hud-clip modulo relative overflow-hidden">
      {/* Faixa superior marinho: assinatura da competicao + rotulo Matchday / Fim de Jogo */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hud bg-[var(--surface1)] px-4 py-3 sm:px-6">
        <div>
          <p className="hud-label !text-[11px] text-text-3">{campeonatoNome}</p>
          <p className="hud-label mt-0.5 !text-[13px] text-text-1">
            {partida.numero !== undefined && (
              <span style={{ color: 'var(--accent)' }}>J{partida.numero} · </span>
            )}
            {faseNome}
            {partida.rodada !== undefined ? ` · Rodada ${partida.rodada}` : ''}
            {partida.rotulo ? ` · ${partida.rotulo}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="titulo-hero t-sm text-2xl sm:text-3xl"
            style={{ color: partida.status === 'ao-vivo' ? 'var(--vermelho)' : 'var(--accent)' }}
          >
            {tituloPalco}
          </span>
          <SeloStatus status={partida.status} />
        </div>
      </div>

      {/* Palco dividido a 45° com filete dourado e malha de camisa (manual §7.3) */}
      <div
        className="malha-camisa relative px-4 py-8 sm:px-8 sm:py-10"
        style={{
          backgroundImage: `linear-gradient(135deg, ${corA} 0% 49.2%, #D4A12A 49.2% 50.8%, ${corB} 50.8% 100%)`,
        }}
      >
        {/* Escurecimento suave para garantir contraste de leitura sobre qualquer cor de time */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, rgba(6, 18, 42, 0.55) 0%, rgba(6, 18, 42, 0.78) 100%)',
          }}
          aria-hidden="true"
        />

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          {/* Lado Mandante */}
          <div
            className={`flex min-w-0 flex-col items-center gap-2 text-center transition-opacity ${
              visitanteVenceu ? 'opacity-60' : ''
            }`}
          >
            <Escudo equipe={mandante} tamanho={76} />
            {mandante?.sigla && (
              <span className="hud-label !text-[11px] text-text-2">{mandante.sigla}</span>
            )}
            <h2 className="titulo-hero t-sm w-full truncate text-xl text-text-1 sm:text-3xl">
              {mandante?.nome ?? rotuloMandante ?? 'A definir'}
            </h2>
          </div>

          {/* Centro: Losango VS (agendada) ou Placar em Big Shoulders (ao vivo / encerrada) */}
          <div className="flex flex-col items-center justify-center px-2 text-center">
            {mostraPlacar ? (
              <div className="rounded-component border border-hud bg-[rgba(6,18,42,0.88)] px-4 py-3 shadow-2 sm:px-6 sm:py-4">
                <p className="numero text-5xl text-text-1 sm:text-7xl">
                  {partida.golsMandante}
                  <span className="mx-1.5 text-text-3 sm:mx-2.5">:</span>
                  {partida.golsVisitante}
                </p>
                {partida.status === 'ao-vivo' && partida.relogio && (
                  <CronometroAoVivo
                    relogio={partida.relogio}
                    duracaoMin={duracaoMin}
                    agoraServidor={Date.now()}
                    classeNumero="numero mt-1 text-2xl text-[var(--accent)]"
                    classeRotulo="hud-label !text-[11px]"
                  />
                )}
                {penaltis && (
                  <p
                    className="corte-direita mt-2 inline-block px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider"
                    style={{ background: 'var(--vermelho)', color: '#ffffff' }}
                  >
                    Pênaltis {partida.penaltisMandante ?? 0} – {partida.penaltisVisitante ?? 0}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex h-16 w-16 rotate-45 items-center justify-center border-2 border-[var(--accent)] bg-[var(--background)] shadow-2 sm:h-20 sm:w-20">
                <span className="titulo-hero -rotate-45 text-2xl text-text-1 sm:text-3xl">VS</span>
              </div>
            )}
          </div>

          {/* Lado Visitante */}
          <div
            className={`flex min-w-0 flex-col items-center gap-2 text-center transition-opacity ${
              mandanteVenceu ? 'opacity-60' : ''
            }`}
          >
            <Escudo equipe={visitante} tamanho={76} />
            {visitante?.sigla && (
              <span className="hud-label !text-[11px] text-text-2">{visitante.sigla}</span>
            )}
            <h2 className="titulo-hero t-sm w-full truncate text-xl text-text-1 sm:text-3xl">
              {visitante?.nome ?? rotuloVisitante ?? 'A definir'}
            </h2>
          </div>
        </div>
      </div>

      {/* Faixa inferior marinho: data, hora, campo e local */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hud bg-[var(--background)] px-4 py-2.5 sm:px-6">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-2">
          {partida.dataHora
            ? formatarDataHora(partida.dataHora)
            : partida.dia !== undefined
              ? `Dia ${partida.dia}`
              : formatarDataHora()}
        </span>
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-text-3">
          {[partida.campo, partida.local].filter(Boolean).join(' · ') || 'Local a definir'}
        </span>
      </div>
    </section>
  );
}
