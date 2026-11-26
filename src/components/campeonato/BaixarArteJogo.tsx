'use client';

// Arte pronta do resultado de um jogo, para qualquer pessoa baixar ou compartilhar
// na página pública do jogo (pedido do operador em 24/11/2026). O desenho é o
// mesmo de Admin › Artes (components/artes/pecas.ts), feito na hora do clique.

import { useEffect, useState } from 'react';
import { arteDoJogo, type Formato } from '@/components/artes/pecas';
import type { JogoArte } from '@/lib/domain/campeonato/artes';

export function BaixarArteJogo({ jogo, assinatura }: { jogo: JogoArte; assinatura: string }) {
  const [gerando, setGerando] = useState<Formato | null>(null);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);

  useEffect(() => {
    try {
      const teste = new File([new Blob()], 'a.png', { type: 'image/png' });
      setPodeCompartilhar(typeof navigator.canShare === 'function' && navigator.canShare({ files: [teste] }));
    } catch {
      setPodeCompartilhar(false);
    }
  }, []);

  async function gerar(f: Formato, compartilhar: boolean) {
    setGerando(f);
    try {
      // As fontes do manual precisam estar prontas antes de desenhar.
      await document.fonts.ready;
      const arte = await arteDoJogo(jogo, f, assinatura);
      if (!arte) return;
      if (compartilhar) {
        try {
          await navigator.share({ files: [new File([arte.blob], arte.nome, { type: 'image/png' })] });
        } catch {
          // Cancelado: nada a fazer.
        }
        return;
      }
      const url = URL.createObjectURL(arte.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = arte.nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setGerando(null);
    }
  }

  return (
    <section className="nao-imprimir hud-card hud-clip modulo relative p-4" aria-labelledby="arte-jogo-titulo">
      <h2 id="arte-jogo-titulo" className="hud-label">
        Arte do jogo
      </h2>
      <p className="mt-1 text-sm text-text-2">Placar e lances prontos para o Instagram e o WhatsApp.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['feed', 'story'] as const).map((f) => (
          <button key={f} type="button" className={f === 'feed' ? 'btn-cta' : 'btn-hud'} disabled={gerando !== null} onClick={() => gerar(f, false)}>
            <span>{gerando === f ? 'Gerando…' : `Baixar ${f === 'feed' ? 'feed' : 'stories'}`}</span>
          </button>
        ))}
      </div>
      {podeCompartilhar && (
        <div className="mt-2 flex flex-wrap gap-2">
          {(['feed', 'story'] as const).map((f) => (
            <button key={f} type="button" className="btn-mini" disabled={gerando !== null} onClick={() => gerar(f, true)}>
              Compartilhar {f === 'feed' ? 'feed' : 'stories'}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
