import Link from 'next/link';
import { AbasRankings } from '@/components/campeonato/AbasRankings';
import { Premiacao } from '@/components/campeonato/Premiacao';
import { Cabecalho, Cartao, Escudo, Secao, Vazio } from '@/components/campeonato/ui';
import { fundoVisivel } from '@/lib/campeonato/cores';
import { indices } from '@/lib/campeonato/consultas';
import { artilharia, assistencias, cartoes, goleiros } from '@/lib/domain/campeonato/rankings';
import type { Campeonato, LinhaRankingManual } from '@/lib/domain/campeonato/tipos';

export function PaginaRankings({ c, base, fase }: { c: Campeonato; base: string; fase?: string }) {
  const { equipe, jogador } = indices(c);
  const partidas = fase ? c.partidas.filter((p) => p.faseId === fase) : c.partidas;

  /** Nome e equipe de um item: do elenco (súmulas) ou do próprio item (ranking lançado à mão). */
  const quem = (it: { jogadorId: string; nome?: string; equipeId?: string }) => {
    const j = jogador.get(it.jogadorId);
    const equipeId = it.equipeId ?? j?.equipeId;
    return { nome: it.nome ?? j?.nome, e: equipeId ? equipe.get(equipeId) : undefined };
  };

  const linhaJogador = (it: { jogadorId: string; nome?: string; equipeId?: string }) => {
    const { nome, e } = quem(it);
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Escudo equipe={e} tamanho={22} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{nome ?? '—'}</span>
          <span className="block truncate text-xs text-text-3">{e?.nome}</span>
        </span>
      </span>
    );
  };

  const lista = (
    itens: Array<{
      jogadorId: string;
      valor: React.ReactNode;
      detalhe?: string;
      /** Igualdade de chave = mesma posição. */
      chave?: string;
      /** Ranking lançado à mão: nome e equipe vêm do item. */
      nome?: string;
      equipeId?: string;
    }>,
    vazio: string,
    destacarLider = true,
  ) => {
    if (itens.length === 0) {
      return <Vazio texto={vazio} />;
    }

    // Empatados dividem a posição (1, 1, 3...), em vez de uma ordem arbitrária.
    const chave = (i: number) => itens[i].chave ?? String(itens[i].valor);
    const posicoes: number[] = [];
    itens.forEach((_, i) => posicoes.push(i > 0 && chave(i) === chave(i - 1) ? posicoes[i - 1] : i + 1));

    const [lider, ...resto] = itens.slice(0, 10);
    const { nome: nomeLider, e: eqLider } = quem(lider);
    const corLider = eqLider ? fundoVisivel([eqLider.corPrimaria, eqLider.corSecundaria]) : undefined;

    return (
      <div className="space-y-2">
        {destacarLider ? (
          /* Líder em destaque: barra na cor do time à esquerda e número em Big Shoulders dourado (manual §7.3).
             O texto fica sempre sobre o marinho: a cor do time nunca vai atrás de nome ou número. */
          <div className="relative overflow-hidden border border-hud bg-[var(--surface2)] p-3 pl-5">
            <span className="absolute inset-y-0 left-0 w-[6px]" style={{ background: corLider ?? 'var(--accent)' }} aria-hidden="true" />
            <div className="flex items-center gap-3">
              <span
                className="numero corte-direita inline-flex h-8 w-8 shrink-0 items-center justify-center pr-1 text-lg"
                style={{ background: 'var(--gradient-leonida)', color: '#06122a' }}
              >
                1
              </span>
              <Escudo equipe={eqLider} tamanho={38} />
              <div className="min-w-0 flex-1">
                <p className="titulo-hero t-sm truncate text-xl text-text-1">
                  {nomeLider ?? '—'}
                </p>
                <p className="truncate font-mono text-[13px] font-bold uppercase tracking-wider text-text-2">
                  {eqLider?.nome}
                </p>
                {lider.detalhe && (
                  <p className="mt-0.5 font-mono text-[13px] text-text-2">{lider.detalhe}</p>
                )}
              </div>
              <div className="rounded-component bg-[rgba(6,18,42,0.86)] px-3 py-1.5 text-right shadow-1">
                <span className="numero text-4xl sm:text-5xl" style={{ color: 'var(--accent)' }}>
                  {lider.valor}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <ol className="divide-y divide-[var(--panel-stroke)]">
          {(destacarLider ? resto : itens.slice(0, 10)).map((it, idx) => {
            const pos = posicoes[destacarLider ? idx + 1 : idx];
            return (
              <li key={`${it.jogadorId}-${it.nome ?? ''}`} className="flex items-center gap-3 py-2">
                <span className="numero w-7 text-lg text-text-2">{pos}</span>
                <span className="min-w-0 flex-1">
                  {linhaJogador(it)}
                  {it.detalhe && (
                    <span className="mt-0.5 block font-mono text-[13px] text-text-3">{it.detalhe}</span>
                  )}
                </span>
                <span className="numero text-3xl" style={{ color: 'var(--accent)' }}>
                  {it.valor}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  /**
   * Edição antiga sem súmulas: vale o ranking lançado à mão (resultado oficial).
   * Com gols nas súmulas, o cálculo do sistema prevalece. Só sem filtro de fase.
   */
  const comHistorico = (calculado: Array<{ jogadorId: string; valor: number }>, manual?: LinhaRankingManual[]) =>
    calculado.length === 0 && !fase && manual?.length
      ? manual.map((l, i) => ({ jogadorId: `manual-${i}`, nome: l.jogador, equipeId: l.equipeId, valor: l.valor }))
      : calculado;

  const filtro = (id?: string) => `${base}/rankings${id ? `?fase=${id}` : ''}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-20">
      <Cabecalho titulo="Rankings" />
      <Premiacao premios={c.premios ?? []} equipe={equipe} titulo="Premiação individual" />
      {c.fases.length > 0 && (
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [&>*]:flex-none" aria-label="Filtrar por fase">
        <Link href={filtro()} className="btn-hud !min-h-[2.75rem] !text-sm" aria-current={!fase ? 'page' : undefined}>
          Todas as fases
        </Link>
        {c.fases.map((f) => (
          <Link key={f.id} href={filtro(f.id)} className="btn-hud !min-h-[2.75rem] !text-sm" aria-current={fase === f.id ? 'page' : undefined}>
            {f.nome}
          </Link>
        ))}
      </nav>
      )}
      <AbasRankings
        abas={[
          {
            id: 'artilharia',
            titulo: 'Artilharia',
            conteudo: (
              <Secao titulo="Artilharia">{lista(comHistorico(artilharia(partidas), c.historico?.artilharia), 'Nenhum gol registrado.')}</Secao>
            ),
          },
          {
            id: 'assistencias',
            titulo: 'Assistências',
            conteudo: (
              <Secao titulo="Assistências">{lista(comHistorico(assistencias(partidas), c.historico?.assistencias), 'Nenhuma assistência registrada.')}</Secao>
            ),
          },
          {
            id: 'cartoes',
            titulo: 'Cartões',
            conteudo: (
              <Secao titulo="Cartões">
                {lista(
                  cartoes(partidas).map((x) => ({
                    jogadorId: x.jogadorId,
                    chave: `${x.vermelhos}-${x.amarelos}`,
                    valor: (
                      <span className="flex gap-3">
                        {x.amarelos > 0 && <Cartao cor="amarelo" quantidade={x.amarelos} />}
                        {x.vermelhos > 0 && <Cartao cor="vermelho" quantidade={x.vermelhos} />}
                      </span>
                    ),
                  })),
                  'Nenhum cartão registrado.',
                  false,
                )}
              </Secao>
            ),
          },
          {
            id: 'goleiros',
            titulo: 'Goleiros',
            conteudo: (
              <Secao titulo="Goleiros">
                {lista(
                  goleiros(partidas, c.jogadores).map((g) => ({
                    jogadorId: g.jogadorId,
                    valor: g.media.toLocaleString('pt-BR'),
                    detalhe: `${g.golsSofridos} sofridos em ${g.jogos} ${g.jogos === 1 ? 'jogo' : 'jogos'} · ${g.semSofrerGol} sem sofrer gol · ${g.defesas} ${g.defesas === 1 ? 'defesa' : 'defesas'}`,
                  })),
                  'Nenhum jogo encerrado com goleiro definido.',
                )}
                <p className="mt-2 text-xs text-text-3">Número grande: média de gols sofridos por jogo (menos é melhor).</p>
              </Secao>
            ),
          },
        ]}
      />
    </div>
  );
}
