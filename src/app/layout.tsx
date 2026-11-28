import { AvisoAtualizacao } from '@/components/AvisoAtualizacao';
import type { Metadata } from 'next';
import { Anton, Barlow, Barlow_Condensed } from 'next/font/google';
import localFont from 'next/font/local';
import { Navbar, Rodape } from '@/components/Navbar';
import { NOME_COMPETICAO, SUBTITULO_COMPETICAO } from '@/lib/config';
import './globals.css';

// Fontes do manual de marca (docs/marca/manual-de-marca.md, Tipografia):
// títulos Anton, números Big Shoulders (antiga Display), rótulos Barlow Condensed, texto Barlow.
// Big Shoulders vai local (src/app/fontes, OFL): o next/font/google 15.5 quebra no build com ela.
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' });
const bigShoulders = localFont({
  src: [
    { path: './fontes/big-shoulders-latin-800-normal.woff2', weight: '800', style: 'normal' },
    { path: './fontes/big-shoulders-latin-900-normal.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-big-shoulders',
  fallback: ['Impact', 'Arial Narrow', 'sans-serif'],
});
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-barlow-condensed' });
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });

const DESCRICAO = 'Tabela, jogos, rankings e elencos da Copa Jumentus, o campeonato do @copajumentus.';

// Prévia do link no WhatsApp e redes: a imagem vem de app/opengraph-image.jpg (1200×630).
export const metadata: Metadata = {
  metadataBase: new URL('https://copa-jumentus.vercel.app'),
  title: `${NOME_COMPETICAO} — ${SUBTITULO_COMPETICAO}`,
  description: DESCRICAO,
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: NOME_COMPETICAO,
    title: `${NOME_COMPETICAO} — ${SUBTITULO_COMPETICAO}`,
    description: DESCRICAO,
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // As variaveis de fonte ficam no <html> para existirem no :root, onde
    // globals.css compoe --font-display / --font-sans / --font-mono.
    <html lang="pt-BR" className={`${anton.variable} ${bigShoulders.variable} ${barlowCondensed.variable} ${barlow.variable}`}>
      <body>
        <div className="grain-overlay" aria-hidden="true" />
        <div className="scroll-edge" aria-hidden="true" />
        <Navbar />
        {/* 58 px = barra (56) + filete (2). O espaço de respiro fica com cada tela. */}
        <main className="pt-[58px]">{children}</main>
        <Rodape />
        <AvisoAtualizacao />
      </body>
    </html>
  );
}
