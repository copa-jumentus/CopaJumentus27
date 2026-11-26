// Artes do Instagram desenhadas no navegador (canvas 2D, sem dependência), nos
// layouts aprovados pelo operador em 25/11/2026: fundos gerados à parte, só
// atmosfera, em public/imagens/fundos/ (docs em public/imagens/README.md); tudo o
// que muda com o resultado (módulos, placar, escudos, nomes) é desenhado aqui.
// Os dados chegam prontos de lib/domain/campeonato/artes.ts.

import type {
  BlocoDeJogos,
  CampeaoArte,
  ClassificacaoArte,
  DiaArte,
  ElencoArte,
  JogadorSelecaoArte,
  JogoArte,
  LanceArte,
  MelhorDaPartidaArte,
  RankingArte,
} from '@/lib/domain/campeonato/artes';
import { slugDe } from '@/lib/domain/campeonato/artes';
import type { SecaoRegulamento } from '@/lib/domain/campeonato/regulamento';

export type Formato = 'feed' | 'story';

export type Peca =
  | { tipo: 'rodada'; bloco: BlocoDeJogos }
  | { tipo: 'jogo'; jogo: JogoArte }
  | { tipo: 'classificacao'; dados: ClassificacaoArte }
  | { tipo: 'programacao'; dia: DiaArte; pagina: number; paginas: number; jogos: JogoArte[] }
  | { tipo: 'ranking'; dados: RankingArte }
  | { tipo: 'elenco'; dados: ElencoArte }
  | { tipo: 'chave'; chave: Record<number, JogoArte> }
  | { tipo: 'melhor'; dados: MelhorDaPartidaArte }
  /** Craque do jogo com a foto do jogador, anexada na hora (URL local do arquivo); só stories. */
  | { tipo: 'craque'; dados: MelhorDaPartidaArte; foto: string }
  | { tipo: 'selecao'; jogadores: JogadorSelecaoArte[]; subtitulo: string }
  | { tipo: 'campeao'; dados: CampeaoArte }
  | { tipo: 'regulamento'; paginas: SecaoRegulamento[][]; pagina: number }
  | { tipo: 'divulgacao'; nome: string; src: string; formato: Formato };

export const L = 1080;
export const ALTURA: Record<Formato, number> = { feed: 1350, story: 1920 };
const M = 80;

const COR = {
  marinho: '#0B1F3F',
  profundo: '#06122A',
  modulo: 'rgba(6,18,42,0.86)',
  texto: '#F4F2EC',
  concreto: '#C9CCD1',
  dourado: '#D4A12A',
  areia: '#FFE08A',
  laranja: '#FFB458',
  vermelho: '#E4002B',
};

/** Escudos com fundo de time pronto (public/imagens/fundos/time-<slug>-*.webp). */
const FUNDOS_DE_TIME = new Set([
  'inter-miami',
  'la-galaxy',
  'lafc',
  'seattle-sounders',
  'atlanta-united',
  'new-york-city-fc',
  'houston-dynamo',
  'orlando-city',
]);

// ---------- fontes e imagens ----------

interface Fontes {
  titulo: string;
  numero: string;
  rotulo: string;
  texto: string;
}

function lerFontes(): Fontes {
  const css = getComputedStyle(document.documentElement);
  const v = (nome: string, reserva: string) => css.getPropertyValue(nome).trim() || reserva;
  return {
    titulo: v('--font-anton', 'Impact, sans-serif'),
    numero: v('--font-big-shoulders', 'Impact, sans-serif'),
    rotulo: v('--font-barlow-condensed', 'sans-serif'),
    texto: v('--font-barlow', 'sans-serif'),
  };
}

const imagens = new Map<string, Promise<HTMLImageElement | null>>();
function carregarImagem(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const ja = imagens.get(src);
  if (ja) return ja;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imagens.set(src, p);
  return p;
}

const LOGO = '/imagens/logo/copa-jumentus-logo.png';
const EM = '/imagens/patrocinadores/em-empreendimentos.webp';
const fundoSrc = (nome: string, f: Formato) => `/imagens/fundos/${nome}-${f === 'feed' ? 'feed' : 'stories'}.webp`;

// ---------- primitivas ----------

type Ctx = CanvasRenderingContext2D;

function ouro(ctx: Ctx, x: number, y: number, w: number, h: number): CanvasGradient {
  const g = ctx.createLinearGradient(x, y + h, x + w, y);
  g.addColorStop(0, '#9C6F14');
  g.addColorStop(0.5, '#F2CB57');
  g.addColorStop(1, '#D4A12A');
  return g;
}

function tracking(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

interface OpTexto {
  alinhar?: CanvasTextAlign;
  /** Espaçamento entre letras, em px. */
  tr?: number;
  /** Encolhe a fonte até caber, em vez de cortar. */
  max?: number;
  /** Preenche com o dourado metálico. */
  dourado?: boolean;
  sombra?: boolean;
}

/** Escreve com o topo do texto em `y` (como o `top` do CSS). Devolve a largura. */
function escrever(ctx: Ctx, s: string, x: number, y: number, fonte: string, cor: string, op: OpTexto = {}): number {
  ctx.save();
  ctx.font = fonte;
  ctx.textAlign = op.alinhar ?? 'left';
  ctx.textBaseline = 'top';
  tracking(ctx, op.tr ?? 0);
  if (op.max) {
    const tam = Number(/(\d+(?:\.\d+)?)px/.exec(fonte)?.[1] ?? 40);
    let t = tam;
    while (t > 12 && ctx.measureText(s).width > op.max) {
      t -= 1;
      ctx.font = fonte.replace(`${tam}px`, `${t}px`);
    }
  }
  const w = ctx.measureText(s).width;
  if (op.sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  if (op.dourado) {
    const x0 = op.alinhar === 'center' ? x - w / 2 : op.alinhar === 'right' ? x - w : x;
    const h = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 40);
    ctx.fillStyle = ouro(ctx, x0, y, w, h);
  } else ctx.fillStyle = cor;
  ctx.fillText(s, x, y);
  ctx.restore();
  return w;
}

/** Retângulo com o canto superior direito cortado a 45° (módulo de transmissão). */
function caminhoCorte(ctx: Ctx, x: number, y: number, w: number, h: number, corte: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - corte, y);
  ctx.lineTo(x + w, y + corte);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function modulo(ctx: Ctx, x: number, y: number, w: number, h: number, op: { corte?: number; fundo?: string; filete?: boolean } = {}) {
  ctx.save();
  caminhoCorte(ctx, x, y, w, h, op.corte ?? 26);
  ctx.fillStyle = op.fundo ?? COR.modulo;
  ctx.fill();
  if (op.filete !== false) {
    ctx.fillStyle = COR.dourado;
    ctx.fillRect(x, y + h - 4, w, 4);
  }
  ctx.restore();
}

function retangulo(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string | CanvasGradient) {
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
}

function imagemContida(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, sombra = false) {
  if (!img) return;
  const r = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * r;
  const ih = img.naturalHeight * r;
  ctx.save();
  if (sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
  }
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

async function escudo(ctx: Ctx, src: string | undefined, x: number, y: number, lado: number, sombra = false) {
  imagemContida(ctx, await carregarImagem(src), x, y, lado, lado, sombra);
}

async function fundo(ctx: Ctx, nome: string, f: Formato, reserva = 'noite') {
  const img = (await carregarImagem(fundoSrc(nome, f))) ?? (await carregarImagem(fundoSrc(reserva, f)));
  if (img) ctx.drawImage(img, 0, 0, L, ALTURA[f]);
  else retangulo(ctx, 0, 0, L, ALTURA[f], COR.profundo);
}

/** Brasão à esquerda e o rótulo da peça à direita. */
async function cabecalho(ctx: Ctx, F: Fontes, rotulo: string, y: number, cor = COR.texto, largura = 100) {
  const logo = await carregarImagem(LOGO);
  if (logo) ctx.drawImage(logo, M, y, largura, (logo.naturalHeight / logo.naturalWidth) * largura);
  escrever(ctx, rotulo.toUpperCase(), L - M, y + 34, `700 30px ${F.rotulo}`, cor, { alinhar: 'right', tr: 2.1, max: 640 });
}

function rodape(ctx: Ctx, F: Fontes, y: number, direita: string, cor = COR.texto, fim = 1000) {
  retangulo(ctx, M, y, fim - M, 4, ouro(ctx, M, y, fim - M, 4));
  escrever(ctx, '@C.R.JUMENTUS', M, y + 18, `700 28px ${F.rotulo}`, cor, { tr: 2 });
  ctx.save();
  ctx.globalAlpha = 0.85;
  escrever(ctx, direita.toUpperCase(), fim, y + 20, `700 24px ${F.rotulo}`, cor, { alinhar: 'right', tr: 1.7, max: 520 });
  ctx.restore();
}

/** Logo da EM sempre sobre placa clara, nas cores originais (manual de marca). */
async function placaEM(ctx: Ctx, F: Fontes, x: number, y: number, w: number, h: number, rotulo: string, tamRot = 24, corRot = COR.texto) {
  escrever(ctx, rotulo.toUpperCase(), x + w / 2, y - tamRot - 12, `700 ${tamRot}px ${F.rotulo}`, corRot, { alinhar: 'center', tr: 1.7 });
  ctx.save();
  caminhoCorte(ctx, x, y, w, h, 22);
  ctx.fillStyle = COR.texto;
  ctx.fill();
  ctx.restore();
  retangulo(ctx, x, y + h - 4, w, 4, COR.dourado);
  const img = await carregarImagem(EM);
  imagemContida(ctx, img, x + w * 0.1, y + (h - 4) * 0.12, w * 0.8, (h - 4) * 0.76);
}

function textoPlacar(j: JogoArte): string {
  return j.golsMandante === undefined ? '' : `${j.golsMandante}–${j.golsVisitante}`;
}

function horaDe(j: JogoArte): string {
  return j.quando.split(' · ')[1] ?? j.situacao;
}

// ---------- peças ----------

async function pecaRodada(ctx: Ctx, F: Fontes, f: Formato, b: BlocoDeJogos, assinatura: string) {
  const st = f === 'story';
  await fundo(ctx, 'resultados', f);
  const y0 = st ? 250 : 70;
  await cabecalho(ctx, F, b.legenda, y0, COR.texto, 104);
  escrever(ctx, b.titulo.toUpperCase(), M, st ? 420 : 215, `${st ? 110 : 96}px ${F.titulo}`, COR.texto, { max: 920, tr: 0.5 });
  const topo = st ? 560 : 360;
  const fim = st ? 1360 : 1180;
  const n = Math.max(1, b.jogos.length);
  const passo = Math.min(st ? 200 : 205, (fim - topo) / n);
  const h = passo - 24;
  const esc = Math.min(100, h - 70);
  for (const [k, j] of b.jogos.entries()) {
    const y = topo + k * passo;
    modulo(ctx, M, y, L - 2 * M, h);
    escrever(ctx, `${j.numero !== undefined ? `JOGO ${j.numero}` : j.rotulo.toUpperCase()}${j.encerrado ? '' : j.situacao === 'AO VIVO' ? ' · AO VIVO' : ''}`, 110, y + 14, `700 20px ${F.rotulo}`, j.situacao === 'AO VIVO' ? COR.vermelho : COR.concreto, { tr: 1.4 });
    const cy = y + h / 2 + 8;
    await escudo(ctx, j.mandante.escudo, 100, cy - esc / 2, esc);
    escrever(ctx, j.mandante.nome.toUpperCase(), 100 + esc + 16, cy - 18, `34px ${F.titulo}`, COR.texto, { max: 430 - (100 + esc + 16) });
    await escudo(ctx, j.visitante.escudo, L - 100 - esc, cy - esc / 2, esc);
    escrever(ctx, j.visitante.nome.toUpperCase(), L - 100 - esc - 16, cy - 18, `34px ${F.titulo}`, COR.texto, { alinhar: 'right', max: L - 100 - esc - 16 - 650 });
    const placar = textoPlacar(j);
    if (placar) {
      escrever(ctx, placar, L / 2, cy - 54, `900 104px ${F.numero}`, '', { alinhar: 'center', dourado: true });
      if (j.penaltis) escrever(ctx, `PÊN. ${j.penaltis[0]}–${j.penaltis[1]}`, L / 2, cy + 46, `700 20px ${F.rotulo}`, COR.concreto, { alinhar: 'center', tr: 1.4 });
    } else {
      escrever(ctx, horaDe(j), L / 2, cy - 30, `900 60px ${F.numero}`, COR.texto, { alinhar: 'center' });
    }
  }
  if (st) {
    escrever(ctx, `${b.faixa} · ${assinatura}`.toUpperCase(), L / 2, 1400, `700 30px ${F.rotulo}`, COR.areia, { alinhar: 'center', tr: 2 });
    escrever(ctx, 'TABELA COMPLETA EM COPA-JUMENTUS.VERCEL.APP', L / 2, 1450, `700 26px ${F.rotulo}`, COR.texto, { alinhar: 'center', tr: 1.8 });
  } else rodape(ctx, F, 1235, assinatura);
}

const SUFIXO: Partial<Record<LanceArte['tipo'], string>> = { penalti: ' (pên.)', contra: ' (contra)' };

function linhasDeGol(ls: LanceArte[]): string[] {
  return ls.filter((l) => l.tipo === 'gol' || l.tipo === 'penalti' || l.tipo === 'contra').map((l) => `${l.nome}${l.minuto !== undefined ? ` ${l.minuto}’` : ''}${SUFIXO[l.tipo] ?? ''}`);
}

async function pecaJogo(ctx: Ctx, F: Fontes, f: Formato, j: JogoArte, assinatura: string) {
  const st = f === 'story';
  const k = st ? 1.12 : 1;
  await fundo(ctx, 'resultados', f);
  const y0 = st ? 250 : 70;
  await cabecalho(ctx, F, `${j.fase ? `${j.fase} · ` : ''}${j.rotulo}${j.numero !== undefined ? ` · Jogo ${j.numero}` : ''}`, y0);
  const ty = st ? 420 : 220;
  const titulo = j.encerrado ? 'Fim de jogo' : j.situacao === 'AO VIVO' ? 'Ao vivo' : 'Próximo jogo';
  escrever(ctx, titulo.toUpperCase(), M, ty, `${st ? 110 : 96}px ${F.titulo}`, j.situacao === 'AO VIVO' ? COR.texto : COR.texto);
  if (j.situacao === 'AO VIVO') {
    ctx.font = `${st ? 110 : 96}px ${F.titulo}`;
    const w = ctx.measureText('AO VIVO').width;
    ctx.fillStyle = COR.vermelho;
    ctx.beginPath();
    ctx.arc(M + w + 40, ty + (st ? 60 : 52), 16, 0, Math.PI * 2);
    ctx.fill();
  }
  const my = st ? 580 : 370;
  const mh = Math.round(380 * k);
  modulo(ctx, M, my, L - 2 * M, mh);
  const esc = Math.round(200 * k);
  for (const [lado, x] of [
    [j.mandante, 110],
    [j.visitante, L - 110 - 250],
  ] as const) {
    await escudo(ctx, lado.escudo, x + (250 - esc) / 2, my + 35, esc, true);
    escrever(ctx, lado.nome.toUpperCase(), x + 125, my + 35 + esc + 18, `38px ${F.titulo}`, COR.texto, { alinhar: 'center', max: 260 });
  }
  const placarY = my + mh / 2 - 130 * k;
  if (j.golsMandante !== undefined) {
    const fonte = `900 ${Math.round(210 * k)}px ${F.numero}`;
    escrever(ctx, `${j.golsMandante}`, L / 2 - 60, placarY, fonte, '', { alinhar: 'right', dourado: true });
    escrever(ctx, '×', L / 2, placarY + 70 * k, `900 ${Math.round(110 * k)}px ${F.numero}`, '', { alinhar: 'center', dourado: true });
    escrever(ctx, `${j.golsVisitante}`, L / 2 + 60, placarY, fonte, '', { alinhar: 'left', dourado: true });
  } else {
    escrever(ctx, horaDe(j), L / 2, placarY + 60, `900 ${Math.round(90 * k)}px ${F.numero}`, COR.texto, { alinhar: 'center' });
  }
  const sit = j.penaltis ? `Pênaltis ${j.penaltis[0]} × ${j.penaltis[1]}` : j.encerrado ? 'Encerrado' : j.situacao === 'AO VIVO' ? 'Em andamento' : j.quando;
  escrever(ctx, sit.toUpperCase(), L / 2, my + mh - 70 * k, `700 ${Math.round(22 * k)}px ${F.rotulo}`, COR.concreto, { alinhar: 'center', tr: 1.5 });

  const gy = my + mh + (st ? 50 : 40);
  const lh = Math.round(42 * k);
  const maxLinhas = st ? 8 : 6;
  const [gm, gv] = [linhasDeGol(j.lances.mandante), linhasDeGol(j.lances.visitante)];
  const corta = (ls: string[]) => (ls.length > maxLinhas ? [...ls.slice(0, maxLinhas - 1), `+${ls.length - maxLinhas + 1} gols`] : ls);
  corta(gm).forEach((s, i) => escrever(ctx, s.toUpperCase(), M, gy + i * lh, `700 ${Math.round(28 * k)}px ${F.rotulo}`, COR.texto, { tr: 1.1, max: 440 }));
  corta(gv).forEach((s, i) => escrever(ctx, s.toUpperCase(), L - M, gy + i * lh, `700 ${Math.round(28 * k)}px ${F.rotulo}`, COR.texto, { alinhar: 'right', tr: 1.1, max: 440 }));

  if (st) await placaEM(ctx, F, 340, 1450, 400, 110, 'Oferecimento');
  else {
    await placaEM(ctx, F, 375, 1085, 330, 110, 'Oferecimento', 20);
    rodape(ctx, F, 1235, assinatura);
  }
}

const COR_ZONA = { semifinal: COR.dourado, repescagem: COR.concreto, eliminado: COR.vermelho } as const;

async function pecaClassificacao(ctx: Ctx, F: Fontes, f: Formato, c: ClassificacaoArte, assinatura: string) {
  const st = f === 'story';
  await fundo(ctx, 'classificacao', f);
  const y0 = st ? 250 : 70;
  await cabecalho(ctx, F, `${c.grupo} · ${c.momento}`, y0, COR.texto, 104);
  escrever(ctx, 'CLASSIFICAÇÃO', M, st ? 420 : 212, `${st ? 104 : 96}px ${F.titulo}`, COR.texto);
  const headY = st ? 578 : 322;
  const topo = st ? 620 : 360;
  const n = Math.max(1, c.linhas.length);
  const passo = Math.min(st ? 90 : 70, ((st ? 1330 : 920) - topo) / n);
  const h = passo - (st ? 10 : 8);
  const cols = ['J', 'V', 'E', 'D', 'SG'];
  const wCol = st ? 66 : 62;
  const xPts = L - M - cols.length * wCol - (st ? 86 : 80);
  escrever(ctx, 'EQUIPE', M + (st ? 144 : 136), headY, `700 ${st ? 22 : 20}px ${F.rotulo}`, COR.dourado, { tr: 2 });
  escrever(ctx, 'PTS', xPts + (st ? 43 : 40), headY, `700 ${st ? 22 : 20}px ${F.rotulo}`, COR.dourado, { alinhar: 'center', tr: 2 });
  cols.forEach((col, i) => escrever(ctx, col, xPts + (st ? 86 : 80) + i * wCol + wCol / 2, headY, `700 ${st ? 22 : 20}px ${F.rotulo}`, COR.dourado, { alinhar: 'center', tr: 2 }));
  for (const [i, l] of c.linhas.entries()) {
    const y = topo + i * passo;
    retangulo(ctx, M, y, L - 2 * M, h, 'rgba(6,18,42,0.84)');
    retangulo(ctx, M, y, 6, h, l.zona ? COR_ZONA[l.zona] : COR.concreto);
    const meio = y + h / 2;
    escrever(ctx, `${l.posicao}`, M + 38, meio - (st ? 21 : 19), `900 ${st ? 40 : 36}px ${F.numero}`, COR.texto, { alinhar: 'center' });
    const esc = Math.min(st ? 56 : 46, h - 14);
    await escudo(ctx, l.equipe.escudo, M + (st ? 72 : 68), meio - esc / 2, esc);
    escrever(ctx, l.equipe.nome.toUpperCase(), M + (st ? 144 : 136), meio - (st ? 18 : 17), `${st ? 33 : 32}px ${F.titulo}`, COR.texto, { max: xPts - M - (st ? 150 : 142) });
    escrever(ctx, `${l.pontos}`, xPts + (st ? 43 : 40), meio - (st ? 24 : 21), `900 ${st ? 46 : 40}px ${F.numero}`, '', { alinhar: 'center', dourado: true });
    const sg = l.saldo > 0 ? `+${l.saldo}` : `${l.saldo}`;
    [l.jogos, l.vitorias, l.empates, l.derrotas, sg].forEach((v, k) =>
      escrever(ctx, `${v}`, xPts + (st ? 86 : 80) + k * wCol + wCol / 2, meio - (st ? 15 : 14), `700 ${st ? 28 : 26}px ${F.rotulo}`, COR.concreto, { alinhar: 'center' }),
    );
  }
  const ly = topo + n * passo + (st ? 30 : 16);
  if (st) {
    c.zonas.forEach((z, i) => {
      retangulo(ctx, M, ly + i * 40 + 4, 18, 18, COR_ZONA[z.zona]);
      escrever(ctx, z.texto.toUpperCase(), M + 32, ly + i * 40, `700 24px ${F.rotulo}`, COR.texto, { tr: 1.4 });
    });
  } else {
    ctx.font = `700 21px ${F.rotulo}`;
    tracking(ctx, 1.2);
    const larg = c.zonas.map((z) => ctx.measureText(z.texto.toUpperCase()).width + 30);
    tracking(ctx, 0);
    let x = L / 2 - (larg.reduce((s, w) => s + w, 0) + 32 * (c.zonas.length - 1)) / 2;
    c.zonas.forEach((z, i) => {
      retangulo(ctx, x, ly + 3, 16, 16, COR_ZONA[z.zona]);
      escrever(ctx, z.texto.toUpperCase(), x + 26, ly, `700 21px ${F.rotulo}`, COR.texto, { tr: 1.2 });
      x += larg[i] + 32;
    });
    rodape(ctx, F, 1235, assinatura);
  }
}

async function pecaProgramacao(ctx: Ctx, F: Fontes, f: Formato, p: Extract<Peca, { tipo: 'programacao' }>, assinatura: string) {
  const st = f === 'story';
  await fundo(ctx, 'campo', f);
  const parte = p.paginas > 1 ? ` · ${p.pagina}/${p.paginas}` : '';
  if (st) {
    await cabecalho(ctx, F, `${p.dia.titulo}${parte}`, 250);
    escrever(ctx, 'JOGOS DO DIA', M, 410, `100px ${F.titulo}`, COR.texto);
  } else {
    const logo = await carregarImagem(LOGO);
    if (logo) ctx.drawImage(logo, M, 12, 66, (logo.naturalHeight / logo.naturalWidth) * 66);
    escrever(ctx, `${p.dia.titulo}${parte}`.toUpperCase(), L - M, 40, `700 28px ${F.rotulo}`, COR.texto, { alinhar: 'right', tr: 2 });
    modulo(ctx, M, 160, 620, 124, { filete: true });
    escrever(ctx, 'JOGOS DO DIA', 110, 180, `84px ${F.titulo}`, COR.texto);
  }
  const [y0, altMax, passoMax, rot, fimLista] = st ? [590, 100, 112, 34, 1500] : [330, 86, 96, 34, 1225];
  // Cada troca de rodada ou etapa ganha um rótulo; as linhas encolhem para tudo caber antes do rodapé.
  const rotulos = p.jogos.filter((j, i) => i === 0 || j.rotulo !== p.jogos[i - 1].rotulo).length;
  const passo = Math.min(passoMax, (fimLista - y0 - rotulos * rot) / Math.max(1, p.jogos.length));
  const alt = Math.min(altMax, passo - 10);
  let y = y0;
  let ultimo = '';
  const fs = st ? 30 : 28;
  const esc = Math.min(st ? 62 : 56, alt - 18);
  for (const j of p.jogos) {
    if (j.rotulo !== ultimo) {
      escrever(ctx, j.rotulo.toUpperCase(), M, y - 2, `700 22px ${F.rotulo}`, COR.areia, { tr: 3 });
      y += rot;
      ultimo = j.rotulo;
    }
    modulo(ctx, M, y, L - 2 * M, alt, { corte: 0 });
    const meio = y + alt / 2;
    escrever(ctx, horaDe(j), M + 22, meio - (st ? 26 : 24), `900 ${st ? 50 : 46}px ${F.numero}`, '', { dourado: true });
    const xVs = 540 + 40;
    escrever(ctx, '×', xVs, meio - 14, `700 26px ${F.rotulo}`, COR.concreto, { alinhar: 'center' });
    await escudo(ctx, j.mandante.escudo, xVs - 28 - esc, meio - esc / 2, esc);
    escrever(ctx, j.mandante.nome.toUpperCase(), xVs - 28 - esc - 14, meio - fs / 2 - 2, `${fs}px ${F.titulo}`, COR.texto, { alinhar: 'right', max: xVs - 28 - esc - 14 - (M + 170) });
    await escudo(ctx, j.visitante.escudo, xVs + 28, meio - esc / 2, esc);
    escrever(ctx, j.visitante.nome.toUpperCase(), xVs + 28 + esc + 14, meio - fs / 2 - 2, `${fs}px ${F.titulo}`, COR.texto, { max: L - M - 80 - (xVs + 28 + esc + 14) });
    if (j.numero !== undefined) escrever(ctx, `J${j.numero}`, L - M - 22, meio - 11, `700 20px ${F.rotulo}`, COR.concreto, { alinhar: 'right' });
    y += passo;
  }
  if (st) escrever(ctx, `${assinatura} · @C.R.JUMENTUS`.toUpperCase(), L / 2, 1530, `700 28px ${F.rotulo}`, COR.texto, { alinhar: 'center', tr: 2 });
  else rodape(ctx, F, 1255, assinatura);
}

async function pecaRanking(ctx: Ctx, F: Fontes, f: Formato, r: RankingArte, assinatura: string) {
  const st = f === 'story';
  await fundo(ctx, 'noite', f);
  const y0 = st ? 250 : 70;
  await cabecalho(ctx, F, r.momento, y0);
  const ty = y0 + (st ? 170 : 150);
  escrever(ctx, (r.tipo === 'artilharia' ? 'Artilharia' : 'Assistências').toUpperCase(), M, ty, `${st ? 112 : 96}px ${F.titulo}`, COR.texto);
  const unidade = r.tipo === 'artilharia' ? 'gols' : 'assistências';
  const [top, ...resto] = r.itens;
  const hy = ty + (st ? 150 : 125);
  const hh = st ? 260 : 220;
  if (!top) {
    escrever(ctx, r.tipo === 'artilharia' ? 'NENHUM GOL AINDA' : 'NENHUMA ASSISTÊNCIA AINDA', L / 2, hy + 80, `700 34px ${F.rotulo}`, COR.concreto, { alinhar: 'center', tr: 2 });
  } else {
    modulo(ctx, M, hy, L - 2 * M, hh);
    await escudo(ctx, top.escudo, 110, hy + 30, hh - 60, true);
    const xn = 110 + hh - 30;
    escrever(ctx, `1º LUGAR${top.sigla ? ` · ${top.sigla}` : ''}`, xn, hy + (st ? 52 : 40), `700 ${st ? 26 : 22}px ${F.rotulo}`, COR.dourado, { tr: 3 });
    escrever(ctx, top.nome.toUpperCase(), xn, hy + (st ? 92 : 76), `${st ? 92 : 80}px ${F.titulo}`, COR.texto, { max: L - M - 200 - xn });
    escrever(ctx, `${top.valor}`, L - 120, hy + (st ? 28 : 20), `900 ${st ? 170 : 150}px ${F.numero}`, '', { alinhar: 'right', dourado: true });
    escrever(ctx, unidade.toUpperCase(), L - 120, hy + hh - (st ? 40 : 34), `700 ${st ? 22 : 20}px ${F.rotulo}`, COR.concreto, { alinhar: 'right', tr: 1.5 });
  }
  const ly = hy + hh + 30;
  const [alt, passo] = st ? [82, 92] : [70, 78];
  for (const [i, it] of resto.entries()) {
    const y = ly + i * passo;
    retangulo(ctx, M, y, L - 2 * M, alt, 'rgba(6,18,42,0.84)');
    const meio = y + alt / 2;
    escrever(ctx, `${it.posicao}`, M + 40, meio - (st ? 20 : 18), `900 ${st ? 40 : 36}px ${F.numero}`, COR.concreto, { alinhar: 'center' });
    const esc = alt - 20;
    await escudo(ctx, it.escudo, M + 80, meio - esc / 2, esc);
    escrever(ctx, it.nome.toUpperCase(), M + 80 + esc + 18, meio - (st ? 18 : 16), `${st ? 36 : 32}px ${F.titulo}`, COR.texto, { max: 460 });
    escrever(ctx, it.sigla, L - M - 124, meio - 11, `700 ${st ? 22 : 20}px ${F.rotulo}`, COR.concreto, { alinhar: 'right', tr: 1.5 });
    escrever(ctx, `${it.valor}`, L - M - 24, meio - (st ? 25 : 22), `900 ${st ? 50 : 44}px ${F.numero}`, '', { alinhar: 'right', dourado: true });
  }
  if (st) await placaEM(ctx, F, 340, 1468, 400, 106, 'Premiação oferecida por');
  else rodape(ctx, F, 1255, assinatura);
}

async function pecaElenco(ctx: Ctx, F: Fontes, f: Formato, e: ElencoArte, assinatura: string) {
  const st = f === 'story';
  const q = e.equipe;
  const temFundo = FUNDOS_DE_TIME.has(q.slug);
  if (temFundo) await fundo(ctx, `time-${q.slug}`, f);
  else {
    retangulo(ctx, 0, 0, L, ALTURA[f], q.corPrimaria);
  }
  const txt = q.corTexto || COR.texto;
  const y0 = st ? 250 : 70;
  await cabecalho(ctx, F, 'Elenco', y0, txt);
  const ey = st ? 420 : 240;
  const el = st ? 270 : 240;
  await escudo(ctx, q.escudo, M, ey, el, true);
  const partes = q.nome.split(' ');
  const linhas = partes.length >= 2 ? [partes.slice(0, -1).join(' '), partes[partes.length - 1]] : [q.nome];
  const tam = q.nome.length > 12 ? (st ? 96 : 100) : st ? 110 : 110;
  const tx = M + el + 40;
  const ty = ey + el / 2 - (linhas.length * tam * 0.98) / 2;
  linhas.forEach((s, i) => escrever(ctx, s.toUpperCase(), tx, ty + i * tam * 0.98, `${tam}px ${F.titulo}`, txt, { max: L - M - tx }));

  const sec = q.corSecundaria;
  const claro = /^#(FFD200|C39E6D|FDE192|F[0-9A-F]{5})$/i.test(sec);
  const corNum = claro ? COR.profundo : COR.texto;
  const topo = st ? 760 : 520;
  const fim = st ? 1500 : 1200;
  const n = Math.max(1, e.jogadores.length);
  const passo = Math.min(st ? 92 : 86, (fim - topo) / n);
  const h = passo - 10;
  let numLinha = 0;
  for (const [i, jg] of e.jogadores.entries()) {
    const y = topo + i * passo;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(M + 130, y);
    ctx.lineTo(M + 130 - 22, y + h);
    ctx.lineTo(M, y + h);
    ctx.closePath();
    ctx.fillStyle = sec;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(M + 142 + 22, y);
    ctx.lineTo(M + 142 + 700, y);
    ctx.lineTo(M + 142 + 700 - 22, y + h);
    ctx.lineTo(M + 142, y + h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,18,42,0.88)';
    ctx.fill();
    ctx.restore();
    const meio = y + h / 2;
    if (jg.goleiro) escrever(ctx, 'GOL', M + 57, meio - 14, `700 26px ${F.rotulo}`, corNum, { alinhar: 'center', tr: 1.5 });
    else escrever(ctx, `${++numLinha}`, M + 57, meio - 21, `900 40px ${F.numero}`, corNum, { alinhar: 'center' });
    const w = escrever(ctx, jg.nome.toUpperCase(), M + 142 + 46, meio - Math.min(21, h / 2 - 6), `${Math.min(40, h - 34)}px ${F.titulo}`, COR.texto, { max: 520 });
    if (jg.capitao) {
      const bx = M + 142 + 46 + w + 18;
      ctx.font = `700 20px ${F.rotulo}`;
      tracking(ctx, 1.4);
      const bw = ctx.measureText('CAPITÃO').width + 20;
      tracking(ctx, 0);
      retangulo(ctx, bx, meio - 14, bw, 28, ouro(ctx, bx, meio - 14, bw, 28));
      escrever(ctx, 'CAPITÃO', bx + 10, meio - 10, `700 20px ${F.rotulo}`, COR.profundo, { tr: 1.4 });
    }
  }
  if (st) escrever(ctx, `@C.R.JUMENTUS · ${assinatura}`.toUpperCase(), M, 1530, `700 26px ${F.rotulo}`, txt, { tr: 1.8 });
  else rodape(ctx, F, 1235, assinatura, txt, 760);
}

async function caixaChave(
  ctx: Ctx,
  F: Fontes,
  x: number,
  y: number,
  w: number,
  rh: number,
  fs: number,
  rotulo: string,
  j: JogoArte,
) {
  const h = rh * 2 + 4;
  escrever(ctx, rotulo.toUpperCase(), x, y - fs + 2, `700 ${fs - 10}px ${F.rotulo}`, COR.dourado, { tr: 1.6, max: w });
  modulo(ctx, x, y, w, h);
  const linhas: Array<[JogoArte['mandante'], number | undefined, boolean]> = [
    [j.mandante, j.penaltis ? j.penaltis[0] : j.golsMandante, j.vencedor === 'mandante'],
    [j.visitante, j.penaltis ? j.penaltis[1] : j.golsVisitante, j.vencedor === 'visitante'],
  ];
  for (const [i, [lado, gols, venceu]] of linhas.entries()) {
    const yy = y + i * rh;
    ctx.save();
    if (j.vencedor && !venceu) ctx.globalAlpha = 0.5;
    const temTime = !!lado.escudo;
    let xt = x + 18;
    if (temTime) {
      await escudo(ctx, lado.escudo, x + 12, yy + 9, rh - 18);
      xt = x + rh + 6;
    }
    escrever(ctx, (temTime ? lado.nome : lado.texto).toUpperCase(), xt, yy + rh / 2 - fs / 2 - 1, temTime ? `${fs}px ${F.titulo}` : `700 ${fs - 4}px ${F.rotulo}`, temTime ? COR.texto : COR.concreto, {
      max: x + w - rh - xt - 6,
    });
    if (gols !== undefined) escrever(ctx, `${gols}`, x + w - rh / 2, yy + rh / 2 - (fs + 12) / 2, `900 ${fs + 12}px ${F.numero}`, COR.texto, { alinhar: 'center', dourado: venceu });
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(201,204,209,0.18)';
  ctx.fillRect(x + 10, y + rh, w - 30, 1);
}

function ligacao(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  const xm = Math.round((x1 + x2) / 2);
  ctx.fillStyle = 'rgba(212,161,42,0.7)';
  ctx.fillRect(x1, y1, xm - x1, 3);
  ctx.fillRect(xm, Math.min(y1, y2), 3, Math.abs(y2 - y1) + 3);
  ctx.fillRect(xm, y2, x2 - xm, 3);
}

async function pecaChave(ctx: Ctx, F: Fontes, f: Formato, c: Record<number, JogoArte>, assinatura: string) {
  const st = f === 'story';
  await fundo(ctx, 'mata-mata', f);
  const y0 = st ? 250 : 70;
  await cabecalho(ctx, F, assinatura, y0);
  escrever(ctx, 'MATA-MATA', M, y0 + (st ? 165 : 140), `${st ? 112 : 92}px ${F.titulo}`, COR.texto);
  const [rh, fs, w] = st ? [96, 34, 290] : [76, 30, 290];
  const xs = [80, 395, 710];
  const h = rh * 2 + 4;
  const [top, gap] = st ? [640, 560] : [420, 420];
  const r1 = top;
  const r2 = top + gap;
  const s1 = r1 - rh / 2;
  const s2 = r2 - rh / 2;
  const fy = (s1 + s2) / 2;
  const ty = fy + h + (st ? 190 : 130);
  const rot = (n: number) => {
    const j = c[n];
    const hora = j.encerrado ? '' : ` · ${horaDe(j)}`;
    return `J${n} · ${j.rotulo}${hora}`;
  };
  // J29 alimenta a J31 e a J30 alimenta a J32 (regulamento.ts).
  await caixaChave(ctx, F, xs[0], r1, w, rh, fs, rot(29), c[29]);
  await caixaChave(ctx, F, xs[0], r2, w, rh, fs, rot(30), c[30]);
  await caixaChave(ctx, F, xs[1], s1, w, rh, fs, rot(31), c[31]);
  await caixaChave(ctx, F, xs[1], s2, w, rh, fs, rot(32), c[32]);
  await caixaChave(ctx, F, xs[2], fy, w, rh, fs, rot(34), c[34]);
  await caixaChave(ctx, F, xs[2], ty, w, rh, fs, rot(33), c[33]);
  ligacao(ctx, xs[0] + w, r1 + rh / 2, xs[1], s1 + rh + rh / 2);
  ligacao(ctx, xs[0] + w, r2 + rh / 2, xs[1], s2 + rh + rh / 2);
  ligacao(ctx, xs[1] + w, s1 + rh, xs[2], fy + rh / 2);
  ligacao(ctx, xs[1] + w, s2 + rh, xs[2], fy + rh + rh / 2);
  const nota = 'Empate vai para os pênaltis';
  if (st) escrever(ctx, nota.toUpperCase(), L / 2, 1540, `700 28px ${F.rotulo}`, COR.texto, { alinhar: 'center', tr: 2 });
  else rodape(ctx, F, 1255, nota);
}

async function pecaMelhor(ctx: Ctx, F: Fontes, f: Formato, m: MelhorDaPartidaArte, assinatura: string) {
  const st = f === 'story';
  const k = st ? 1.15 : 1;
  await fundo(ctx, 'melhor-da-partida', f);
  const j = m.jogo;
  await cabecalho(ctx, F, `${j.rotulo}${j.numero !== undefined ? ` · Jogo ${j.numero}` : ''}`, st ? 250 : 70);
  const ny = st ? 560 : 250;
  escrever(ctx, 'MELHOR DA PARTIDA', L / 2, ny, `700 ${Math.round(30 * k)}px ${F.rotulo}`, COR.areia, { alinhar: 'center', tr: 5 });
  escrever(ctx, m.nome.toUpperCase(), L / 2, ny + 46 * k, `${Math.round(150 * k)}px ${F.titulo}`, COR.texto, { alinhar: 'center', max: L - 2 * M, sombra: true });
  const extra = [m.gols ? `${m.gols} ${m.gols === 1 ? 'gol' : 'gols'}` : '', m.assistencias ? `${m.assistencias} ${m.assistencias === 1 ? 'assist.' : 'assist.'}` : ''].filter(Boolean).join(' · ');
  const placar = j.golsMandante !== undefined ? `${j.mandante.nome} ${j.golsMandante} × ${j.golsVisitante} ${j.visitante.nome}` : `${j.mandante.nome} × ${j.visitante.nome}`;
  escrever(ctx, `${placar}${extra ? ` · ${extra}` : ''}`.toUpperCase(), L / 2, ny + 220 * k, `700 ${Math.round(28 * k)}px ${F.rotulo}`, COR.texto, { alinhar: 'center', tr: 1.6, max: L - 2 * M });
  const cs = st ? 360 : 300;
  await escudo(ctx, m.equipe.escudo, L / 2 - cs / 2, st ? 990 : 735, cs, true);
  if (st) await placaEM(ctx, F, 340, 1450, 400, 110, 'Oferecimento');
  else {
    await placaEM(ctx, F, 380, 1092, 320, 100, 'Oferecimento', 20);
    rodape(ctx, F, 1255, assinatura);
  }
}

/** Imagem cortada para cobrir a área inteira (como `object-fit: cover`). */
function imagemCobrindo(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * r;
  const ih = img.naturalHeight * r;
  // Corta mais embaixo que em cima: na foto em pé, a cabeça fica no terço de cima.
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * 0.35, iw, ih);
}

/** Craque do jogo (stories): foto do jogador numa moldura, nome e placar embaixo, EM abaixo. */
async function pecaCraque(ctx: Ctx, F: Fontes, m: MelhorDaPartidaArte, foto: string) {
  const f: Formato = 'story';
  await fundo(ctx, 'craque-do-jogo', f, 'resultados');
  escrever(ctx, 'CRAQUE DO JOGO', L / 2, 222, `118px ${F.titulo}`, '', { alinhar: 'center', dourado: true, sombra: true, max: L - 2 * M });
  const [x0, y0, x1, y1] = [97, 384, 983, 1478];
  const w = x1 - x0;
  const h = y1 - y0;
  ctx.save();
  caminhoCorte(ctx, x0 - 8, y0 - 8, w + 16, h + 16, 44);
  ctx.fillStyle = COR.marinho;
  ctx.fill();
  ctx.restore();
  ctx.save();
  caminhoCorte(ctx, x0, y0, w, h, 38);
  ctx.clip();
  const img = await carregarImagem(foto);
  if (img) imagemCobrindo(ctx, img, x0, y0, w, h);
  else retangulo(ctx, x0, y0, w, h, COR.profundo);
  const sombra = ctx.createLinearGradient(0, y1 - 300, 0, y1);
  sombra.addColorStop(0, 'rgba(6,18,42,0)');
  sombra.addColorStop(1, 'rgba(6,18,42,0.94)');
  ctx.fillStyle = sombra;
  ctx.fillRect(x0, y1 - 300, w, 300);
  ctx.restore();
  retangulo(ctx, x0 - 8, y1 + 8, w + 16, 6, ouro(ctx, x0 - 8, y1 + 8, w + 16, 6));
  const logo = await carregarImagem(LOGO);
  if (logo) imagemContida(ctx, logo, x1 - 110, y0 + 24, 86, (logo.naturalHeight / logo.naturalWidth) * 86, true);

  const j = m.jogo;
  const quando = `${j.rotulo}${j.numero !== undefined ? ` · Jogo ${j.numero}` : ''}`;
  escrever(ctx, quando.toUpperCase(), x0 + 34, y1 - 214, `700 26px ${F.rotulo}`, COR.areia, { tr: 3.5 });
  escrever(ctx, m.nome.toUpperCase(), x0 + 34, y1 - 178, `92px ${F.titulo}`, COR.texto, { max: w - 68, sombra: true });
  const placar = j.golsMandante !== undefined ? `${j.mandante.nome} ${j.golsMandante} × ${j.golsVisitante} ${j.visitante.nome}` : `${j.mandante.nome} × ${j.visitante.nome}`;
  escrever(ctx, placar.toUpperCase(), x0 + 34, y1 - 70, `700 30px ${F.rotulo}`, COR.texto, { tr: 1.5, max: w - 68 });
  await placaEM(ctx, F, 340, 1556, 400, 108, 'Oferecimento', 24, COR.profundo);
}

/** Seleção da Copa no campo, 1 goleiro e 7 de linha (3-3-1). */
const POSICOES_SELECAO: ReadonlyArray<[number, number]> = [
  [540, 1140],
  [250, 940],
  [540, 900],
  [830, 940],
  [250, 680],
  [540, 640],
  [830, 680],
  [540, 400],
];

async function pecaSelecao(ctx: Ctx, F: Fontes, jogadores: JogadorSelecaoArte[], subtitulo: string) {
  const f: Formato = 'feed';
  await fundo(ctx, 'campo', f);
  const logo = await carregarImagem(LOGO);
  if (logo) ctx.drawImage(logo, M, 12, 66, (logo.naturalHeight / logo.naturalWidth) * 66);
  escrever(ctx, subtitulo.toUpperCase(), L - M, 40, `700 28px ${F.rotulo}`, COR.texto, { alinhar: 'right', tr: 2 });
  modulo(ctx, M, 150, 660, 124);
  escrever(ctx, 'SELEÇÃO DA COPA', 110, 170, `84px ${F.titulo}`, COR.texto, { max: 610 });
  for (const [i, jg] of jogadores.slice(0, POSICOES_SELECAO.length).entries()) {
    const [x, y] = POSICOES_SELECAO[i];
    await escudo(ctx, jg.equipe.escudo, x - 43, y - 70, 86, true);
    const w = 230;
    retangulo(ctx, x - w / 2, y + 22, w, 46, 'rgba(6,18,42,0.9)');
    retangulo(ctx, x - w / 2, y + 65, w, 3, i === 0 ? '#F2CB57' : COR.dourado);
    escrever(ctx, jg.nome.toUpperCase(), x, y + 28, `30px ${F.titulo}`, COR.texto, { alinhar: 'center', max: w - 16 });
  }
  rodape(ctx, F, 1255, 'Escolha da organização');
}

async function pecaCampeao(ctx: Ctx, F: Fontes, f: Formato, c: CampeaoArte, assinatura: string) {
  const st = f === 'story';
  const k = st ? 1.2 : 1;
  await fundo(ctx, 'campeao', f);
  await cabecalho(ctx, F, assinatura, st ? 250 : 70);
  const ty = st ? 430 : 245;
  escrever(ctx, 'CAMPEÃO', L / 2, ty, `${Math.round(170 * k)}px ${F.titulo}`, '', { alinhar: 'center', dourado: true });
  const es = Math.round(330 * k);
  await escudo(ctx, c.campeao.escudo, L / 2 - es / 2, ty + 225 * k, es, true);
  escrever(ctx, c.campeao.nome.toUpperCase(), L / 2, ty + 580 * k, `${Math.round(96 * k)}px ${F.titulo}`, COR.texto, { alinhar: 'center', max: L - 2 * M });
  const fj = c.final;
  const placar = `Final: ${fj.mandante.nome} ${fj.golsMandante ?? 0} × ${fj.golsVisitante ?? 0} ${fj.visitante.nome}${fj.penaltis ? ` (pên. ${fj.penaltis[0]}–${fj.penaltis[1]})` : ''}`;
  escrever(ctx, placar.toUpperCase(), L / 2, ty + 690 * k, `700 ${Math.round(28 * k)}px ${F.rotulo}`, COR.areia, { alinhar: 'center', tr: 1.6, max: L - 2 * M });
  const podio = `Vice: ${c.vice.nome}${c.terceiro ? ` · 3º lugar: ${c.terceiro.nome}` : ''}`;
  escrever(ctx, podio.toUpperCase(), L / 2, ty + 735 * k, `700 ${Math.round(24 * k)}px ${F.rotulo}`, COR.concreto, { alinhar: 'center', tr: 1.4, max: L - 2 * M });
  if (st) await placaEM(ctx, F, 340, 1440, 400, 110, 'Premiação oferecida por');
  else await placaEM(ctx, F, 380, 1075, 320, 100, 'Premiação oferecida por', 20);
}

// ---------- regulamento (feed, em páginas) ----------

const REG = { x: M, largura: L - 2 * M, topo: 350, fim: 1120, tamTexto: 25, linha: 34, tamTitulo: 22 };

function quebrar(ctx: Ctx, texto: string, largura: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width > largura && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Divide o regulamento em páginas do feed, sem cortar um item no meio. Precisa de um canvas para medir. */
export function paginarRegulamento(secoes: SecaoRegulamento[]): SecaoRegulamento[][] {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return [secoes];
  const F = lerFontes();
  ctx.font = `500 ${REG.tamTexto}px ${F.texto}`;
  const paginas: SecaoRegulamento[][] = [[]];
  let y = REG.topo;
  for (const s of secoes) {
    let atual: SecaoRegulamento = { titulo: s.titulo, itens: [] };
    const cabeca = 48;
    if (y + cabeca + REG.linha > REG.fim) {
      paginas.push([]);
      y = REG.topo;
    }
    paginas[paginas.length - 1].push(atual);
    y += cabeca;
    for (const it of s.itens) {
      const h = quebrar(ctx, it, REG.largura - 28).length * REG.linha + 8;
      if (y + h > REG.fim) {
        atual = { titulo: `${s.titulo} (cont.)`, itens: [] };
        paginas.push([atual]);
        y = REG.topo + cabeca;
      }
      atual.itens.push(it);
      y += h;
    }
    y += 22;
  }
  return paginas.filter((p) => p.length > 0);
}

async function pecaRegulamento(ctx: Ctx, F: Fontes, paginas: SecaoRegulamento[][], pagina: number, assinatura: string) {
  const f: Formato = 'feed';
  await fundo(ctx, 'regulamento', f);
  const NAV = COR.profundo;
  const logo = await carregarImagem(LOGO);
  if (logo) ctx.drawImage(logo, M, 18, 96, (logo.naturalHeight / logo.naturalWidth) * 96);
  escrever(ctx, `${assinatura}${paginas.length > 1 ? ` · ${pagina}/${paginas.length}` : ''}`.toUpperCase(), L - M, 62, `700 28px ${F.rotulo}`, COR.texto, { alinhar: 'right', tr: 2 });
  escrever(ctx, 'REGULAMENTO', M, 205, `100px ${F.titulo}`, NAV);
  let y = REG.topo;
  for (const s of paginas[pagina - 1] ?? []) {
    escrever(ctx, s.titulo.toUpperCase(), REG.x, y, `700 ${REG.tamTitulo}px ${F.rotulo}`, '#9C6F14', { tr: 3 });
    retangulo(ctx, REG.x, y + 30, REG.largura, 3, COR.dourado);
    y += 48;
    ctx.font = `500 ${REG.tamTexto}px ${F.texto}`;
    for (const it of s.itens) {
      retangulo(ctx, REG.x, y + 13, 8, 8, COR.dourado);
      ctx.font = `500 ${REG.tamTexto}px ${F.texto}`;
      for (const linha of quebrar(ctx, it, REG.largura - 28)) {
        escrever(ctx, linha, REG.x + 28, y, `500 ${REG.tamTexto}px ${F.texto}`, NAV);
        y += REG.linha;
      }
      y += 8;
    }
    y += 22;
  }
  rodape(ctx, F, 1235, 'copa-jumentus.vercel.app', NAV, 820);
}

// ---------- entrada ----------

let fontesProntas: Promise<unknown> | null = null;
async function esperarFontes(F: Fontes) {
  fontesProntas ??= Promise.all(
    [`40px ${F.titulo}`, `900 40px ${F.numero}`, `700 40px ${F.rotulo}`, `500 40px ${F.texto}`].map((x) => document.fonts.load(x).catch(() => [])),
  );
  await fontesProntas;
}

/** Formatos em que a peça existe. */
export function formatosDa(p: Peca): Formato[] {
  if (p.tipo === 'selecao' || p.tipo === 'regulamento') return ['feed'];
  if (p.tipo === 'craque') return ['story'];
  if (p.tipo === 'divulgacao') return [p.formato];
  return ['feed', 'story'];
}

export async function desenharPeca(canvas: HTMLCanvasElement, p: Peca, f: Formato, assinatura: string) {
  canvas.width = L;
  canvas.height = ALTURA[f];
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const F = lerFontes();
  await esperarFontes(F);
  ctx.clearRect(0, 0, L, ALTURA[f]);
  switch (p.tipo) {
    case 'rodada':
      return pecaRodada(ctx, F, f, p.bloco, assinatura);
    case 'jogo':
      return pecaJogo(ctx, F, f, p.jogo, assinatura);
    case 'classificacao':
      return pecaClassificacao(ctx, F, f, p.dados, assinatura);
    case 'programacao':
      return pecaProgramacao(ctx, F, f, p, assinatura);
    case 'ranking':
      return pecaRanking(ctx, F, f, p.dados, assinatura);
    case 'elenco':
      return pecaElenco(ctx, F, f, p.dados, assinatura);
    case 'chave':
      return pecaChave(ctx, F, f, p.chave, assinatura);
    case 'melhor':
      return pecaMelhor(ctx, F, f, p.dados, assinatura);
    case 'craque':
      return pecaCraque(ctx, F, p.dados, p.foto);
    case 'selecao':
      return pecaSelecao(ctx, F, p.jogadores, p.subtitulo);
    case 'campeao':
      return pecaCampeao(ctx, F, f, p.dados, assinatura);
    case 'regulamento':
      return pecaRegulamento(ctx, F, p.paginas, p.pagina, assinatura);
    case 'divulgacao': {
      const img = await carregarImagem(p.src);
      if (img) ctx.drawImage(img, 0, 0, L, ALTURA[f]);
      return;
    }
  }
}

export function nomeDaPeca(p: Peca, f: Formato): string {
  const qual = (() => {
    switch (p.tipo) {
      case 'rodada':
        return `resultados-${p.bloco.titulo}`;
      case 'jogo':
        return `${p.jogo.numero !== undefined ? `j${p.jogo.numero}` : 'jogo'}-${p.jogo.mandante.texto}-x-${p.jogo.visitante.texto}`;
      case 'classificacao':
        return `classificacao-${p.dados.grupo}`;
      case 'programacao':
        return `programacao-${p.dia.titulo}${p.paginas > 1 ? `-${p.pagina}` : ''}`;
      case 'ranking':
        return p.dados.tipo;
      case 'elenco':
        return `elenco-${p.dados.equipe.slug}`;
      case 'chave':
        return 'mata-mata';
      case 'melhor':
        return `melhor-da-partida-${p.dados.jogo.numero !== undefined ? `j${p.dados.jogo.numero}-` : ''}${p.dados.nome}`;
      case 'craque':
        return `craque-do-jogo-${p.dados.jogo.numero !== undefined ? `j${p.dados.jogo.numero}-` : ''}${p.dados.nome}`;
      case 'selecao':
        return 'selecao-da-copa';
      case 'campeao':
        return `campeao-${p.dados.campeao.nome}`;
      case 'regulamento':
        return `regulamento-${p.pagina}`;
      case 'divulgacao':
        return p.nome;
    }
  })();
  // As peças de divulgação já trazem o formato no nome ("anuncio-feed").
  if (p.tipo === 'divulgacao') return `copa-jumentus-${slugDe(qual)}.png`;
  return `copa-jumentus-${slugDe(qual)}-${f === 'feed' ? 'feed' : 'stories'}.png`;
}

export function comoBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Desenha num canvas fora da tela e devolve o PNG. */
export async function gerarPng(p: Peca, f: Formato, assinatura: string): Promise<{ blob: Blob; nome: string } | null> {
  const canvas = document.createElement('canvas');
  await desenharPeca(canvas, p, f, assinatura);
  const blob = await comoBlob(canvas);
  return blob ? { blob, nome: nomeDaPeca(p, f) } : null;
}

/** Só a arte de um jogo (página pública do jogo). */
export function arteDoJogo(jogo: JogoArte, f: Formato, assinatura: string) {
  return gerarPng({ tipo: 'jogo', jogo }, f, assinatura);
}
