import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BotaoRemoverEvento, LancadorEventos } from '@/components/admin/LancadorEventos';
import { Sumula } from '@/components/campeonato/Sumula';
import { Aviso, Escudo, Secao, SeloStatus } from '@/components/campeonato/ui';
import { formatarDataHora, indices, lados } from '@/lib/campeonato/consultas';
import { goleiroDaPartida } from '@/lib/domain/campeonato/rankings';
import { calcularSuspensoes, ordenarPartidas } from '@/lib/domain/campeonato/suspensoes';
import { type Equipe, type JogadorCampeonato, type Partida, type StatusPartida } from '@/lib/domain/campeonato/tipos';
import { campeonatoDoAdmin } from '@/lib/campeonato/selecao';
import { adicionarEvento, ajustarPlacar, definirGoleiro, definirStatus, remarcarPartidaAcao, removerEvento } from '../../../acoes';

export const dynamic = 'force-dynamic';

const STATUS: Array<[StatusPartida, string]> = [
  ['agendada', 'Agendada'],
  ['ao-vivo', 'Ao vivo'],
  ['encerrada', 'Encerrada'],
];

export default async function ControlePartida({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const [{ id }, { erro, ok }] = await Promise.all([params, searchParams]);
  const c = await campeonatoDoAdmin();
  const p = c.partidas.find((x) => x.id === id);
  if (!p) notFound();

  const volta = `/admin/partidas/${p.id}`;
  const { equipe } = indices(c);
  const l = lados(c, p, equipe);
  const mandante = l.mandante;
  const visitante = l.visitante;
  const definida = !!mandante && !!visitante;
  const ehMataMata = c.fases.find((f) => f.id === p.faseId)?.tipo === 'mata-mata';

  // Suspensos para ESTE jogo: cartões das partidas anteriores a ele.
  const ordem = ordenarPartidas(c.partidas);
  const anteriores = ordem.slice(0, ordem.findIndex((x) => x.id === p.id));
  const situacao = calcularSuspensoes(anteriores, new Map(c.jogadores.map((j) => [j.id, j.equipeId])));
  const suspensos = new Set([...situacao.values()].filter((s) => s.suspenso).map((s) => s.jogadorId));

  const Placar = ({ lado, penaltis = false }: { lado: 'mandante' | 'visitante'; penaltis?: boolean }) => (
    <div className="flex items-center justify-center gap-2">
      {[-1, 1].map((delta) => (
        <form key={delta} action={ajustarPlacar}>
          <input type="hidden" name="volta" value={volta} />
          <input type="hidden" name="partidaId" value={p.id} />
          <input type="hidden" name="lado" value={lado} />
          <input type="hidden" name="delta" value={delta} />
          {penaltis && <input type="hidden" name="penaltis" value="1" />}
          <button type="submit" className="btn-mini !min-h-11 !min-w-11 text-lg" aria-label={`${delta > 0 ? 'Somar' : 'Tirar'} ${penaltis ? 'pênalti' : 'gol'} do ${lado}`}>
            {delta > 0 ? '+' : '−'}
          </button>
        </form>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/partidas" className="hud-label">
          ← Partidas
        </Link>
        {p.status !== 'encerrada' && (
          <Link href={`/admin/mesario/${p.id}`} className="btn-cta">
            <span>Modo Mesário</span>
          </Link>
        )}
      </div>
      <Aviso texto={erro} />
      <Aviso texto={ok} tipo="ok" />

      <section className="hud-card relative p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="hud-label">
            {p.numero !== undefined ? `Jogo ${p.numero} · ` : ''}
            {p.rotulo ?? ''} · {p.dataHora ? formatarDataHora(p.dataHora) : p.dia !== undefined ? `Dia ${p.dia}` : formatarDataHora()}
          </span>
          <SeloStatus status={p.status} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <LadoTime equipe={mandante} rotulo={l.rotuloMandante} />
          <p className="numero text-7xl sm:text-8xl">
            {p.golsMandante}:{p.golsVisitante}
          </p>
          <LadoTime equipe={visitante} rotulo={l.rotuloVisitante} />
          <Placar lado="mandante" />
          <span />
          <Placar lado="visitante" />
        </div>

        {!definida && (
          <Aviso tipo="info" texto="Os participantes deste jogo ainda não estão definidos: ele não pode começar." />
        )}

        {ehMataMata && (
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-hud pt-4">
            <Placar lado="mandante" penaltis />
            <p className="text-center">
              <span className="hud-label block text-[10px]">Pênaltis</span>
              <span className="numero text-3xl">
                {p.penaltisMandante ?? 0}:{p.penaltisVisitante ?? 0}
              </span>
            </p>
            <Placar lado="visitante" penaltis />
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2 border-t border-hud pt-4">
          {STATUS.map(([s, rotulo]) => (
            <form key={s} action={definirStatus}>
              <input type="hidden" name="volta" value={volta} />
              <input type="hidden" name="partidaId" value={p.id} />
              <input type="hidden" name="status" value={s} />
              <button type="submit" className="btn-mini" aria-pressed={p.status === s}>
                {rotulo}
              </button>
            </form>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-text-3">
          Gol registrado na súmula já soma no placar. Use + e − só para gols sem autor.
          {ehMataMata && ' Jogo eliminatório empatado só encerra com placar de pênaltis.'}
        </p>
      </section>

      {p.status === 'agendada' && (
        <details className="hud-card p-4">
          <summary className="hud-label cursor-pointer select-none">Remarcar horário</summary>
          <form action={remarcarPartidaAcao} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="volta" value={volta} />
            <input type="hidden" name="partidaId" value={p.id} />
            <label className="min-w-[13rem] flex-1">
              <span className="rotulo-campo">Data e hora</span>
              <input name="dataHora" type="datetime-local" defaultValue={p.dataHora ?? ''} required className="campo" />
            </label>
            {p.numero !== undefined && p.dia !== undefined && (
              <label className="flex items-center gap-2 pb-3 text-sm text-text-2">
                <input type="checkbox" name="empurrar" value="1" defaultChecked className="h-5 w-5 accent-[var(--accent)]" />
                Empurrar os jogos seguintes do dia
              </label>
            )}
            <button type="submit" className="btn-mini">
              Remarcar
            </button>
          </form>
        </details>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(['mandante', 'visitante'] as const).map((lado) => {
          const e = lado === 'mandante' ? mandante : visitante;
          return e ? (
            <FormEvento
              key={e.id}
              equipe={e}
              lado={lado}
              partida={p}
              goleiro={goleiroDaPartida(p, lado, c.jogadores)}
              jogadores={c.jogadores.filter((j) => j.equipeId === e.id)}
              suspensos={suspensos}
              volta={volta}
            />
          ) : null;
        })}
      </div>

      <Secao titulo="Súmula">
        <Sumula
          partida={p}
          campeonato={c}
          acao={(ev) => (
            <BotaoRemoverEvento acao={removerEvento} partidaId={p.id} eventoId={ev.id} volta={volta} />
          )}
        />
      </Secao>
    </div>
  );
}

function LadoTime({ equipe, rotulo }: { equipe?: Equipe; rotulo?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Escudo equipe={equipe} tamanho={64} />
      <span className={`titulo-hero t-sm text-base ${equipe ? '' : 'text-text-3'}`}>{equipe?.nome ?? rotulo ?? 'A definir'}</span>
      {equipe && rotulo && <span className="hud-label !text-[10px]">{rotulo}</span>}
    </div>
  );
}

function FormEvento({
  equipe,
  lado,
  partida,
  goleiro,
  jogadores,
  suspensos,
  volta,
}: {
  equipe: Equipe;
  lado: 'mandante' | 'visitante';
  partida: Partida;
  /** Goleiro registrado ou, na falta, o único goleiro do elenco. */
  goleiro?: string;
  jogadores: JogadorCampeonato[];
  suspensos: Set<string>;
  volta: string;
}) {
  const partidaId = partida.id;
  const fora = jogadores.filter((j) => suspensos.has(j.id));
  const registrado = lado === 'mandante' ? partida.goleiroMandanteId : partida.goleiroVisitanteId;
  return (
    <Secao titulo={equipe.nome}>
      {fora.length > 0 && (
        <Aviso tipo="info" texto={`Suspensos neste jogo: ${fora.map((j) => j.nome).join(', ')}.`} />
      )}
      <form action={definirGoleiro} className="mb-4 flex items-end gap-2 border-b border-hud pb-4">
        <input type="hidden" name="volta" value={volta} />
        <input type="hidden" name="partidaId" value={partidaId} />
        <input type="hidden" name="lado" value={lado} />
        <label className="flex-1">
          <span className="rotulo-campo">Goleiro nesta partida{!registrado && goleiro ? ' (do elenco, não registrado)' : ''}</span>
          <select name="jogadorId" className="campo" defaultValue={registrado ?? ''}>
            <option value="">{goleiro && !registrado ? `Automático: ${jogadores.find((j) => j.id === goleiro)?.nome}` : 'Não definido'}</option>
            {jogadores.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nome}
                {j.posicao === 'GOL' ? ' (GOL)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-mini">
          Salvar
        </button>
      </form>
      {jogadores.length === 0 ? (
        <p className="text-sm text-text-3">Sem jogadores cadastrados nesta equipe.</p>
      ) : (
        <LancadorEventos
          acao={adicionarEvento}
          partidaId={partidaId}
          volta={volta}
          goleiroId={goleiro}
          jogadores={jogadores.map((j) => ({ id: j.id, nome: j.nome, numero: j.numero, goleiro: j.posicao === 'GOL', suspenso: suspensos.has(j.id) }))}
        />
      )}
    </Secao>
  );
}
