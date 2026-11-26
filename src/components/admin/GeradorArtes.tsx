'use client';

// Admin › Artes (esboço aprovado pelo operador em 25/11/2026): uma miniatura por
// seção; cada seção tem as suas escolhas em passos (ex.: Resultados → rodada →
// jogo ou todos → formato), prévia, download do PNG (ou .zip quando são vários),
// "Compartilhar" no celular e "Baixar todas as artes". O desenho fica em
// components/artes/pecas.ts; os dados, em lib/domain/campeonato/artes.ts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALTURA, L, desenharPeca, formatosDa, gerarPng, nomeDaPeca, paginarRegulamento, type Formato, type Peca } from '@/components/artes/pecas';
import {
  blocosDeJogos,
  campeaoArte,
  chaveArte,
  classificacaoArte,
  diasArte,
  elencosArte,
  gruposArte,
  jogadorSelecaoArte,
  jogadoresDaPartida,
  melhorDaPartidaArte,
  rankingArte,
  type JogadorSelecaoArte,
} from '@/lib/domain/campeonato/artes';
import type { SecaoRegulamento } from '@/lib/domain/campeonato/regulamento';
import type { Campeonato } from '@/lib/domain/campeonato/tipos';
import { ehGoleiro } from '@/lib/domain/tipos';
import { criarZip } from '@/lib/zip';

type IdSecao =
  | 'resultados'
  | 'classificacao'
  | 'programacao'
  | 'artilharia'
  | 'assistencias'
  | 'elencos'
  | 'mata-mata'
  | 'melhor'
  | 'selecao'
  | 'campeao'
  | 'regulamento'
  | 'divulgacao';

type EscolhaFormato = 'ambos' | 'feed' | 'story';

interface Item {
  peca: Peca;
  f: Formato;
}

const SECOES: Array<{ id: IdSecao; nome: string; miniatura: string }> = [
  { id: 'resultados', nome: 'Resultados', miniatura: '/imagens/fundos/resultados-feed.webp' },
  { id: 'classificacao', nome: 'Classificação', miniatura: '/imagens/fundos/classificacao-feed.webp' },
  { id: 'programacao', nome: 'Programação do dia', miniatura: '/imagens/fundos/campo-feed.webp' },
  { id: 'artilharia', nome: 'Artilharia', miniatura: '/imagens/fundos/noite-feed.webp' },
  { id: 'assistencias', nome: 'Assistências', miniatura: '/imagens/fundos/noite-feed.webp' },
  { id: 'elencos', nome: 'Elencos', miniatura: '/imagens/fundos/time-inter-miami-feed.webp' },
  { id: 'mata-mata', nome: 'Mata-mata', miniatura: '/imagens/fundos/mata-mata-feed.webp' },
  { id: 'melhor', nome: 'Melhor da partida', miniatura: '/imagens/fundos/melhor-da-partida-feed.webp' },
  { id: 'selecao', nome: 'Seleção da Copa', miniatura: '/imagens/fundos/campo-feed.webp' },
  { id: 'campeao', nome: 'Campeão', miniatura: '/imagens/fundos/campeao-feed.webp' },
  { id: 'regulamento', nome: 'Regulamento', miniatura: '/imagens/fundos/regulamento-feed.webp' },
  { id: 'divulgacao', nome: 'Divulgação', miniatura: '/imagens/divulgacao/anuncio-feed.webp' },
];

const DIVULGACAO: Array<{ nome: string; rotulo: string; formato: Formato }> = [
  { nome: 'anuncio-feed', rotulo: 'Anúncio · feed', formato: 'feed' },
  { nome: 'anuncio-stories', rotulo: 'Anúncio · stories', formato: 'story' },
  { nome: 'premiacao-feed', rotulo: 'Premiação · feed', formato: 'feed' },
  { nome: 'premiacao-stories', rotulo: 'Premiação · stories', formato: 'story' },
  { nome: 'sorteio-feed', rotulo: 'Sorteio dos elencos · feed', formato: 'feed' },
  { nome: 'sorteio-stories', rotulo: 'Sorteio dos elencos · stories', formato: 'story' },
  { nome: 'patrocinio-feed', rotulo: 'Patrocínio · feed', formato: 'feed' },
  { nome: 'patrocinio-stories', rotulo: 'Patrocínio · stories', formato: 'story' },
];
const pecaDivulgacao = (d: (typeof DIVULGACAO)[number]): Peca => ({ tipo: 'divulgacao', nome: d.nome, src: `/imagens/divulgacao/${d.nome}.webp`, formato: d.formato });

const JOGOS_POR_PARTE = 8;
const VAGAS_SELECAO = ['Goleiro', 'Linha 1', 'Linha 2', 'Linha 3', 'Linha 4', 'Linha 5', 'Linha 6', 'Linha 7'];

function expandir(pecas: Peca[], escolha: EscolhaFormato): Item[] {
  return pecas.flatMap((peca) => {
    const todos = formatosDa(peca);
    const filtrados = escolha === 'ambos' ? todos : todos.filter((f) => f === escolha);
    return (filtrados.length ? filtrados : todos).map((f) => ({ peca, f }));
  });
}

function partes<T>(lista: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < lista.length; i += n) r.push(lista.slice(i, i + n));
  return r.length ? r : [[]];
}

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- componentes pequenos ----------

function Passo({ n, titulo, children }: { n?: number; titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="hud-label mb-2" style={{ color: 'var(--accent)' }}>
        {n !== undefined ? `${n} · ` : ''}
        {titulo}
      </p>
      {children}
    </div>
  );
}

function Opcoes<T extends string>({
  valor,
  opcoes,
  aoEscolher,
  rotulo,
}: {
  valor: T;
  opcoes: Array<{ valor: T; rotulo: string; desligado?: boolean }>;
  aoEscolher: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="-mr-4 flex gap-1.5 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          disabled={o.desligado}
          onClick={() => aoEscolher(o.valor)}
          className="opcao-arte"
          data-ativo={valor === o.valor || undefined}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function ListaEscolha({
  valor,
  opcoes,
  aoEscolher,
  rotulo,
}: {
  valor: string;
  opcoes: Array<{ valor: string; titulo: string; sub?: string; desligado?: boolean }>;
  aoEscolher: (v: string) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="space-y-1.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          disabled={o.desligado}
          onClick={() => aoEscolher(o.valor)}
          className="linha-arte"
          data-ativo={valor === o.valor || undefined}
        >
          <span aria-hidden className="bolinha" />
          <span className="min-w-0 text-left">
            <span className="block truncate font-semibold">{o.titulo}</span>
            {o.sub && <span className="block text-xs text-text-3">{o.sub}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function Previa({ item, assinatura }: { item: Item; assinatura: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let vivo = true;
    setPronto(false);
    void desenharPeca(canvas, item.peca, item.f, assinatura).then(() => vivo && setPronto(true));
    return () => {
      vivo = false;
    };
  }, [item, assinatura]);
  return (
    <figure className="w-full">
      <canvas
        ref={ref}
        className="block w-full bg-[var(--surface1)] shadow-[0_8px_20px_rgba(0,0,0,.5)]"
        style={{ aspectRatio: `${L} / ${ALTURA[item.f]}`, opacity: pronto ? 1 : 0.35, transition: 'opacity 200ms' }}
        aria-label={`Prévia: ${nomeDaPeca(item.peca, item.f)}`}
      />
      <figcaption className="hud-label mt-1.5 text-center !text-[11px]">{item.f === 'feed' ? 'Feed' : 'Stories'}</figcaption>
    </figure>
  );
}

// ---------- tela ----------

export function GeradorArtes({ c, assinatura, regulamento }: { c: Campeonato; assinatura: string; regulamento: SecaoRegulamento[] }) {
  const blocos = useMemo(() => blocosDeJogos(c), [c]);
  const grupos = useMemo(() => gruposArte(c), [c]);
  const dias = useMemo(() => diasArte(c), [c]);
  const elencos = useMemo(() => elencosArte(c).filter((e) => e.jogadores.length > 0), [c]);
  const chave = useMemo(() => chaveArte(c), [c]);
  const campeao = useMemo(() => campeaoArte(c), [c]);
  const paginasRegulamento = useMemo(() => (typeof document === 'undefined' ? [regulamento] : paginarRegulamento(regulamento)), [regulamento]);

  const comJogo = (b: (typeof blocos)[number]) => b.jogos.some((j) => j.golsMandante !== undefined);
  const blocoInicial = [...blocos].reverse().find(comJogo)?.id ?? blocos[0]?.id ?? '';
  // Blocos que já tiveram jogo encerrado: momentos possíveis de classificação e rankings.
  const momentos = blocos.filter((b) => b.jogos.some((j) => j.encerrado));

  const [secao, setSecao] = useState<IdSecao>('resultados');
  const [formato, setFormato] = useState<EscolhaFormato>('ambos');
  const [bloco, setBloco] = useState(blocoInicial);
  const [jogo, setJogo] = useState('todos');
  const [grupo, setGrupo] = useState(grupos[0]?.id ?? '');
  const [momento, setMomento] = useState('atual');
  const [dia, setDia] = useState(dias[0]?.id ?? '');
  const [parte, setParte] = useState(0);
  const [topo, setTopo] = useState<'5' | '7'>('7');
  const [equipe, setEquipe] = useState('todos');
  const [jogador, setJogador] = useState('');
  const [selecao, setSelecao] = useState<string[]>(() => VAGAS_SELECAO.map(() => ''));
  const [subtitulo, setSubtitulo] = useState('Copa Jumentus 2027');
  const [pagina, setPagina] = useState('todas');
  const [divulgacao, setDivulgacao] = useState(DIVULGACAO[0].nome);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);

  useEffect(() => {
    try {
      const teste = new File([new Blob()], 'a.png', { type: 'image/png' });
      setPodeCompartilhar(typeof navigator.canShare === 'function' && navigator.canShare({ files: [teste] }));
    } catch {
      setPodeCompartilhar(false);
    }
  }, []);

  const blocoAtual = blocos.find((b) => b.id === bloco);
  const diaAtual = dias.find((d) => d.id === dia);
  const partesDoDia = partes(diaAtual?.jogos ?? [], JOGOS_POR_PARTE);
  const ate = momento === 'atual' ? undefined : momento;
  const jogosMelhor = (blocoAtual?.jogos ?? []).filter((j) => j.golsMandante !== undefined);
  const jogoMelhor = jogosMelhor.some((j) => j.id === jogo) ? jogo : (jogosMelhor[0]?.id ?? '');
  const jogadoresMelhor = useMemo(() => (jogoMelhor ? jogadoresDaPartida(c, jogoMelhor) : []), [c, jogoMelhor]);
  const goleiros = c.jogadores.filter((j) => ehGoleiro(j.posicao));
  const siglaDe = (equipeId: string) => c.equipes.find((e) => e.id === equipeId)?.sigla ?? '';

  /** Peças de cada seção com as escolhas atuais (`todas`: todas as opções da seção, para o .zip). */
  function pecasDa(id: IdSecao, todas: boolean): { pecas: Peca[]; motivo?: string } {
    switch (id) {
      case 'resultados': {
        if (blocos.length === 0) return { pecas: [], motivo: 'Este campeonato ainda não tem jogos.' };
        if (todas)
          return {
            pecas: blocos.filter(comJogo).flatMap((b) => [
              { tipo: 'rodada', bloco: b } as Peca,
              ...b.jogos.filter((j) => j.golsMandante !== undefined).map((j): Peca => ({ tipo: 'jogo', jogo: j })),
            ]),
          };
        if (!blocoAtual) return { pecas: [] };
        if (jogo === 'todos') return { pecas: [{ tipo: 'rodada', bloco: blocoAtual }] };
        const j = blocoAtual.jogos.find((x) => x.id === jogo);
        return { pecas: j ? [{ tipo: 'jogo', jogo: j }] : [] };
      }
      case 'classificacao': {
        if (grupos.length === 0) return { pecas: [], motivo: 'Este campeonato não tem fase de grupos.' };
        const ids = todas ? grupos.map((g) => g.id) : [grupo];
        return {
          pecas: ids.flatMap((g) => {
            const dados = classificacaoArte(c, g, todas ? undefined : ate);
            return dados ? [{ tipo: 'classificacao', dados } as Peca] : [];
          }),
        };
      }
      case 'programacao': {
        if (dias.length === 0) return { pecas: [], motivo: 'Os jogos ainda não têm data nem dia.' };
        const lista = todas ? dias : diaAtual ? [diaAtual] : [];
        return {
          pecas: lista.flatMap((d) => {
            const ps = partes(d.jogos, JOGOS_POR_PARTE);
            const escolhidas = todas ? ps.map((_, i) => i) : [Math.min(parte, ps.length - 1)];
            return escolhidas.map((i): Peca => ({ tipo: 'programacao', dia: d, pagina: i + 1, paginas: ps.length, jogos: ps[i] }));
          }),
        };
      }
      case 'artilharia':
      case 'assistencias':
        return { pecas: [{ tipo: 'ranking', dados: rankingArte(c, id, Number(topo), todas ? undefined : ate) }] };
      case 'elencos': {
        if (elencos.length === 0) return { pecas: [], motivo: 'Os elencos ainda não foram oficializados (fim da cerimônia).' };
        const lista = todas || equipe === 'todos' ? elencos : elencos.filter((e) => e.equipe.id === equipe);
        return { pecas: lista.map((dados): Peca => ({ tipo: 'elenco', dados })) };
      }
      case 'mata-mata':
        return chave ? { pecas: [{ tipo: 'chave', chave }] } : { pecas: [], motivo: 'A chave do mata-mata só existe no modelo oficial.' };
      case 'melhor': {
        if (todas) return { pecas: [] };
        if (jogosMelhor.length === 0) return { pecas: [], motivo: 'Nenhum jogo desta rodada começou ainda.' };
        const dados = jogador ? melhorDaPartidaArte(c, jogoMelhor, jogador) : null;
        return dados ? { pecas: [{ tipo: 'melhor', dados }] } : { pecas: [], motivo: 'Escolha o jogador.' };
      }
      case 'selecao': {
        if (todas) return { pecas: [] };
        const jogadores = selecao.map((id) => (id ? jogadorSelecaoArte(c, id) : null)).filter((j): j is JogadorSelecaoArte => !!j);
        if (jogadores.length < VAGAS_SELECAO.length) return { pecas: [], motivo: `Escolha os ${VAGAS_SELECAO.length} jogadores (falta${VAGAS_SELECAO.length - jogadores.length === 1 ? '' : 'm'} ${VAGAS_SELECAO.length - jogadores.length}).` };
        return { pecas: [{ tipo: 'selecao', jogadores, subtitulo }] };
      }
      case 'campeao':
        return campeao ? { pecas: [{ tipo: 'campeao', dados: campeao }] } : { pecas: [], motivo: 'Libera quando a final terminar.' };
      case 'regulamento': {
        const n = paginasRegulamento.length;
        const quais = todas || pagina === 'todas' ? [...Array(n).keys()].map((i) => i + 1) : [Number(pagina)];
        return { pecas: quais.map((p): Peca => ({ tipo: 'regulamento', paginas: paginasRegulamento, pagina: p })) };
      }
      case 'divulgacao': {
        const lista = todas ? DIVULGACAO : DIVULGACAO.filter((d) => d.nome === divulgacao);
        return { pecas: lista.map(pecaDivulgacao) };
      }
    }
  }

  const atual = pecasDa(secao, false);
  const itens = expandir(atual.pecas, formato);
  const previas = itens.slice(0, 6);
  const temFormato = !['selecao', 'regulamento', 'divulgacao'].includes(secao);

  async function gerar(lista: Item[], nomeZip: string, compartilhar: boolean) {
    if (lista.length === 0) return;
    setAviso(null);
    try {
      await document.fonts.ready;
      const arquivos: Array<{ blob: Blob; nome: string }> = [];
      for (const [i, it] of lista.entries()) {
        setProgresso(`Gerando ${i + 1} de ${lista.length}…`);
        const png = await gerarPng(it.peca, it.f, assinatura);
        if (png) arquivos.push(png);
      }
      if (compartilhar) {
        const files = arquivos.map((a) => new File([a.blob], a.nome, { type: 'image/png' }));
        try {
          await navigator.share({ files });
        } catch {
          // Cancelado: nada a fazer.
        }
      } else if (arquivos.length === 1) {
        baixarBlob(arquivos[0].blob, arquivos[0].nome);
      } else {
        setProgresso('Montando o .zip…');
        const dados = await Promise.all(arquivos.map(async (a) => ({ nome: a.nome, dados: new Uint8Array(await a.blob.arrayBuffer()) })));
        const zip = criarZip(dados);
        baixarBlob(new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }), nomeZip);
      }
    } catch (e) {
      setAviso(`Não consegui gerar as artes: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgresso(null);
    }
  }

  function tudo(): Item[] {
    return SECOES.flatMap((s) => expandir(pecasDa(s.id, true).pecas, 'ambos'));
  }

  function legenda(): string {
    const tag = '@c.r.jumentus';
    switch (secao) {
      case 'resultados':
        return `${blocoAtual?.titulo ?? 'Resultados'} da ${assinatura}. Tabela completa em copa-jumentus.vercel.app ${tag}`;
      case 'classificacao':
        return `Classificação da ${assinatura}. ${tag}`;
      case 'programacao':
        return `Jogos de ${diaAtual?.titulo ?? 'hoje'}. Vem pro campo! ${tag}`;
      case 'artilharia':
        return `Artilharia da ${assinatura}. ${tag}`;
      case 'assistencias':
        return `Os garçons da ${assinatura}. ${tag}`;
      case 'elencos':
        return `Elencos da ${assinatura}. ${tag}`;
      case 'mata-mata':
        return `O mata-mata da ${assinatura}. ${tag}`;
      case 'melhor':
        return `Melhor da partida. ${tag}`;
      case 'selecao':
        return `A Seleção da ${assinatura}. ${tag}`;
      case 'campeao':
        return `${campeao?.campeao.nome ?? 'Campeão'} é campeão da ${assinatura}! ${tag}`;
      default:
        return `${assinatura}. ${tag}`;
    }
  }

  async function copiarLegenda() {
    try {
      await navigator.clipboard.writeText(legenda());
      setAviso('Legenda copiada.');
    } catch {
      setAviso('Não consegui copiar a legenda neste navegador.');
    }
  }

  const ocupado = progresso !== null;
  const rotuloBaixar = itens.length === 1 ? 'Baixar PNG' : `Baixar ${itens.length} PNGs (.zip)`;
  const nomeZipSecao = `copa-jumentus-${secao}.zip`;
  let n = 0;
  const p = () => ++n;

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-cta w-full sm:w-auto" disabled={ocupado} onClick={() => gerar(tudo(), 'copa-jumentus-todas-as-artes.zip', false)}>
          <span>Baixar todas as artes (.zip)</span>
        </button>
        <button type="button" className="btn-hud" disabled={ocupado} onClick={() => gerar(expandir(pecasDa(secao, true).pecas, 'ambos'), nomeZipSecao, false)}>
          Baixar seção inteira (.zip)
        </button>
      </div>
      <p className="text-xs text-text-3">
        &ldquo;Todas as artes&rdquo; junta cada seção com os dados de agora. Melhor da partida e Seleção da Copa ficam de fora, porque dependem da escolha de vocês.
      </p>

      <nav aria-label="Seções de artes" className="-mr-4 overflow-x-auto pr-4 [scrollbar-width:none]">
        <ul className="grid w-max grid-flow-col gap-2 sm:w-auto sm:grid-flow-row sm:grid-cols-4 lg:grid-cols-6">
          {SECOES.map((s) => {
            const desligada = !['melhor', 'selecao'].includes(s.id) && pecasDa(s.id, true).pecas.length === 0;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSecao(s.id)}
                  aria-pressed={secao === s.id}
                  className="secao-arte"
                  data-ativo={secao === s.id || undefined}
                  data-desligada={desligada || undefined}
                >
                  <span className="block aspect-[4/5] w-full overflow-hidden bg-[var(--bg)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.miniatura} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </span>
                  <span className="mt-1.5 block text-left font-mono text-[13px] font-bold uppercase leading-tight tracking-[0.05em]">{s.nome}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="hud-card hud-clip modulo relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" aria-label={SECOES.find((s) => s.id === secao)?.nome}>
        <div className="space-y-5">
          {(secao === 'resultados' || secao === 'melhor') && (
            <>
              <Passo n={p()} titulo="Rodada">
                <Opcoes
                  rotulo="Rodada"
                  valor={bloco}
                  aoEscolher={(v) => {
                    setBloco(v);
                    setJogo('todos');
                    setJogador('');
                  }}
                  opcoes={blocos.map((b) => ({ valor: b.id, rotulo: b.titulo }))}
                />
              </Passo>
              {secao === 'resultados' ? (
                <Passo n={p()} titulo="Jogo">
                  <ListaEscolha
                    rotulo="Jogo"
                    valor={jogo}
                    aoEscolher={setJogo}
                    opcoes={[
                      { valor: 'todos', titulo: 'Todos da rodada', sub: `${blocoAtual?.jogos.length ?? 0} jogos · arte da rodada` },
                      ...(blocoAtual?.jogos ?? []).map((j) => ({
                        valor: j.id,
                        titulo: `${j.numero !== undefined ? `J${j.numero} · ` : ''}${j.mandante.nome} ${j.golsMandante !== undefined ? `${j.golsMandante} × ${j.golsVisitante}` : '×'} ${j.visitante.nome}`,
                        sub: j.encerrado ? 'Encerrado' : j.situacao === 'AO VIVO' ? 'Ao vivo' : `Ainda não começou${j.quando ? ` · ${j.quando}` : ''}`,
                        desligado: j.golsMandante === undefined,
                      })),
                    ]}
                  />
                </Passo>
              ) : (
                <>
                  <Passo n={p()} titulo="Jogo">
                    {jogosMelhor.length === 0 ? (
                      <p className="text-sm text-text-3">Nenhum jogo desta rodada começou ainda.</p>
                    ) : (
                      <ListaEscolha
                        rotulo="Jogo"
                        valor={jogoMelhor}
                        aoEscolher={(v) => {
                          setJogo(v);
                          setJogador('');
                        }}
                        opcoes={jogosMelhor.map((j) => ({
                          valor: j.id,
                          titulo: `${j.numero !== undefined ? `J${j.numero} · ` : ''}${j.mandante.nome} ${j.golsMandante} × ${j.golsVisitante} ${j.visitante.nome}`,
                          sub: j.encerrado ? 'Encerrado' : 'Ao vivo',
                        }))}
                      />
                    )}
                  </Passo>
                  {jogosMelhor.length > 0 && (
                    <Passo n={p()} titulo="Jogador">
                      <select className="campo w-full" value={jogador} onChange={(e) => setJogador(e.target.value)} aria-label="Melhor da partida">
                        <option value="">Escolha o melhor em campo</option>
                        {jogadoresMelhor.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.nome} · {j.sigla}
                          </option>
                        ))}
                      </select>
                    </Passo>
                  )}
                </>
              )}
            </>
          )}

          {secao === 'classificacao' && grupos.length > 0 && (
            <>
              {grupos.length > 1 && (
                <Passo n={p()} titulo="Grupo">
                  <Opcoes rotulo="Grupo" valor={grupo} aoEscolher={setGrupo} opcoes={grupos.map((g) => ({ valor: g.id, rotulo: g.nome }))} />
                </Passo>
              )}
              <Passo n={p()} titulo="Situação">
                <Opcoes
                  rotulo="Situação"
                  valor={momento}
                  aoEscolher={setMomento}
                  opcoes={[{ valor: 'atual', rotulo: 'Agora' }, ...momentos.map((b) => ({ valor: b.id, rotulo: `Após ${b.titulo}` }))]}
                />
              </Passo>
            </>
          )}

          {(secao === 'artilharia' || secao === 'assistencias') && (
            <>
              <Passo n={p()} titulo="Até quando">
                <Opcoes
                  rotulo="Até quando"
                  valor={momento}
                  aoEscolher={setMomento}
                  opcoes={[{ valor: 'atual', rotulo: 'Agora' }, ...momentos.map((b) => ({ valor: b.id, rotulo: `Até ${b.titulo}` }))]}
                />
              </Passo>
              <Passo n={p()} titulo="Posições">
                <Opcoes
                  rotulo="Posições"
                  valor={topo}
                  aoEscolher={setTopo}
                  opcoes={[
                    { valor: '5', rotulo: 'Top 5' },
                    { valor: '7', rotulo: 'Top 7' },
                  ]}
                />
              </Passo>
            </>
          )}

          {secao === 'programacao' && dias.length > 0 && (
            <>
              <Passo n={p()} titulo="Dia">
                <Opcoes
                  rotulo="Dia"
                  valor={dia}
                  aoEscolher={(v) => {
                    setDia(v);
                    setParte(0);
                  }}
                  opcoes={dias.map((d) => ({ valor: d.id, rotulo: d.titulo }))}
                />
              </Passo>
              {partesDoDia.length > 1 && (
                <Passo n={p()} titulo="Jogos">
                  <Opcoes
                    rotulo="Jogos"
                    valor={String(Math.min(parte, partesDoDia.length - 1))}
                    aoEscolher={(v) => setParte(Number(v))}
                    opcoes={partesDoDia.map((ps, i) => ({
                      valor: String(i),
                      rotulo: ps[0]?.numero !== undefined ? `J${ps[0].numero} a J${ps[ps.length - 1].numero}` : `Parte ${i + 1}`,
                    }))}
                  />
                </Passo>
              )}
            </>
          )}

          {secao === 'elencos' && elencos.length > 0 && (
            <Passo n={p()} titulo="Time">
              <Opcoes
                rotulo="Time"
                valor={equipe}
                aoEscolher={setEquipe}
                opcoes={[{ valor: 'todos', rotulo: `Os ${elencos.length}` }, ...elencos.map((e) => ({ valor: e.equipe.id, rotulo: e.equipe.nome }))]}
              />
            </Passo>
          )}

          {secao === 'selecao' && (
            <>
              <Passo n={p()} titulo="Jogadores">
                <div className="grid gap-2 sm:grid-cols-2">
                  {VAGAS_SELECAO.map((vaga, i) => (
                    <label key={vaga} className="block">
                      <span className="rotulo-campo">{vaga}</span>
                      <select
                        className="campo w-full"
                        value={selecao[i]}
                        onChange={(e) => setSelecao((s) => s.map((x, k) => (k === i ? e.target.value : x)))}
                      >
                        <option value="">Escolha</option>
                        {(i === 0 ? goleiros : c.jogadores.filter((j) => !ehGoleiro(j.posicao)))
                          .filter((j) => j.id === selecao[i] || !selecao.includes(j.id))
                          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                          .map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.nome} · {siglaDe(j.equipeId)}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
              </Passo>
              <Passo n={p()} titulo="Texto do topo">
                <input className="campo w-full" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} maxLength={40} aria-label="Texto do topo" />
              </Passo>
            </>
          )}

          {secao === 'regulamento' && paginasRegulamento.length > 1 && (
            <Passo n={p()} titulo="Página">
              <Opcoes
                rotulo="Página"
                valor={pagina}
                aoEscolher={setPagina}
                opcoes={[{ valor: 'todas', rotulo: `Todas (${paginasRegulamento.length}, carrossel)` }, ...paginasRegulamento.map((_, i) => ({ valor: String(i + 1), rotulo: `${i + 1}` }))]}
              />
            </Passo>
          )}

          {secao === 'divulgacao' && (
            <Passo n={p()} titulo="Peça">
              <ListaEscolha rotulo="Peça" valor={divulgacao} aoEscolher={setDivulgacao} opcoes={DIVULGACAO.map((d) => ({ valor: d.nome, titulo: d.rotulo }))} />
            </Passo>
          )}

          {temFormato && (
            <Passo n={p()} titulo="Formato">
              <Opcoes
                rotulo="Formato"
                valor={formato}
                aoEscolher={setFormato}
                opcoes={[
                  { valor: 'ambos', rotulo: 'Feed + stories' },
                  { valor: 'feed', rotulo: 'Só feed' },
                  { valor: 'story', rotulo: 'Só stories' },
                ]}
              />
            </Passo>
          )}

          {atual.motivo && <p className="text-sm text-text-2">{atual.motivo}</p>}
        </div>

        <div className="space-y-4">
          <p className="hud-label" style={{ color: 'var(--accent)' }}>
            Prévia{itens.length > previas.length ? ` · ${previas.length} de ${itens.length}` : ''}
          </p>
          {previas.length === 0 ? (
            <p className="text-sm text-text-3">Nada para mostrar com estas escolhas.</p>
          ) : (
            <div className={`grid items-end gap-3 ${previas.length === 1 ? 'mx-auto max-w-[17rem] grid-cols-1' : 'grid-cols-2'}`}>
              {previas.map((it, i) => (
                <Previa key={`${secao}-${i}-${nomeDaPeca(it.peca, it.f)}`} item={it} assinatura={assinatura} />
              ))}
            </div>
          )}
          <div className="barra-baixar-arte flex flex-wrap gap-2">
            <button type="button" className="btn-cta flex-1" disabled={ocupado || itens.length === 0} onClick={() => gerar(itens, nomeZipSecao, false)}>
              <span>{progresso ?? rotuloBaixar}</span>
            </button>
            {podeCompartilhar && itens.length > 0 && (
              <button type="button" className="btn-hud" disabled={ocupado} onClick={() => gerar(itens, nomeZipSecao, true)}>
                Compartilhar
              </button>
            )}
          </div>
          <button type="button" className="btn-hud w-full" onClick={copiarLegenda}>
            Copiar legenda
          </button>
          {aviso && (
            <p role="status" className="text-sm text-text-2">
              {aviso}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
