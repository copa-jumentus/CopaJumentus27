'use client';

// Confirmação em dois toques (apagar lance, fim de tempo): o primeiro toque arma
// e o botão espera o segundo (decisão do operador em 25/11/2026: "o botão apagar
// some sozinho, deve esperar alguém clicar"). Toque fora ou Esc desarma; não há
// tempo limite.

import { useEffect, useRef, useState } from 'react';

export function usarConfirmacao<T extends HTMLElement>() {
  const [armado, setArmado] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!armado) return;
    const fora = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setArmado(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setArmado(false);
    document.addEventListener('pointerdown', fora, true);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('keydown', tecla);
    };
  }, [armado]);
  return { armado, setArmado, ref };
}
