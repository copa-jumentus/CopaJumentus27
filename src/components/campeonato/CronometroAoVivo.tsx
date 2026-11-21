'use client';

// Cronômetro do jogo para o público (telão e página do jogo): roda no navegador a
// partir do relógio gravado na partida, corrigido pelo relógio do servidor.

import { useEffect, useRef, useState } from 'react';
import { lerRelogio, rotuloFase, type Relogio } from '@/lib/domain/campeonato/relogio';

export function CronometroAoVivo({
  relogio,
  duracaoMin,
  agoraServidor,
  classeNumero = 'numero text-6xl',
  classeRotulo = 'hud-label',
}: {
  relogio?: Relogio;
  duracaoMin: number;
  agoraServidor: number;
  classeNumero?: string;
  classeRotulo?: string;
}) {
  const desvio = useRef(agoraServidor - Date.now());
  const [agora, setAgora] = useState(agoraServidor);
  useEffect(() => {
    desvio.current = agoraServidor - Date.now();
  }, [agoraServidor]);
  useEffect(() => {
    const tick = () => setAgora(Date.now() + desvio.current);
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);
  const l = lerRelogio(relogio, agora, duracaoMin);
  if (l.fase === 'antes') return null;
  return (
    <div className="text-center">
      <p className={classeNumero} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {l.mostrador}
      </p>
      <p className={classeRotulo}>{rotuloFase(l)}</p>
    </div>
  );
}
