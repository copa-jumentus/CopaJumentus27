// Artes do Instagram desenhadas no navegador (canvas 2D, sem dependência):
// resultados de uma rodada, artilharia, assistências e o resultado de um jogo, em feed (1080×1350) e
// stories (1080×1920), na grade do manual de marca (docs/marca/manual-de-marca.md,
// "Grade"). Os dados chegam prontos de lib/domain/campeonato/artes.ts.

import type { BlocoDeJogos, JogoArte, LanceArte, RankingArte } from '@/lib/domain/campeonato/artes';

export type Formato = 'feed' | 'story';
export type TipoArte = 'rodada' | 'artilharia' | 'assistencias' | 'jogo';

export interface DadosArtes {
  blocos: BlocoDeJogos[];
  artilharia: RankingArte;
  assistencias: RankingArte;
  /** "COPA JUMENTUS 2027", no rodapé. */
  assinatura: string;
  blocoInicial?: string;
}

export const L = 1080;
export const ALTURA: Record<Formato, number> = { feed: 1350, story: 1920 };
/** Zonas da grade do manual (feed e stories). */
const GRADE: Record<Formato, { cab: number; conteudo: number; fimConteudo: number; rodape: number }> = {
  feed: { cab: 80, conteudo: 220, fimConteudo: 1200, rodape: 1230 },
  story: { cab: 250, conteudo: 400, fimConteudo: 1480, rodape: 1490 },
};
const M = 80;

// Artes no clima Vice City / pôr do sol (decisão do operador em 25/11/2026):
// paleta violeta → roxo → magenta → coral → laranja → amarelo; o "dourado" das artes é o amarelo quente.
const COR = {
  fundo: '#1E0838',
  modulo: 'rgba(30,8,56,0.94)',
  moduloLider: 'rgba(70,22,110,0.9)',
  linha: '#7B208F',
  texto: '#FFF6F0',
  concreto: '#F0D9EC',
  dourado: '#FFB458',
  douradoClaro: '#FFB458',
  vermelho: '#FF3D6E',
  noite: '#1E0838',
};
const SOL = { violeta: '#3B146B', roxo: '#7B208F', magenta: '#C9349B', rosa: '#F36A78', coral: '#F87572', laranja: '#FF9B55', amarelo: '#FFB458' };
const SILHUETA = '#2A0A45';

/** Gerador determinístico (a arte sai igual toda vez). */
function semente(n: number) {
  let x = n;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

function ponto(p0: [number, number], c: [number, number], p1: [number, number], t: number): [number, number] {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
}

/** Folha de palmeira: nervura curva caindo, com folíolos preenchidos dos dois lados. */
function folha(ctx: CanvasRenderingContext2D, origem: [number, number], ang: number, comp: number, sorte: () => number) {
  const ponta: [number, number] = [origem[0] + Math.cos(ang) * comp, origem[1] + Math.sin(ang) * comp * 0.5 + comp * 0.62];
  const ctrl: [number, number] = [origem[0] + Math.cos(ang) * comp * 0.7, origem[1] + Math.sin(ang) * comp * 0.8 - comp * 0.12];
  ctx.lineWidth = Math.max(2, comp * 0.022);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const [x, y] = ponto(origem, ctrl, ponta, i / 24);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  const n = 34;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const [x, y] = ponto(origem, ctrl, ponta, t);
    const [x2, y2] = ponto(origem, ctrl, ponta, Math.min(1, t + 0.01));
    const a = Math.atan2(y2 - y, x2 - x);
    const l = comp * 0.34 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.75 + sorte() * 0.5);
    const larg = comp * 0.018;
    for (const lado of [-1, 1]) {
      const af = a + lado * (0.75 + sorte() * 0.25);
      const fx = x + Math.cos(af) * l;
      const fy = y + Math.sin(af) * l + l * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * larg, y - Math.sin(a) * larg);
      ctx.quadraticCurveTo((x + fx) / 2 + lado * 2, (y + fy) / 2 - l * 0.12, fx, fy);
      ctx.lineTo(x + Math.cos(a) * larg, y + Math.sin(a) * larg);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Copa de palmeira (sem tronco ou no alto de um tronco). */
function copa(ctx: CanvasRenderingContext2D, centro: [number, number], raio: number, cor: string, sorte: () => number, angulos?: [number, number]) {
  ctx.save();
  ctx.fillStyle = cor;
  ctx.strokeStyle = cor;
  ctx.lineCap = 'round';
  const [a0, a1] = angulos ?? [-Math.PI * 1.08, Math.PI * 0.08];
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = a0 + ((a1 - a0) * k) / (n - 1) + (sorte() - 0.5) * 0.2;
    folha(ctx, centro, a, raio * (0.7 + sorte() * 0.4), sorte);
  }
  ctx.beginPath();
  ctx.arc(centro[0], centro[1], raio * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Palmeira inteira: tronco curvo e fino, com anéis, e a copa no alto. */
function palmeira(ctx: CanvasRenderingContext2D, base: [number, number], topo: [number, number], raio: number, cor: string, sorte: () => number) {
  ctx.save();
  ctx.fillStyle = cor;
  const curva: [number, number] = [base[0] + (topo[0] - base[0]) * 0.15, (base[1] + topo[1]) / 2];
  const esq: [number, number][] = [];
  const dir: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const [x, y] = ponto(base, curva, topo, t);
    const w = raio * (0.05 - 0.025 * t);
    esq.push([x - w, y]);
    dir.push([x + w, y]);
  }
  ctx.beginPath();
  esq.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  [...dir].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  copa(ctx, topo, raio, cor, sorte);
}

/** Céu de pôr do sol, sol no horizonte, skyline, água e palmeiras. */
function cenaViceCity(ctx: CanvasRenderingContext2D, f: Formato) {
  const H = ALTURA[f];
  const story = f === 'story';
  const sorte = semente(story ? 11 : 7);
  const horizonte = story ? 1720 : H;
  const ceu = ctx.createLinearGradient(0, 0, 0, horizonte);
  ceu.addColorStop(0, '#24094A');
  ceu.addColorStop(0.2, SOL.violeta);
  ceu.addColorStop(0.45, SOL.roxo);
  ceu.addColorStop(0.66, SOL.magenta);
  ceu.addColorStop(0.82, SOL.rosa);
  ceu.addColorStop(0.93, SOL.laranja);
  ceu.addColorStop(1, SOL.amarelo);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, L, horizonte);
  // Faixas de nuvem.
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const y = horizonte * (0.5 + sorte() * 0.45);
    ctx.globalAlpha = 0.12 + sorte() * 0.14;
    ctx.fillStyle = i % 2 ? SOL.coral : SOL.magenta;
    ctx.beginPath();
    ctx.ellipse(sorte() * L, y, 180 + sorte() * 300, 5 + sorte() * 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (story) {
    // Sol, skyline e água só no stories, abaixo da área segura.
    const rSol = 170;
    const cx = L * 0.36;
    const brilho = ctx.createRadialGradient(cx, horizonte, rSol * 0.5, cx, horizonte, rSol * 3);
    brilho.addColorStop(0, 'rgba(255,224,138,0.6)');
    brilho.addColorStop(1, 'rgba(255,180,88,0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(0, horizonte - rSol * 3, L, rSol * 3);
    const sol = ctx.createLinearGradient(0, horizonte - rSol, 0, horizonte);
    sol.addColorStop(0, '#FFE6A0');
    sol.addColorStop(1, SOL.laranja);
    ctx.fillStyle = sol;
    ctx.beginPath();
    ctx.arc(cx, horizonte, rSol, Math.PI, 0);
    ctx.fill();
    let x = L * 0.52;
    while (x < L + 20) {
      const w = 22 + sorte() * 40;
      const h = 30 + sorte() * 110;
      ctx.fillStyle = 'rgba(42,10,69,0.92)';
      ctx.fillRect(x, horizonte - h, w, h);
      ctx.fillStyle = 'rgba(255,155,85,0.8)';
      for (let jy = horizonte - h + 8; jy < horizonte - 6; jy += 12) for (let jx = x + 4; jx < x + w - 5; jx += 9) if (sorte() < 0.18) ctx.fillRect(jx, jy, 3, 5);
      x += w + 2 + sorte() * 6;
    }
    for (let x2 = -10; x2 < L * 0.22; ) {
      const w = 18 + sorte() * 30;
      const h = 14 + sorte() * 50;
      ctx.fillStyle = 'rgba(42,10,69,0.85)';
      ctx.fillRect(x2, horizonte - h, w, h);
      x2 += w + 3;
    }
    const agua = ctx.createLinearGradient(0, horizonte, 0, H);
    agua.addColorStop(0, '#5A1A78');
    agua.addColorStop(0.4, '#2E0C50');
    agua.addColorStop(1, '#14052A');
    ctx.fillStyle = agua;
    ctx.fillRect(0, horizonte, L, H - horizonte);
    ctx.save();
    for (let i = 0; i < 20; i++) {
      const y = horizonte + 5 + i * 10;
      const w = rSol * (1.7 - i * 0.07) * (0.6 + sorte() * 0.5);
      ctx.globalAlpha = Math.max(0, 0.6 - i * 0.03);
      ctx.fillStyle = i % 3 ? SOL.laranja : SOL.rosa;
      ctx.fillRect(cx - w / 2 + (sorte() - 0.5) * 24, y, w, 3);
    }
    ctx.restore();
    palmeira(ctx, [L - 40, horizonte + 30], [L - 70, 1400], 240, SILHUETA, sorte);
    palmeira(ctx, [70, horizonte + 30], [30, 1650], 150, 'rgba(42,10,69,0.9)', sorte);
  } else {
    palmeira(ctx, [L - 40, H + 20], [L - 110, 860], 250, 'rgba(42,10,69,0.88)', sorte);
    palmeira(ctx, [30, H + 20], [70, 980], 190, 'rgba(42,10,69,0.8)', sorte);
  }
  // Copas entrando pelos cantos de cima, como nas artes de Vice City.
  copa(ctx, [L + 40, story ? 120 : -40], story ? 420 : 380, SILHUETA, sorte, [Math.PI * 0.35, Math.PI * 1.05]);
  copa(ctx, [-60, story ? 980 : 640], 300, 'rgba(42,10,69,0.85)', sorte, [-Math.PI * 0.45, Math.PI * 0.45]);
}

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
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imagens.set(src, p);
  return p;
}

// ---------- primitivas ----------

function gradienteDourado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): CanvasGradient {
  const g = ctx.createLinearGradient(x, y + h, x + w, y);
  g.addColorStop(0, SOL.rosa);
  g.addColorStop(0.5, SOL.laranja);
  g.addColorStop(1, SOL.amarelo);
  return g;
}

function espacamento(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing existe no Chrome e no Safari recentes; sem ele, só fica sem tracking.
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

function texto(
  ctx: CanvasRenderingContext2D,
  conteudo: string,
  x: number,
  y: number,
  fonte: string,
  cor: string | CanvasGradient,
  opcoes: { alinhar?: CanvasTextAlign; tracking?: number; maxLargura?: number } = {},
) {
  ctx.font = fonte;
  ctx.fillStyle = cor;
  ctx.textAlign = opcoes.alinhar ?? 'left';
  ctx.textBaseline = 'alphabetic';
  espacamento(ctx, opcoes.tracking ?? 0);
  if (opcoes.maxLargura) {
    // Encolhe a fonte até caber (nomes longos), em vez de cortar.
    const tamanho = Number(/(\d+)px/.exec(fonte)?.[1] ?? 40);
    let t = tamanho;
    while (t > 12 && ctx.measureText(conteudo).width > opcoes.maxLargura) {
      t -= 2;
      ctx.font = fonte.replace(`${tamanho}px`, `${t}px`);
    }
  }
  ctx.fillText(conteudo, x, y);
  espacamento(ctx, 0);
}

/** Módulo de transmissão: canto superior direito cortado a 45° e filete dourado na base. */
function modulo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fundo = COR.modulo) {
  const corte = 26;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - corte, y);
  ctx.lineTo(x + w, y + corte);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = fundo;
  ctx.fill();
  ctx.fillStyle = gradienteDourado(ctx, x, y + h - 3, w, 3);
  ctx.fillRect(x, y + h - 3, w, 3);
}

function imagemContida(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, lado: number) {
  if (!img) return;
  const r = Math.min(lado / img.naturalWidth, lado / img.naturalHeight);
  const w = img.naturalWidth * r;
  const h = img.naturalHeight * r;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

let ruido: HTMLCanvasElement | null = null;
function padraoRuido(): HTMLCanvasElement {
  if (ruido) return ruido;
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  if (g) {
    const dados = g.createImageData(160, 160);
    for (let i = 0; i < dados.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      dados.data[i] = dados.data[i + 1] = dados.data[i + 2] = v;
      dados.data[i + 3] = 255;
    }
    g.putImageData(dados, 0, 0);
  }
  ruido = c;
  return c;
}

// ---------- moldura comum ----------

async function moldura(ctx: CanvasRenderingContext2D, f: Formato, fontes: Fontes, rotulo: string, sub: string, assinatura: string) {
  const g = GRADE[f];
  cenaViceCity(ctx, f);

  // Diagonais no canto (magenta, rosa, amarelo), acima do cabeçalho.
  const topo = f === 'feed' ? 0 : 150;
  ctx.save();
  ctx.beginPath();
  ctx.rect(L - 300, topo, 300, 64);
  ctx.clip();
  [SOL.magenta, SOL.rosa, SOL.amarelo].forEach((cor, i) => {
    ctx.save();
    ctx.translate(L - 140 + i * 36, topo + 32);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = cor;
    ctx.fillRect(-260, -13, 520, 26);
    ctx.restore();
  });
  ctx.restore();

  // Cabeçalho: brasão à esquerda, rótulo da peça à direita.
  const logo = await carregarImagem('/imagens/logo/copa-jumentus-logo.png');
  if (logo) {
    const h = 120;
    ctx.drawImage(logo, M, g.cab, (logo.naturalWidth / logo.naturalHeight) * h, h);
  }
  texto(ctx, rotulo.toUpperCase(), L - M, g.cab + 56, `700 26px ${fontes.rotulo}`, COR.dourado, { alinhar: 'right', tracking: 3.6 });
  texto(ctx, sub.toUpperCase(), L - M, g.cab + 88, `600 22px ${fontes.rotulo}`, COR.concreto, { alinhar: 'right', tracking: 2.2 });

  // Rodapé: filete dourado de 4 px e @C.R.JUMENTUS.
  // Rodapé sobre o céu quente: texto em violeta profundo.
  ctx.fillStyle = SILHUETA;
  ctx.fillRect(M, g.rodape, L - 2 * M, 4);
  texto(ctx, '@C.R.JUMENTUS', M, g.rodape + 46, `700 26px ${fontes.rotulo}`, SILHUETA, { tracking: 3.6 });
  texto(ctx, assinatura.toUpperCase(), L - M, g.rodape + 46, `700 26px ${fontes.rotulo}`, SILHUETA, { alinhar: 'right', tracking: 3.6 });
}

function grao(ctx: CanvasRenderingContext2D, f: Formato) {
  const p = ctx.createPattern(padraoRuido(), 'repeat');
  if (!p) return;
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = p;
  ctx.fillRect(0, 0, L, ALTURA[f]);
  ctx.restore();
}

/** Título em Anton com a parte dourada opcional ("RODADA" + "3"). Devolve o y logo abaixo do subtítulo. */
function titulo(ctx: CanvasRenderingContext2D, fontes: Fontes, y: number, branco: string, dourado: string, sub: string, tam: number): number {
  const base = y + tam * 0.86;
  texto(ctx, branco.toUpperCase(), M, base, `${tam}px ${fontes.titulo}`, COR.texto, { tracking: 0.5 });
  if (dourado) {
    ctx.font = `${tam}px ${fontes.titulo}`;
    espacamento(ctx, 0.5);
    const w = ctx.measureText(`${branco.toUpperCase()} `).width;
    espacamento(ctx, 0);
    texto(ctx, dourado.toUpperCase(), M + w, base, `${tam}px ${fontes.titulo}`, gradienteDourado(ctx, M + w, y, tam, tam), { tracking: 0.5 });
  }
  texto(ctx, sub.toUpperCase(), M, base + 64, `600 28px ${fontes.rotulo}`, COR.concreto, { tracking: 3.4 });
  return base + 64;
}

// ---------- arte de resultados ----------

async function desenharRodada(ctx: CanvasRenderingContext2D, f: Formato, fontes: Fontes, bloco: BlocoDeJogos, assinatura: string) {
  const [primeiraParte, ...resto] = bloco.legenda.split(' · ');
  await moldura(ctx, f, fontes, primeiraParte, resto.join(' · '), assinatura);
  const g = GRADE[f];
  const m = /^(.*?)(\d+)$/.exec(bloco.titulo);
  const fimTitulo = titulo(ctx, fontes, g.conteudo, m ? m[1].trim() : bloco.titulo, m ? m[2] : '', `Resultados · ${bloco.faixa}`, f === 'story' ? 128 : 104);

  const jogos = bloco.jogos;
  const topo = fimTitulo + (f === 'story' ? 64 : 46);
  const disponivel = g.fimConteudo - topo;
  const gap = f === 'story' ? 30 : 22;
  const h = Math.min(f === 'story' ? 220 : 172, (disponivel - gap * (jogos.length - 1)) / Math.max(1, jogos.length));
  const escudos = await Promise.all(jogos.flatMap((j) => [carregarImagem(j.mandante.escudo), carregarImagem(j.visitante.escudo)]));
  jogos.forEach((j, i) => cardJogo(ctx, fontes, j, topo + i * (h + gap), h, escudos[2 * i], escudos[2 * i + 1]));
  grao(ctx, f);
}

function cardJogo(ctx: CanvasRenderingContext2D, fontes: Fontes, j: JogoArte, y: number, h: number, escM: HTMLImageElement | null, escV: HTMLImageElement | null) {
  const w = L - 2 * M;
  modulo(ctx, M, y, w, h);
  ctx.fillStyle = j.mandante.cor;
  ctx.fillRect(M, y, 8, h - 3);
  ctx.fillStyle = j.visitante.cor;
  ctx.fillRect(M + w - 8, y + 26, 8, h - 29);

  const cy = y + h / 2;
  const esc = Math.min(96, h * 0.56);
  const siglaFonte = (s: string) => (s.length > 4 ? `30px ${fontes.titulo}` : `46px ${fontes.titulo}`);
  imagemContida(ctx, escM, M + 36 + esc / 2, cy, esc);
  texto(ctx, j.mandante.texto.toUpperCase(), M + 36 + esc + 26, cy + 16, siglaFonte(j.mandante.texto), j.mandante.escudo ? COR.texto : COR.concreto, { maxLargura: 250 });
  imagemContida(ctx, escV, M + w - 36 - esc / 2, cy, esc);
  texto(ctx, j.visitante.texto.toUpperCase(), M + w - 36 - esc - 26, cy + 16, siglaFonte(j.visitante.texto), j.visitante.escudo ? COR.texto : COR.concreto, { alinhar: 'right', maxLargura: 250 });

  const centro = L / 2;
  const situacao = `${j.numero ? `J${j.numero} · ` : ''}${j.situacao}`;
  texto(ctx, situacao, centro, y + 40, `700 22px ${fontes.rotulo}`, j.situacao === 'AO VIVO' ? COR.vermelho : COR.concreto, { alinhar: 'center', tracking: 3 });

  const tam = Math.round(Math.min(104, h * 0.6));
  const base = cy + tam * 0.42 + (j.penaltis ? -6 : 8);
  if (j.golsMandante === undefined || j.golsVisitante === undefined) {
    texto(ctx, 'X', centro, base - tam * 0.12, `${Math.round(tam * 0.62)}px ${fontes.numero}`, COR.concreto, { alinhar: 'center' });
  } else {
    const corM = j.vencedor === 'mandante' ? COR.douradoClaro : COR.texto;
    const corV = j.vencedor === 'visitante' ? COR.douradoClaro : COR.texto;
    texto(ctx, String(j.golsMandante), centro - 62, base, `900 ${tam}px ${fontes.numero}`, corM, { alinhar: 'right' });
    texto(ctx, '×', centro, base - tam * 0.18, `900 ${Math.round(tam * 0.6)}px ${fontes.numero}`, COR.concreto, { alinhar: 'center' });
    texto(ctx, String(j.golsVisitante), centro + 62, base, `900 ${tam}px ${fontes.numero}`, corV, { alinhar: 'left' });
  }
  if (j.penaltis) {
    texto(ctx, `PÊNALTIS ${j.penaltis[0]} × ${j.penaltis[1]}`, centro, y + h - 18, `700 22px ${fontes.rotulo}`, COR.vermelho, { alinhar: 'center', tracking: 2.6 });
  }
}

// ---------- arte de um jogo ----------

/** Ícone do lance: bola (gol) ou cartão. Desenhado, sem emoji (manual, "Proibido"). */
function iconeLance(ctx: CanvasRenderingContext2D, tipo: LanceArte['tipo'], cx: number, cy: number, t: number) {
  ctx.save();
  if (tipo === 'amarelo' || tipo === 'vermelho') {
    ctx.translate(cx, cy);
    ctx.rotate(0.14);
    ctx.fillStyle = tipo === 'amarelo' ? COR.douradoClaro : COR.vermelho;
    ctx.fillRect(-t * 0.34, -t * 0.48, t * 0.68, t * 0.96);
  } else {
    const r = t * 0.46;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = COR.texto;
    ctx.fill();
    // Pentágono central e os gomos: lê como bola mesmo pequeno.
    ctx.fillStyle = COR.fundo;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = cx + Math.cos(a) * r * 0.42;
      const y = cy + Math.sin(a) * r * 0.42;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COR.fundo;
    ctx.lineWidth = Math.max(1.5, t * 0.07);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    if (tipo === 'contra') {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = COR.vermelho;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.restore();
}

const SUFIXO_LANCE: Partial<Record<LanceArte['tipo'], string>> = { penalti: ' (PÊN.)', contra: ' (CONTRA)' };

/** Altura de um lance na coluna (gol com assistência ocupa duas linhas). */
function alturaLance(l: LanceArte, linha: number): number {
  return l.assistencia ? linha * 1.55 : linha;
}

function colunaLances(ctx: CanvasRenderingContext2D, fontes: Fontes, lances: LanceArte[], x: number, y: number, largura: number, linha: number, direita: boolean) {
  const icone = linha * 0.52;
  const larguraMin = linha * 1.1;
  let topo = y;
  for (const l of lances) {
    const base = topo + linha * 0.68;
    const cy = topo + linha * 0.46;
    const corNome = l.tipo === 'amarelo' || l.tipo === 'vermelho' ? COR.concreto : COR.texto;
    const nome = `${l.nome.toUpperCase()}${SUFIXO_LANCE[l.tipo] ?? ''}`;
    const min = l.minuto !== undefined ? `${l.minuto}'` : '';
    if (!direita) {
      iconeLance(ctx, l.tipo, x + icone / 2, cy, icone);
      texto(ctx, min, x + icone + 16, base, `900 ${Math.round(linha * 0.6)}px ${fontes.numero}`, COR.dourado);
      texto(ctx, nome, x + icone + 16 + larguraMin, base, `${Math.round(linha * 0.5)}px ${fontes.titulo}`, corNome, {
        maxLargura: largura - icone - 16 - larguraMin,
        tracking: 0.4,
      });
      if (l.assistencia) {
        texto(ctx, `ASSIST. ${l.assistencia.toUpperCase()}`, x + icone + 16 + larguraMin, base + linha * 0.55, `600 ${Math.round(linha * 0.34)}px ${fontes.rotulo}`, COR.concreto, {
          tracking: 1.6,
          maxLargura: largura - icone - 16 - larguraMin,
        });
      }
    } else {
      const fim = x + largura;
      iconeLance(ctx, l.tipo, fim - icone / 2, cy, icone);
      texto(ctx, min, fim - icone - 16, base, `900 ${Math.round(linha * 0.6)}px ${fontes.numero}`, COR.dourado, { alinhar: 'right' });
      texto(ctx, nome, fim - icone - 16 - larguraMin, base, `${Math.round(linha * 0.5)}px ${fontes.titulo}`, corNome, {
        alinhar: 'right',
        maxLargura: largura - icone - 16 - larguraMin,
        tracking: 0.4,
      });
      if (l.assistencia) {
        texto(ctx, `ASSIST. ${l.assistencia.toUpperCase()}`, fim - icone - 16 - larguraMin, base + linha * 0.55, `600 ${Math.round(linha * 0.34)}px ${fontes.rotulo}`, COR.concreto, {
          alinhar: 'right',
          tracking: 1.6,
          maxLargura: largura - icone - 16 - larguraMin,
        });
      }
    }
    topo += alturaLance(l, linha);
  }
}

async function desenharJogo(ctx: CanvasRenderingContext2D, f: Formato, fontes: Fontes, j: JogoArte, assinatura: string) {
  const sub = [j.numero !== undefined ? `Jogo ${j.numero}` : '', j.quando].filter(Boolean).join(' · ');
  // Rodada fica no título; no canto, a fase.
  await moldura(ctx, f, fontes, j.fase || j.rotulo, sub, assinatura);
  const g = GRADE[f];
  const story = f === 'story';
  const aoVivo = j.situacao === 'AO VIVO';
  const fimTitulo = titulo(ctx, fontes, g.conteudo, aoVivo ? 'Parcial' : 'Fim de', aoVivo ? '' : 'jogo', j.rotulo, story ? 128 : 104);

  // Placar: escudos grandes, sigla embaixo, número no centro.
  const yP = fimTitulo + (story ? 60 : 44);
  const hP = story ? 470 : 360;
  const w = L - 2 * M;
  modulo(ctx, M, yP, w, hP);
  ctx.fillStyle = j.mandante.cor;
  ctx.fillRect(M, yP, 10, hP - 3);
  ctx.fillStyle = j.visitante.cor;
  ctx.fillRect(M + w - 10, yP + 26, 10, hP - 29);
  const [escM, escV] = await Promise.all([carregarImagem(j.mandante.escudo), carregarImagem(j.visitante.escudo)]);
  const lado = story ? 230 : 180;
  const cyEsc = yP + (story ? 190 : 150);
  const xM = M + 60 + lado / 2;
  const xV = L - M - 60 - lado / 2;
  imagemContida(ctx, escM, xM, cyEsc, lado);
  imagemContida(ctx, escV, xV, cyEsc, lado);
  const ySigla = cyEsc + lado / 2 + (story ? 76 : 64);
  const fonteSigla = (t: string) => `${t.length > 4 ? 34 : story ? 60 : 52}px ${fontes.titulo}`;
  texto(ctx, j.mandante.texto.toUpperCase(), xM, ySigla, fonteSigla(j.mandante.texto), COR.texto, { alinhar: 'center', maxLargura: lado + 40, tracking: 1 });
  texto(ctx, j.visitante.texto.toUpperCase(), xV, ySigla, fonteSigla(j.visitante.texto), COR.texto, { alinhar: 'center', maxLargura: lado + 40, tracking: 1 });

  const centro = L / 2;
  texto(ctx, aoVivo ? 'AO VIVO' : 'FIM', centro, yP + (story ? 70 : 58), `700 26px ${fontes.rotulo}`, aoVivo ? COR.vermelho : COR.concreto, { alinhar: 'center', tracking: 4 });
  const tam = story ? 230 : 190;
  const base = cyEsc + tam * 0.36;
  const corM = j.vencedor === 'mandante' ? COR.douradoClaro : COR.texto;
  const corV = j.vencedor === 'visitante' ? COR.douradoClaro : COR.texto;
  texto(ctx, String(j.golsMandante ?? 0), centro - 44, base, `900 ${tam}px ${fontes.numero}`, corM, { alinhar: 'right' });
  texto(ctx, '×', centro, base - tam * 0.2, `900 ${Math.round(tam * 0.42)}px ${fontes.numero}`, COR.concreto, { alinhar: 'center' });
  texto(ctx, String(j.golsVisitante ?? 0), centro + 44, base, `900 ${tam}px ${fontes.numero}`, corV, { alinhar: 'left' });
  if (j.penaltis) {
    texto(ctx, `PÊNALTIS ${j.penaltis[0]} × ${j.penaltis[1]}`, centro, ySigla, `700 30px ${fontes.rotulo}`, COR.vermelho, { alinhar: 'center', tracking: 3 });
  }

  // Lances: mandante à esquerda, visitante à direita, filete dourado no meio.
  const yL = yP + hP + (story ? 40 : 28);
  const hL = g.fimConteudo - yL;
  modulo(ctx, M, yL, w, hL);
  const todos = [...j.lances.mandante, ...j.lances.visitante];
  if (todos.length === 0) {
    texto(ctx, 'Sem gols nem cartões na súmula.', centro, yL + hL / 2 + 12, `600 32px ${fontes.texto}`, COR.concreto, { alinhar: 'center' });
    grao(ctx, f);
    return;
  }
  ctx.fillStyle = gradienteDourado(ctx, centro - 1, yL + 30, 2, hL - 60);
  ctx.fillRect(centro - 1, yL + 30, 2, hL - 60);
  const pad = 36;
  const altura = (ls: LanceArte[], linha: number) => ls.reduce((t, l) => t + alturaLance(l, linha), 0);
  // Maior linha que faz a coluna mais cheia caber no módulo.
  const linhaMax = story ? 76 : 64;
  const unidades = Math.max(altura(j.lances.mandante, 1), altura(j.lances.visitante, 1));
  const linha = Math.max(30, Math.min(linhaMax, (hL - 2 * pad) / unidades));
  const larguraCol = w / 2 - pad - 30;
  // Poucos lances: o bloco fica no meio do módulo, não colado no topo.
  const topo = yL + Math.max(pad, (hL - unidades * linha) / 2);
  colunaLances(ctx, fontes, j.lances.mandante, M + pad, topo, larguraCol, linha, false);
  colunaLances(ctx, fontes, j.lances.visitante, centro + 30, topo, larguraCol, linha, true);
  grao(ctx, f);
}

// ---------- arte de ranking ----------

async function desenharRanking(ctx: CanvasRenderingContext2D, f: Formato, fontes: Fontes, r: RankingArte, assinatura: string) {
  await moldura(ctx, f, fontes, 'Rankings', r.momento, assinatura);
  const g = GRADE[f];
  const fimTitulo = titulo(ctx, fontes, g.conteudo, r.titulo, '', r.legenda, f === 'story' ? 128 : 104);

  const cab = fimTitulo + (f === 'story' ? 66 : 50);
  texto(ctx, 'POS', M + 46, cab, `700 20px ${fontes.rotulo}`, COR.concreto, { alinhar: 'center', tracking: 2.8 });
  texto(ctx, 'JOGADOR', M + 186, cab, `700 20px ${fontes.rotulo}`, COR.concreto, { tracking: 2.8 });
  texto(ctx, r.unidade.toUpperCase(), L - M - 30, cab, `700 20px ${fontes.rotulo}`, COR.concreto, { alinhar: 'right', tracking: 2.8 });

  if (r.itens.length === 0) {
    texto(ctx, r.tipo === 'artilharia' ? 'Ainda sem gols registrados na súmula.' : 'Ainda sem assistências registradas na súmula.', M, cab + 80, `600 32px ${fontes.texto}`, COR.concreto);
    grao(ctx, f);
    return;
  }

  const topo = cab + 18;
  const gap = 10;
  const n = r.itens.length;
  const disponivel = g.fimConteudo - topo;
  // O líder fica 40% mais alto que os demais.
  const base = Math.min(f === 'story' ? 104 : 76, (disponivel - gap * (n - 1)) / (n + 0.4));
  const escudos = await Promise.all(r.itens.map((i) => carregarImagem(i.escudo)));
  let y = topo;
  r.itens.forEach((item, i) => {
    const lider = item.posicao === 1;
    const h = lider ? base * 1.4 : base;
    modulo(ctx, M, y, L - 2 * M, h, lider ? COR.moduloLider : COR.modulo);
    if (lider) {
      ctx.fillStyle = item.cor;
      ctx.fillRect(M, y, 10, h - 3);
    }
    const cy = y + h / 2;
    texto(ctx, String(item.posicao), M + 46, cy + h * 0.2, `900 ${Math.round(h * 0.56)}px ${fontes.numero}`, lider ? COR.douradoClaro : COR.concreto, { alinhar: 'center' });
    imagemContida(ctx, escudos[i], M + 130, cy, h * 0.62);
    texto(ctx, item.nome.toUpperCase(), M + 186, cy + h * 0.06, `${Math.round(h * (lider ? 0.4 : 0.42))}px ${fontes.titulo}`, COR.texto, { maxLargura: L - 2 * M - 186 - 160 });
    texto(ctx, item.sigla, M + 186, cy + h * 0.32, `700 ${Math.round(h * 0.22)}px ${fontes.rotulo}`, COR.concreto, { tracking: 2.6 });
    texto(ctx, String(item.valor), L - M - 30, cy + h * 0.25, `900 ${Math.round(h * 0.68)}px ${fontes.numero}`, lider ? COR.douradoClaro : COR.texto, { alinhar: 'right' });
    y += h + gap;
  });
  grao(ctx, f);
}


export async function desenhar(canvas: HTMLCanvasElement, tipo: TipoArte, f: Formato, props: DadosArtes, bloco: BlocoDeJogos | undefined, jogo?: JogoArte) {
  canvas.width = L;
  canvas.height = ALTURA[f];
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const fontes = lerFontes();
  // Garante as fontes do manual carregadas antes de desenhar (o canvas não espera sozinho).
  await Promise.all(
    [`40px ${fontes.titulo}`, `900 40px ${fontes.numero}`, `700 40px ${fontes.rotulo}`, `600 40px ${fontes.rotulo}`, `600 40px ${fontes.texto}`].map((f) =>
      document.fonts.load(f).catch(() => []),
    ),
  );
  if (tipo === 'jogo') {
    if (jogo) await desenharJogo(ctx, f, fontes, jogo, props.assinatura);
  } else if (tipo === 'rodada') {
    if (bloco) await desenharRodada(ctx, f, fontes, bloco, props.assinatura);
  } else {
    await desenharRanking(ctx, f, fontes, tipo === 'artilharia' ? props.artilharia : props.assistencias, props.assinatura);
  }
}

export function nomeArquivo(tipo: TipoArte, f: Formato, bloco?: BlocoDeJogos, jogo?: JogoArte): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  const qual =
    tipo === 'jogo' && jogo
      ? slug(`${jogo.numero !== undefined ? `j${jogo.numero}` : 'jogo'} ${jogo.mandante.texto} x ${jogo.visitante.texto}`)
      : tipo === 'rodada'
        ? slug(bloco?.titulo ?? 'rodada')
        : tipo;
  return `copa-jumentus-${qual}-${f}.png`;
}

export function comoBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}


/** Só a arte de um jogo (página pública do jogo): desenha num canvas fora da tela. */
export async function arteDoJogo(jogo: JogoArte, f: Formato, assinatura: string): Promise<{ blob: Blob; nome: string } | null> {
  const canvas = document.createElement('canvas');
  await desenhar(canvas, 'jogo', f, { blocos: [], artilharia: VAZIO, assistencias: VAZIO, assinatura }, undefined, jogo);
  const blob = await comoBlob(canvas);
  return blob ? { blob, nome: nomeArquivo('jogo', f, undefined, jogo) } : null;
}
const VAZIO: RankingArte = { tipo: 'artilharia', titulo: '', legenda: '', unidade: '', momento: '', itens: [] };
