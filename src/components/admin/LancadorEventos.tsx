'use client';

// Súmula rápida para a beira do campo: toque no jogador, toque no evento e, se for
// gol, toque em quem deu a assistência (ou "sem assistência"). Cada lançamento é
// um envio da mesma ação do servidor (adicionarEvento); nada muda na regra.

import { usarConfirmacao } from './usar-confirmacao';
import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { TipoEvento } from '@/lib/domain/campeonato/tipos';

export interface JogadorLancador {
  id: string;
  nome: string;
  numero?: number;
  goleiro: boolean;
  suspenso: boolean;
}

const EVENTOS: Array<{ tipo: TipoEvento; rotulo: string; cor?: string; so?: 'goleiro' }> = [
  { tipo: 'gol', rotulo: 'Gol' },
  { tipo: 'gol_penalti', rotulo: 'Gol de pênalti' },
  { tipo: 'amarelo', rotulo: 'Amarelo', cor: '#F2CB57' },
  { tipo: 'vermelho', rotulo: 'Vermelho', cor: '#E4002B' },
  { tipo: 'penalti_perdido', rotulo: 'Pênalti perdido' },
  { tipo: 'gol-contra', rotulo: 'Gol contra' },
  { tipo: 'defesa', rotulo: 'Defesa', so: 'goleiro' },
];

function Enviando() {
  const { pending } = useFormStatus();
  return pending ? (
    <p role="status" className="hud-label mt-3 !text-[13px] text-text-2">
      Registrando…
    </p>
  ) : null;
}

export function LancadorEventos({
  acao,
  partidaId,
  volta,
  jogadores,
  goleiroId,
}: {
  acao: (f: FormData) => Promise<void>;
  partidaId: string;
  volta: string;
  jogadores: JogadorLancador[];
  /** Goleiro registrado (ou o único do elenco): só ele tem "Defesa". */
  goleiroId?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [jogadorId, setJogadorId] = useState<string>();
  const [tipo, setTipo] = useState<TipoEvento>();
  const [assistenciaId, setAssistenciaId] = useState('');
  const [minuto, setMinuto] = useState('');

  const jogador = jogadores.find((j) => j.id === jogadorId);
  const etapa = !jogador ? 'jogador' : tipo === 'gol' ? 'assistencia' : 'evento';

  const reiniciar = () => {
    setJogadorId(undefined);
    setTipo(undefined);
    setAssistenciaId('');
    setMinuto('');
  };

  // Envia depois que o estado entra nos campos escondidos.
  const enviar = () => requestAnimationFrame(() => form.current?.requestSubmit());

  const nomeCurto = (j: JogadorLancador) => `${j.numero !== undefined ? `${j.numero} · ` : ''}${j.nome}`;

  return (
    <form
      ref={form}
      action={async (f) => {
        await acao(f);
        reiniciar();
      }}
    >
      <input type="hidden" name="volta" value={volta} />
      <input type="hidden" name="partidaId" value={partidaId} />
      <input type="hidden" name="jogadorId" value={jogadorId ?? ''} />
      <input type="hidden" name="tipo" value={tipo ?? ''} />
      <input type="hidden" name="assistenciaId" value={assistenciaId} />

      {/* Trilha: o que já foi escolhido, com volta em um toque */}
      <ol className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[13px] font-bold uppercase tracking-wider" aria-label="Lançamento">
        <li>
          <button type="button" onClick={reiniciar} className={etapa === 'jogador' ? 'text-[var(--dourado-claro)]' : 'text-text-2 underline decoration-dotted underline-offset-4'}>
            1 · Jogador
          </button>
        </li>
        <li className="text-text-3" aria-hidden="true">›</li>
        <li className={etapa === 'evento' ? 'text-[var(--dourado-claro)]' : 'text-text-3'}>2 · Evento</li>
        <li className="text-text-3" aria-hidden="true">›</li>
        <li className={etapa === 'assistencia' ? 'text-[var(--dourado-claro)]' : 'text-text-3'}>3 · Assistência</li>
      </ol>

      {etapa === 'jogador' && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {jogadores.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                onClick={() => setJogadorId(j.id)}
                className="btn-mini !min-h-[3rem] w-full !justify-start gap-2 !normal-case !tracking-normal"
                style={j.suspenso ? { borderColor: 'var(--vermelho)' } : undefined}
              >
                <span className="numero w-7 text-left text-xl text-[var(--accent)]">{j.numero ?? '·'}</span>
                <span className="min-w-0 flex-1 truncate text-left">{j.nome}</span>
                {j.goleiro && <span className="hud-label !text-[11px]">GOL</span>}
                {j.suspenso && <span className="hud-label !text-[11px] text-[var(--error-text)]">Susp.</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {etapa === 'evento' && jogador && (
        <div>
          <p className="mb-3 text-base font-semibold text-text-1">
            {nomeCurto(jogador)}
            {jogador.suspenso && <span className="ml-2 text-sm text-[var(--error-text)]">está suspenso neste jogo</span>}
          </p>
          <label className="mb-3 flex items-center gap-2 text-sm text-text-2">
            <span className="rotulo-campo !mb-0">Minuto (opcional)</span>
            <input
              name="minuto"
              type="number"
              min={0}
              inputMode="numeric"
              value={minuto}
              onChange={(e) => setMinuto(e.target.value)}
              className="campo !w-20"
            />
          </label>
          <ul className="grid grid-cols-2 gap-2">
            {EVENTOS.filter((e) => e.so !== 'goleiro' || jogador.id === goleiroId || jogador.goleiro).map((e) => (
              <li key={e.tipo}>
                <button
                  type="button"
                  onClick={() => {
                    setTipo(e.tipo);
                    if (e.tipo !== 'gol') enviar();
                  }}
                  className={`${e.tipo === 'gol' ? 'btn-cta' : 'btn-mini'} !min-h-[3rem] w-full gap-2`}
                >
                  {e.cor && <span className="inline-block h-[18px] w-[13px] rounded-[2px]" style={{ background: e.cor, transform: 'rotate(8deg)' }} aria-hidden="true" />}
                  <span>{e.rotulo}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {etapa === 'assistencia' && jogador && (
        <div>
          <p className="mb-3 text-base font-semibold text-text-1">Gol de {nomeCurto(jogador)}. Quem deu a assistência?</p>
          <input type="hidden" name="minuto" value={minuto} />
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <li className="col-span-2 sm:col-span-3">
              <button
                type="button"
                onClick={() => {
                  setAssistenciaId('');
                  enviar();
                }}
                className="btn-cta !min-h-[3rem] w-full"
              >
                <span>Sem assistência</span>
              </button>
            </li>
            {jogadores
              .filter((j) => j.id !== jogador.id)
              .map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAssistenciaId(j.id);
                      enviar();
                    }}
                    className="btn-mini !min-h-[3rem] w-full !justify-start gap-2 !normal-case !tracking-normal"
                  >
                    <span className="numero w-7 text-left text-xl text-[var(--accent)]">{j.numero ?? '·'}</span>
                    <span className="min-w-0 flex-1 truncate text-left">{j.nome}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      <Enviando />
    </form>
  );
}

/** Apagar um evento em dois toques: o primeiro arma ("Apagar?") e espera; o segundo confirma. Toque fora ou Esc cancela. */
export function BotaoRemoverEvento({ acao, partidaId, eventoId, volta }: { acao: (f: FormData) => Promise<void>; partidaId: string; eventoId: string; volta: string }) {
  const { armado, setArmado, ref } = usarConfirmacao<HTMLButtonElement>();
  return (
    <form action={acao}>
      <input type="hidden" name="volta" value={volta} />
      <input type="hidden" name="partidaId" value={partidaId} />
      <input type="hidden" name="eventoId" value={eventoId} />
      <button
        ref={ref}
        type={armado ? 'submit' : 'button'}
        onClick={() => {
          if (!armado) setArmado(true);
        }}
        className="btn-mini"
        data-perigo
        aria-label={armado ? 'Confirmar: apagar evento' : 'Apagar evento'}
        style={armado ? { borderColor: 'var(--vermelho)', background: 'var(--error-bg)' } : undefined}
      >
        {armado ? 'Apagar?' : '✕'}
      </button>
    </form>
  );
}
