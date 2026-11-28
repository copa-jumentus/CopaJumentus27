import Link from 'next/link';
import { PalmBackdrop } from '@/components/PalmBackdrop';
import { WordmarkCopaJumentus, WordmarkViceCity } from '@/components/Wordmark';
import { NOME_COMPETICAO, SUBTITULO_COMPETICAO } from '@/lib/config';
import { decodificarResultado } from '@/lib/share/codec';
import { ResultadoCliente } from './ResultadoCliente';

export const metadata = { title: 'Resultado do sorteio — Copa Jumentus' };

interface Props {
  params: Promise<{ payload: string }>;
}

export default async function ResultadoPage({ params }: Props) {
  const { payload } = await params;
  const dados = decodificarResultado(payload);

  if (!dados) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="titulo-hero t-xl text-4xl">Link inválido</h1>
        <p className="mt-3 text-sm text-text-2">
          Este link de resultado está incompleto ou foi truncado pelo app de mensagens. Peça um
          novo à comissão.
        </p>
        <Link href="/" className="btn-hud mt-8 inline-block">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden px-4 pb-20">
      <PalmBackdrop className="opacity-90" intensidade="ambiente" />

      <div className="relative mx-auto max-w-4xl">
        <header className="py-6 text-center">
          <p className="hud-label mb-3">Edição MLS · Resultado oficial do sorteio ({dados.d})</p>
          <h1 className="mx-auto w-full max-w-[min(88vw,560px)]">
            <span className="sr-only">{NOME_COMPETICAO}</span>
            <WordmarkCopaJumentus />
          </h1>
          <div className="mx-auto mt-3 w-full max-w-[min(52vw,300px)]">
            <span className="sr-only">{SUBTITULO_COMPETICAO}</span>
            <WordmarkViceCity />
          </div>
          <h2 className="titulo-hero t-xl mt-6 text-3xl text-text-1 sm:text-5xl">
            Os times estão definidos
          </h2>
          <div className="filete mx-auto mt-3 w-28" aria-hidden="true" />
        </header>

        <ResultadoCliente dados={dados} />

        <footer className="pt-12 text-center">
          <div className="filete mx-auto mb-4 max-w-xs opacity-70" aria-hidden="true" />
          <p className="hud-label text-[11px]">
            Copa Jumentus — Vice City · @copajumentus
          </p>
        </footer>
      </div>
    </div>
  );
}
