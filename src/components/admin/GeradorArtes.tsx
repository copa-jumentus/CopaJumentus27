'use client';

// Tela de Admin › Artes: prévias e download. O desenho fica em components/artes/desenho.ts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALTURA, comoBlob, desenhar, L, nomeArquivo, type DadosArtes, type Formato, type TipoArte } from '@/components/artes/desenho';
import type { BlocoDeJogos, JogoArte } from '@/lib/domain/campeonato/artes';

type Props = DadosArtes;

export function GeradorArtes(props: Props) {
  const { blocos, blocoInicial } = props;
  const [formato, setFormato] = useState<Formato>('feed');
  const [blocoId, setBlocoId] = useState(blocoInicial ?? blocos[0]?.id ?? '');
  const bloco = useMemo(() => blocos.find((b) => b.id === blocoId), [blocos, blocoId]);
  const jogosComResultado = useMemo(() => (bloco?.jogos ?? []).filter((j) => j.golsMandante !== undefined), [bloco]);

  const artes: Array<{ tipo: TipoArte; titulo: string }> = [
    { tipo: 'rodada', titulo: bloco ? `Resultados · ${bloco.titulo}` : 'Resultados' },
    { tipo: 'artilharia', titulo: 'Artilharia' },
    { tipo: 'assistencias', titulo: 'Assistências' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <label>
          <span className="rotulo-campo">Rodada ou etapa</span>
          <select value={blocoId} onChange={(e) => setBlocoId(e.target.value)} className="campo min-w-56">
            {blocos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.titulo} · {b.jogos.filter((j) => j.encerrado).length}/{b.jogos.length} encerrados
              </option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label="Formato" className="flex">
          {(['feed', 'story'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={formato === f}
              onClick={() => setFormato(f)}
              className="btn-mini"
              data-ativo={formato === f || undefined}
              style={formato === f ? { background: 'var(--gradient-leonida)', color: '#06122A' } : undefined}
            >
              {f === 'feed' ? 'Feed 1080×1350' : 'Stories 1080×1920'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {artes.map((a) => (
          <CartaoArte key={a.tipo} tipo={a.tipo} titulo={a.titulo} formato={formato} props={props} bloco={bloco} />
        ))}
      </div>

      <h2 className="titulo-hero t-sm pt-2 text-2xl">Resultado de cada jogo{bloco ? ` · ${bloco.titulo}` : ''}</h2>
      {jogosComResultado.length === 0 ? (
        <p className="text-sm text-text-3">Nenhum jogo desta rodada começou ainda. A arte de cada jogo aparece quando ele estiver ao vivo ou encerrado.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {jogosComResultado.map((j) => (
            <CartaoArte
              key={j.id}
              tipo="jogo"
              titulo={`${j.numero !== undefined ? `J${j.numero} · ` : ''}${j.mandante.texto} ${j.golsMandante ?? 0} × ${j.golsVisitante ?? 0} ${j.visitante.texto}`}
              formato={formato}
              props={props}
              bloco={bloco}
              jogo={j}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoArte({
  tipo,
  titulo,
  formato,
  props,
  bloco,
  jogo,
}: {
  tipo: TipoArte;
  titulo: string;
  formato: Formato;
  props: Props;
  bloco?: BlocoDeJogos;
  jogo?: JogoArte;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let vivo = true;
    setPronto(false);
    void desenhar(canvas, tipo, formato, props, bloco, jogo).then(() => vivo && setPronto(true));
    return () => {
      vivo = false;
    };
  }, [tipo, formato, props, bloco, jogo]);

  useEffect(() => {
    const teste = new File([new Blob()], 'a.png', { type: 'image/png' });
    setPodeCompartilhar(typeof navigator.canShare === 'function' && navigator.canShare({ files: [teste] }));
  }, []);

  async function baixar() {
    const canvas = ref.current;
    if (!canvas) return;
    const blob = await comoBlob(canvas);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo(tipo, formato, bloco, jogo);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function compartilhar() {
    const canvas = ref.current;
    if (!canvas) return;
    const blob = await comoBlob(canvas);
    if (!blob) return;
    const arquivo = new File([blob], nomeArquivo(tipo, formato, bloco, jogo), { type: 'image/png' });
    try {
      await navigator.share({ files: [arquivo] });
    } catch {
      // Cancelado pelo usuário: nada a fazer.
    }
  }

  return (
    <section className="hud-card hud-clip modulo relative space-y-3 p-3">
      <h2 className="hud-label">{titulo}</h2>
      <canvas
        ref={ref}
        className="block w-full bg-[var(--surface1)]"
        style={{ aspectRatio: `${L} / ${ALTURA[formato]}`, opacity: pronto ? 1 : 0.4, transition: 'opacity 200ms' }}
        aria-label={`Prévia da arte: ${titulo}`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={baixar} disabled={!pronto} className="btn-cta">
          <span>Baixar PNG</span>
        </button>
        {podeCompartilhar && (
          <button type="button" onClick={compartilhar} disabled={!pronto} className="btn-hud">
            Compartilhar
          </button>
        )}
      </div>
    </section>
  );
}
