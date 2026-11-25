import Image from 'next/image';
import Link from 'next/link';
import { AutoAtualizar } from '@/components/campeonato/AutoAtualizar';
import { LinhaPartida, partesDaData } from '@/components/campeonato/Partidas';
import { Patrocinadores } from '@/components/campeonato/Patrocinadores';
import { Premiacao } from '@/components/campeonato/Premiacao';
import { Escudo, Numero, SeloStatus, Vazio, edicaoSemJogos } from '@/components/campeonato/ui';
import { fundoVisivel } from '@/lib/campeonato/cores';
import { formatarData, indices, lados } from '@/lib/campeonato/consultas';
import { andamento, projecaoMataMata, type Projecao } from '@/lib/domain/campeonato/andamento';
import type { CampeonatoPublico } from '@/lib/campeonato/selecao';
import { podio } from '@/lib/domain/campeonato/chaveamento';
import { resumirJogos } from '@/lib/domain/campeonato/classificacao';
import { ordenarPartidas } from '@/lib/domain/campeonato/suspensoes';
import { ROTULO_STATUS_CAMPEONATO, type Campeonato, type Equipe, type Partida } from '@/lib/domain/campeonato/tipos';

/** Início de uma edição: banner, escudo, status, período, pódio, franquias e jogos. */
export function PaginaInicio({ c, base, edicoes, patrocinadores }: CampeonatoPublico) {
  const { equipe } = indices(c);
  const ordenadas = ordenarPartidas(c.partidas);
  const aoVivo = ordenadas.filter((p) => p.status === 'ao-vivo');
  const a = andamento(c.partidas);
  const projecao = projecaoMataMata(c);
  // O jogo em destaque é o ao vivo ou, sem ele, o próximo; a lista começa depois dele.
  const destaque = aoVivo[0] ?? a.proxima;
  const proximas = ordenadas.filter((p) => p.status === 'agendada' && p.id !== destaque?.id).slice(0, 4);
  const ultimas = ordenadas.filter((p) => p.status === 'encerrada').slice(-4).reverse();
  const resumo = resumirJogos(c.partidas);
  // Pódio das súmulas (modelo) ou, em edição antiga, o lançado à mão.
  const manual = c.historico?.podio;
  const resultado = podio(c) ?? (manual?.primeiro ? { primeiro: manual.primeiro, segundo: manual.segundo, terceiro: manual.terceiro } : null);
  // Status é do campeonato; o vermelho "ao vivo" fica só com os jogos (manual: vermelho só para ao vivo, erro e eliminado).
  const status = ROTULO_STATUS_CAMPEONATO[c.status];
  const outras = edicoes.filter((e) => e.id !== c.id);
  const titulo = [c.nome, c.edicao && !c.nome.includes(c.edicao) ? c.edicao : ''].filter(Boolean).join(' ');

  return (
    <>
      <AutoAtualizar ativo={aoVivo.length > 0} />
      <section className="relative">
        <div className={`relative w-full overflow-hidden ${c.banner ? 'py-8 sm:py-0' : ''}`}>
          {c.banner && (
            // Arte cadastrada no admin é 4:1: no celular ganha moldura com a própria arte desfocada (CLAUDE.md §5).
            <div
              className="pointer-events-none absolute inset-0 scale-110 sm:hidden"
              style={{
                backgroundImage: `url(${c.banner})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(26px) saturate(1.15)',
              }}
              aria-hidden="true"
            />
          )}
          <h1 className="sr-only">{titulo}</h1>
          {c.banner ? (
            // Arte da edição cadastrada no admin (caminho ou URL).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.banner} alt={titulo} className="relative block h-auto w-full" />
          ) : (
            <>
              {/* Celular: versão 5:2 com céu e água completos; desktop: a arte larga 4:1. */}
              <Image src="/banner-copa-jumentus-celular.webp" alt={titulo} width={2000} height={800} priority sizes="100vw" className="relative block h-auto w-full sm:hidden" />
              <Image src="/banner-copa-jumentus.webp" alt="" width={2000} height={504} priority sizes="100vw" className="relative hidden h-auto w-full sm:block" />
            </>
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[18%] sm:h-[14%]"
            style={{ backgroundImage: 'linear-gradient(180deg, transparent 0%, var(--background) 92%)' }}
            aria-hidden="true"
          />
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 pb-20 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            {c.escudo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.escudo} alt="" width={72} height={72} className="h-[72px] w-auto shrink-0 object-contain" />
            )}
            <div>
              <p className="hud-label mb-2">{c.subtitulo ?? (c.edicao ? `Edição ${c.edicao}` : 'Copa Jumentus')}</p>
              <h2 className="titulo-hero t-xl text-4xl sm:text-5xl">{titulo}</h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Edição encerrada sem data ou local (as do Copa Fácil): não mostra "A definir". */}
            {(c.inicio || c.status !== 'encerrado') && (
              <Info rotulo="Período" valor={c.inicio ? `${formatarData(c.inicio)}${c.fim ? ` – ${formatarData(c.fim)}` : ''}` : 'A definir'} />
            )}
            {(c.local || c.status !== 'encerrado') && <Info rotulo="Local" valor={c.local ?? 'A definir'} />}
            <Info rotulo="Status" valor={status} />
          </div>
        </div>

        {resultado && <Podio primeiro={equipe.get(resultado.primeiro)} segundo={resultado.segundo ? equipe.get(resultado.segundo) : undefined} terceiro={resultado.terceiro ? equipe.get(resultado.terceiro) : undefined} />}

        <Premiacao premios={c.premios ?? []} equipe={equipe} />

        {/* Andamento: quantos jogos já foram, de quantos. Edição antiga sem jogos no sistema não mostra. */}
        {a.total > 0 && (
          <div className="hud-card hud-clip modulo relative grid grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-4">
            <div className="col-span-2">
              <p className="hud-label !text-[12px]">{a.terminou ? 'Campeonato encerrado' : a.dia ? `Andamento · Dia ${a.dia}` : 'Andamento'}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="numero text-5xl text-text-1">{a.encerrados}</span>
                <span className="font-mono text-base font-bold uppercase tracking-wider text-text-2">de {a.total} jogos</span>
              </p>
              <div className="mt-2 h-2 w-full bg-[var(--surface3)]" role="progressbar" aria-valuemin={0} aria-valuemax={a.total} aria-valuenow={a.encerrados} aria-label="Jogos encerrados">
                <div className="h-full" style={{ width: `${a.total ? (a.encerrados / a.total) * 100 : 0}%`, backgroundImage: 'var(--gradient-leonida)' }} />
              </div>
            </div>
            <Numero valor={resumo.gols} rotulo="Gols" />
            <Numero valor={resumo.mediaGols.toLocaleString('pt-BR')} rotulo="Média por jogo" />
          </div>
        )}

        {/* Faixa de escudos das franquias participantes */}
        {c.equipes.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {c.equipes.map((eq) => (
              <Link
                key={eq.id}
                href={`${base}/equipes`}
                className="hud-card flex flex-col items-center gap-1.5 px-2 py-3 text-center transition-transform hover:-translate-y-0.5"
                style={{ borderBottom: `3px solid ${fundoVisivel([eq.corPrimaria, eq.corSecundaria]) ?? 'var(--border-visible)'}` }}
                title={eq.nome}
              >
                <Escudo equipe={eq} tamanho={36} />
                <span className="w-full truncate font-mono text-xs font-bold uppercase tracking-wider text-text-2">
                  {eq.sigla || eq.nome}
                </span>
              </Link>
            ))}
          </div>
        )}

        {destaque && (
          <section>
            <h3 className="titulo-hero t-sm mb-4 text-2xl">{destaque.status === 'ao-vivo' ? 'Ao vivo' : 'Próximo jogo'}</h3>
            <PalcoJogo c={c} partida={destaque} equipe={equipe} href={`${base}/jogos/${destaque.id}`} projecao={projecao.get(destaque.id)} />
            {aoVivo.length > 1 && (
              <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                {aoVivo.slice(1).map((p) => (
                  <LinhaPartida key={p.id} c={c} partida={p} equipe={equipe} href={`${base}/jogos/${p.id}`} projecao={projecao.get(p.id)} />
                ))}
              </div>
            )}
          </section>
        )}

        {c.partidas.length === 0 && !edicaoSemJogos(c) && <Vazio texto="A tabela de jogos ainda não saiu." detalhe="Os jogos aparecem aqui assim que a organização definir os confrontos." />}

        <div className="grid gap-8 lg:grid-cols-2">
          {proximas.length > 0 && (
            <Lista titulo="Na sequência" href={`${base}/jogos`}>
              {proximas.map((p) => (
                <LinhaPartida key={p.id} c={c} partida={p} equipe={equipe} href={`${base}/jogos/${p.id}`} projecao={projecao.get(p.id)} />
              ))}
            </Lista>
          )}
          {ultimas.length > 0 && (
            <Lista titulo="Últimos resultados" href={`${base}/jogos`}>
              {ultimas.map((p) => (
                <LinhaPartida key={p.id} c={c} partida={p} equipe={equipe} href={`${base}/jogos/${p.id}`} />
              ))}
            </Lista>
          )}
        </div>

        {c.partidas.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Link href={`${base}/classificacao`} className="btn-cta">
              <span>Ver classificação</span>
            </Link>
            <Link href={`${base}/jogos`} className="btn-hud">
              Todos os jogos
            </Link>
            {!base && (
              <Link href="/regulamento" className="btn-hud">
                Regulamento
              </Link>
            )}
          </div>
        )}

        <Patrocinadores patrocinadores={patrocinadores} />

        {outras.length > 0 && (
          <section>
            <h3 className="titulo-hero t-sm mb-4 text-2xl">Outras edições</h3>
            <ul className="flex flex-wrap gap-2">
              {outras.map((e) => (
                <li key={e.id}>
                  <Link href={`/edicoes/${e.slug}`} className="btn-hud !py-1.5 !text-sm">
                    {e.nome}
                    {e.edicao && !e.nome.includes(e.edicao) ? ` ${e.edicao}` : ''} · {ROTULO_STATUS_CAMPEONATO[e.status]}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * Pódio no formato de pódio: campeão no centro e mais alto, vice à esquerda,
 * 3º à direita. Só o campeão leva o dourado metálico (exclusivo da Copa).
 */
function Podio({ primeiro, segundo, terceiro }: { primeiro?: Equipe; segundo?: Equipe; terceiro?: Equipe }) {
  const degraus: Array<{ pos: number; rotulo: string; e?: Equipe; escudo: number; altura: string }> = [
    { pos: 2, rotulo: 'Vice', e: segundo, escudo: 56, altura: 'h-16 sm:h-20' },
    { pos: 1, rotulo: 'Campeão', e: primeiro, escudo: 88, altura: 'h-24 sm:h-28' },
    { pos: 3, rotulo: '3º lugar', e: terceiro, escudo: 48, altura: 'h-10 sm:h-14' },
  ];
  return (
    <section className="hud-card hud-clip modulo relative px-3 pb-0 pt-4 sm:px-6" aria-label="Pódio">
      <h3 className="titulo-hero t-sm mb-2 text-2xl">Pódio</h3>
      <ol className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {degraus.map(({ pos, rotulo, e, escudo, altura }) => (
          <li key={pos} className="flex min-w-0 flex-col items-center text-center">
            <Escudo equipe={e} tamanho={escudo} />
            <span className="hud-label mt-2 !text-[12px]" style={pos === 1 ? { color: 'var(--dourado-claro)' } : undefined}>
              {rotulo}
            </span>
            <span className={`titulo-hero t-sm mb-2 line-clamp-2 leading-none ${pos === 1 ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}>
              {e?.nome ?? 'A definir'}
            </span>
            <span
              className={`numero flex w-full items-start justify-center pt-1 text-4xl ${altura}`}
              style={pos === 1 ? { backgroundImage: 'var(--gradient-leonida)', color: '#06122a' } : { background: 'var(--surface3)', color: 'var(--text1)' }}
              aria-hidden="true"
            >
              {pos}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="hud-card relative px-3 py-2">
      <p className="hud-label !text-[12px]">{rotulo}</p>
      <p className="text-sm font-semibold text-text-1">{valor}</p>
    </div>
  );
}

function Lista({ titulo, children, href }: { titulo: string; children: React.ReactNode; href?: string }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="titulo-hero t-sm text-2xl">{titulo}</h3>
        {href && (
          <Link href={href} className="hud-label !text-[13px] hover:text-text-1">
            Ver todos
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">{children}</div>
    </section>
  );
}

/**
 * Jogo em destaque (ao vivo ou próximo), no palco do Matchday do manual: metade de
 * cada time, escudos grandes, placar ou horário no centro. O texto fica sempre sobre
 * marinho; as cores dos times entram só nas faixas laterais.
 */
function PalcoJogo({ c, partida, equipe, href, projecao }: { c: Campeonato; partida: Partida; equipe: Map<string, Equipe>; href: string; projecao?: Projecao }) {
  const l = lados(c, partida, equipe);
  const mandante = l.mandante ?? (projecao?.mandanteId ? equipe.get(projecao.mandanteId) : undefined);
  const visitante = l.visitante ?? (projecao?.visitanteId ? equipe.get(projecao.visitanteId) : undefined);
  const cor = (e?: Equipe) => (e ? (fundoVisivel([e.corPrimaria, e.corSecundaria]) ?? 'var(--surface3)') : 'var(--surface3)');
  const { hora, dia } = partesDaData(partida.dataHora);
  const aoVivo = partida.status === 'ao-vivo';
  const penaltis = partida.golsMandante === partida.golsVisitante && (partida.penaltisMandante !== undefined || partida.penaltisVisitante !== undefined);
  const lado = (e: Equipe | undefined, rotulo: string | undefined, definido: boolean) => (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <Escudo equipe={e} tamanho={72} />
      <span className={`titulo-hero t-sm line-clamp-2 text-xl leading-none sm:text-2xl ${definido ? 'text-text-1' : 'text-text-2'}`}>
        {definido ? e?.nome : (rotulo ?? 'A definir')}
      </span>
      {!definido && e && <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-text-3">hoje: {e.nome}</span>}
    </div>
  );
  return (
    <Link href={href} className="hud-card hud-clip modulo relative block overflow-hidden px-4 pb-6 pt-4 transition-colors hover:bg-[var(--row-hover)]">
      <span className="absolute inset-y-0 left-0 w-[6px]" style={{ background: cor(mandante) }} aria-hidden="true" />
      <span className="absolute inset-y-0 right-0 w-[6px]" style={{ background: cor(visitante) }} aria-hidden="true" />
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="hud-label truncate !text-[13px]">
          {partida.numero !== undefined && <span style={{ color: 'var(--accent)' }}>J{partida.numero} · </span>}
          {partida.rotulo ?? ''}
        </span>
        <SeloStatus status={partida.status} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {lado(mandante, l.rotuloMandante, !!l.mandante)}
        <div className="text-center">
          {partida.status === 'agendada' ? (
            <>
              <p className="numero text-5xl text-text-1 sm:text-6xl">{hora ?? 'vs'}</p>
              {dia && <p className="mt-1 font-mono text-[13px] font-bold uppercase tracking-wider text-text-2">{dia}</p>}
            </>
          ) : (
            <>
              <p className="numero text-6xl sm:text-7xl" style={{ color: aoVivo ? 'var(--text1)' : 'var(--accent)' }}>
                {partida.golsMandante}:{partida.golsVisitante}
              </p>
              {penaltis && (
                <p className="font-mono text-sm font-bold text-[var(--error-text)]">
                  pên. {partida.penaltisMandante ?? 0}–{partida.penaltisVisitante ?? 0}
                </p>
              )}
            </>
          )}
        </div>
        {lado(visitante, l.rotuloVisitante, !!l.visitante)}
      </div>
    </Link>
  );
}
