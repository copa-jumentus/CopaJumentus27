'use client';

// Modo Mesário (pedido do operador em 21/11/2026): a tela da beira do campo.
// Cronômetro que sabe os tempos do jogo, lançamento em dois ou três toques com o
// minuto automático, e uma fila no celular: sem internet, cada toque fica
// guardado e sobe sozinho quando a conexão volta, sem duplicar (cada operação tem
// id próprio e o servidor ignora repetidas). Regras: lib/domain/campeonato/mesario.ts.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lerEstadoMesario, operarMesario } from '@/app/admin/acoes-mesario';
import { ehAcaoDesatualizada } from '@/lib/atualizacao';
import {
  comPendentes,
  completarOperacao,
  lerCronometro,
  type PedidoMesario,
  type EstadoMesario,
  type JogadorDaPartida,
  type LanceMesario,
} from '@/lib/domain/campeonato/mesario';
import { formatarMs, rotuloFase, type AcaoRelogio } from '@/lib/domain/campeonato/relogio';
import type { TipoEvento } from '@/lib/domain/campeonato/tipos';
import { gravarFila, lerFila, type ItemFila } from '@/lib/repo/fila-mesario';

export interface LadoMesario {
  sigla: string;
  nome: string;
  cor: string;
  escudo?: string;
}

export interface JogadorMesario extends JogadorDaPartida {
  numero?: number;
  goleiro: boolean;
  suspenso: boolean;
}

interface Props {
  campeonatoId: number;
  partidaId: string;
  titulo: string;
  mandante: LadoMesario;
  visitante: LadoMesario;
  jogadores: JogadorMesario[];
  /** Goleiro da partida de cada lado: só ele tem "Defesa". */
  goleiros: { mandante?: string; visitante?: string };
  mataMata: boolean;
  estadoInicial: EstadoMesario;
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

const REENVIO_MS = 4_000;
const SINCRONIA_MS = 8_000;

function novoIdOperacao(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function vibrar() {
  try {
    navigator.vibrate?.(25);
  } catch {
    // sem vibração
  }
}

type Conexao = 'online' | 'enviando' | 'offline';

export function MesarioCliente(props: Props) {
  const { campeonatoId, partidaId, mandante, visitante, jogadores, goleiros, mataMata } = props;
  const [base, setBase] = useState<EstadoMesario>(props.estadoInicial);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [conexao, setConexao] = useState<Conexao>('online');
  const [erros, setErros] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string>();
  const [agora, setAgora] = useState(() => Date.now());
  const desvio = useRef(props.estadoInicial.agoraServidor - Date.now());
  const enviando = useRef(false);
  const filaRef = useRef<ItemFila[]>([]);

  // Relógio do servidor = relógio do celular + desvio medido a cada resposta.
  const agoraServidor = useCallback(() => Date.now() + desvio.current, []);

  const receber = useCallback((estado: EstadoMesario, enviadoEm: number) => {
    // Metade da ida e volta como estimativa da latência.
    desvio.current = estado.agoraServidor - (enviadoEm + Date.now()) / 2;
    setBase(estado);
  }, []);

  const mudarFila = useCallback((itens: ItemFila[]) => {
    filaRef.current = itens;
    gravarFila(itens);
    setFila(itens);
  }, []);

  // ---- envio da fila, um por vez, na ordem dos toques ----
  const processar = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    try {
      while (filaRef.current.length > 0) {
        const item = filaRef.current[0];
        setConexao('enviando');
        const enviadoEm = Date.now();
        let resposta;
        try {
          resposta = await operarMesario(item.campeonatoId, item.op);
        } catch (e) {
          if (ehAcaoDesatualizada(e)) {
            // O site foi atualizado no meio do jogo: a fila está salva; recarregar pega as ações novas.
            window.location.reload();
            return;
          }
          setConexao('offline');
          return;
        }
        if (resposta.ok) {
          receber(resposta.estado, enviadoEm);
          setAviso(resposta.mensagem);
        } else {
          setErros((es) => [...es.slice(-3), resposta.erro]);
          if (resposta.estado) receber(resposta.estado, enviadoEm);
        }
        // Entrou ou foi recusada pela regra: sai da fila (recusa não adianta reenviar).
        mudarFila(filaRef.current.filter((x) => x.op.id !== item.op.id));
      }
      setConexao('online');
    } finally {
      enviando.current = false;
    }
  }, [mudarFila, receber]);

  useEffect(() => {
    // Fila que ficou de antes (página recarregada, celular desligou): retoma.
    const pendentes = lerFila();
    filaRef.current = pendentes;
    setFila(pendentes);
    void processar();
    const tentar = () => void processar();
    window.addEventListener('online', tentar);
    const reenvio = window.setInterval(() => {
      if (filaRef.current.length > 0) void processar();
    }, REENVIO_MS);
    return () => {
      window.removeEventListener('online', tentar);
      window.clearInterval(reenvio);
    };
  }, [processar]);

  // Outro admin lançando em outro celular: acompanha quando a fila está vazia.
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (filaRef.current.length > 0 || enviando.current) return;
      const enviadoEm = Date.now();
      try {
        const e = await lerEstadoMesario(campeonatoId, partidaId);
        if (e && filaRef.current.length === 0) receber(e, enviadoEm);
        setConexao('online');
      } catch (erro) {
        if (ehAcaoDesatualizada(erro)) window.location.reload();
        else setConexao('offline');
      }
    }, SINCRONIA_MS);
    return () => window.clearInterval(id);
  }, [campeonatoId, partidaId, receber]);

  // Cronômetro na tela.
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Tela acesa durante o jogo.
  useEffect(() => {
    let trava: { release: () => Promise<void> } | undefined;
    const pedir = async () => {
      try {
        trava = await navigator.wakeLock?.request('screen');
      } catch {
        // sem suporte ou negado
      }
    };
    void pedir();
    const voltar = () => document.visibilityState === 'visible' && void pedir();
    document.addEventListener('visibilitychange', voltar);
    return () => {
      document.removeEventListener('visibilitychange', voltar);
      void trava?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(undefined), 3500);
    return () => window.clearTimeout(id);
  }, [aviso]);

  const enfileirar = useCallback(
    (pedido: PedidoMesario) => {
      vibrar();
      const completa = completarOperacao(pedido, novoIdOperacao(), partidaId, agoraServidor());
      mudarFila([...filaRef.current, { campeonatoId, op: completa }]);
      void processar();
    },
    [agoraServidor, campeonatoId, mudarFila, partidaId, processar],
  );

  const daPartida = fila.filter((i) => i.op.partidaId === partidaId);
  const estado = useMemo(() => comPendentes(base, daPartida.map((i) => i.op), jogadores), [base, daPartida, jogadores]);
  const leitura = lerCronometro(estado, agora + desvio.current);
  const encerrada = estado.status === 'encerrada';

  const relogio = (acao: AcaoRelogio, tempo: 1 | 2) => enfileirar({ tipo: 'relogio', acao, tempo });
  const fimDoJogo = () => {
    relogio('fim', 2);
    if (mataMata && estado.golsMandante === estado.golsVisitante) {
      setErros((es) => [...es, 'Empate no mata-mata: lance os pênaltis na súmula completa e encerre o jogo por lá.']);
      return;
    }
    enfileirar({ tipo: 'status', status: 'encerrada' });
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[var(--bg)] pb-10">
      {/* Barra: jogo, conexão e saída para a súmula completa */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-hud bg-[var(--surface1)] px-3 py-2">
        <Link href={`/admin/partidas/${partidaId}`} className="btn-mini" aria-label="Voltar para a súmula completa">
          ← Súmula
        </Link>
        <p className="hud-label min-w-0 flex-1 truncate !text-[13px]">{props.titulo}</p>
        <SeloConexao conexao={conexao} naFila={daPartida.length} />
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-3 pt-3">
        {erros.length > 0 && (
          <div role="alert" className="border-l-4 border-[var(--error)] bg-[var(--surface1)] p-3 text-sm">
            {erros.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
            <button type="button" className="btn-mini mt-2" onClick={() => setErros([])}>
              Entendi
            </button>
          </div>
        )}

        {/* Placar */}
        <section className="hud-card hud-clip modulo relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-4">
          <Time lado={mandante} />
          <p className="numero text-center text-6xl leading-none" aria-label={`Placar ${estado.golsMandante} a ${estado.golsVisitante}`}>
            {estado.golsMandante}
            <span className="mx-2 text-4xl text-text-3">:</span>
            {estado.golsVisitante}
          </p>
          <Time lado={visitante} direita />
        </section>

        {/* Cronômetro */}
        <section className="hud-card relative px-4 py-4 text-center" aria-live="off">
          <p className="hud-label !text-[13px]" style={{ color: leitura.correndo ? 'var(--accent)' : undefined }}>
            {rotuloFase(leitura)}
            {leitura.acrescimoMs > 0 && leitura.fase !== 'fim' && (
              <span className="ml-2" style={{ color: 'var(--error)' }}>
                · acréscimo +{formatarMs(leitura.acrescimoMs)}
              </span>
            )}
          </p>
          <p className="numero mt-1 text-[5.5rem] leading-none tabular-nums" data-testid="cronometro">
            {leitura.fase === 'intervalo' && leitura.intervaloMs !== undefined ? formatarMs(leitura.intervaloMs) : leitura.mostrador}
          </p>
          <p className="mt-1 text-xs text-text-3">
            {leitura.fase === 'intervalo' ? 'tempo de intervalo' : `2 tempos de ${estado.duracaoMin} min`}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ControlesRelogio
              fase={leitura.fase}
              correndo={leitura.correndo}
              encerrada={encerrada}
              relogio={relogio}
              fimDoJogo={fimDoJogo}
              encerrar={() => enfileirar({ tipo: 'status', status: 'encerrada' })}
              mataMata={mataMata}
              partidaId={partidaId}
            />
          </div>
        </section>

        {/* Lançamento */}
        {encerrada ? (
          <p className="text-center text-sm text-text-2">
            Jogo encerrado. Correções e pênaltis ficam na{' '}
            <Link href={`/admin/partidas/${partidaId}`} className="underline">
              súmula completa
            </Link>
            .
          </p>
        ) : (
          <Lancador jogadores={jogadores} goleiros={goleiros} mandante={mandante} visitante={visitante} minuto={leitura.minuto} lancar={enfileirar} />
        )}

        {/* Lances */}
        <section aria-labelledby="titulo-lances">
          <h2 id="titulo-lances" className="hud-label mb-2">
            Lances
          </h2>
          {estado.lances.length === 0 ? (
            <p className="text-sm text-text-3">Nenhum lance ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {estado.lances.map((l, i) => (
                <LinhaLance
                  key={l.id}
                  lance={l}
                  sigla={l.lado === 'mandante' ? mandante.sigla : visitante.sigla}
                  emEnvio={l.pendente === true && i === estado.lances.findIndex((x) => x.pendente) && conexao === 'enviando'}
                  apagar={() => enfileirar({ tipo: 'apagar', eventoId: l.id })}
                  cancelar={() => mudarFila(filaRef.current.filter((x) => x.op.id !== l.id))}
                  bloqueado={encerrada}
                />
              ))}
            </ul>
          )}
        </section>
      </main>

      {aviso && (
        <p role="status" className="fixed inset-x-3 bottom-3 z-20 mx-auto max-w-md bg-[var(--surface2)] px-4 py-3 text-center text-sm shadow-lg">
          {aviso}
        </p>
      )}
    </div>
  );
}

function SeloConexao({ conexao, naFila }: { conexao: Conexao; naFila: number }) {
  const offline = conexao === 'offline';
  const texto = offline ? `Sem internet${naFila ? ` · ${naFila} na fila` : ''}` : conexao === 'enviando' || naFila ? `Enviando${naFila ? ` ${naFila}` : ''}…` : 'Online';
  return (
    <span role="status" data-testid="conexao" className="hud-label flex shrink-0 items-center gap-1.5 !text-[12px]" style={{ color: offline ? 'var(--error)' : undefined }}>
      <span aria-hidden="true" className="h-2.5 w-2.5" style={{ background: offline ? 'var(--error)' : 'var(--accent)' }} />
      {texto}
    </span>
  );
}

function Time({ lado, direita = false }: { lado: LadoMesario; direita?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${direita ? 'flex-row-reverse text-right' : ''}`}>
      {lado.escudo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lado.escudo} alt="" className="h-10 w-10 shrink-0 object-contain" />
      ) : (
        <span aria-hidden="true" className="h-12 w-2 shrink-0" style={{ background: lado.cor }} />
      )}
      <span className="titulo-hero t-sm truncate text-xl">{lado.sigla}</span>
    </div>
  );
}

/** Confirmação em dois toques para o que não tem volta fácil (fim de tempo). */
function BotaoConfirmar({ rotulo, confirmar, onClick, principal = false }: { rotulo: string; confirmar: string; onClick: () => void; principal?: boolean }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const id = window.setTimeout(() => setArmado(false), 3000);
    return () => window.clearTimeout(id);
  }, [armado]);
  return (
    <button
      type="button"
      className={principal || armado ? 'btn-cta' : 'btn-hud'}
      onClick={() => {
        if (armado) {
          setArmado(false);
          onClick();
        } else setArmado(true);
      }}
    >
      <span>{armado ? confirmar : rotulo}</span>
    </button>
  );
}

function ControlesRelogio({
  fase,
  correndo,
  encerrada,
  relogio,
  fimDoJogo,
  encerrar,
  mataMata,
  partidaId,
}: {
  fase: ReturnType<typeof lerCronometro>['fase'];
  correndo: boolean;
  encerrada: boolean;
  relogio: (acao: AcaoRelogio, tempo: 1 | 2) => void;
  fimDoJogo: () => void;
  encerrar: () => void;
  mataMata: boolean;
  partidaId: string;
}) {
  const Pausa = ({ tempo }: { tempo: 1 | 2 }) =>
    correndo ? (
      <button type="button" className="btn-hud" onClick={() => relogio('pausar', tempo)}>
        Pausar
      </button>
    ) : (
      <button type="button" className="btn-cta" onClick={() => relogio('retomar', tempo)}>
        <span>Retomar</span>
      </button>
    );

  if (encerrada) return <p className="text-sm text-text-2">Jogo encerrado.</p>;
  switch (fase) {
    case 'antes':
      return (
        <button type="button" className="btn-cta" onClick={() => relogio('iniciar', 1)}>
          <span>Começar 1º tempo</span>
        </button>
      );
    case 'tempo1':
      return (
        <>
          <Pausa tempo={1} />
          <BotaoConfirmar rotulo="Fim do 1º tempo" confirmar="Confirmar fim do 1º tempo" onClick={() => relogio('fim', 1)} />
        </>
      );
    case 'intervalo':
      return (
        <button type="button" className="btn-cta" onClick={() => relogio('iniciar', 2)}>
          <span>Começar 2º tempo</span>
        </button>
      );
    case 'tempo2':
      return (
        <>
          <Pausa tempo={2} />
          <BotaoConfirmar rotulo="Fim do jogo" confirmar="Confirmar fim do jogo" onClick={fimDoJogo} />
        </>
      );
    case 'fim':
      return mataMata ? (
        <Link href={`/admin/partidas/${partidaId}`} className="btn-cta">
          <span>Pênaltis e encerramento na súmula</span>
        </Link>
      ) : (
        <BotaoConfirmar rotulo="Encerrar jogo" confirmar="Confirmar encerramento" onClick={encerrar} principal />
      );
  }
}

function Lancador({
  jogadores,
  goleiros,
  mandante,
  visitante,
  minuto,
  lancar,
}: {
  jogadores: JogadorMesario[];
  goleiros: Props['goleiros'];
  mandante: LadoMesario;
  visitante: LadoMesario;
  minuto?: number;
  lancar: (pedido: PedidoMesario) => void;
}) {
  const [jogadorId, setJogadorId] = useState<string>();
  const [tipo, setTipo] = useState<TipoEvento>();
  const jogador = jogadores.find((j) => j.id === jogadorId);
  const limpar = () => {
    setJogadorId(undefined);
    setTipo(undefined);
  };
  const enviar = (t: TipoEvento, assistenciaId?: string) => {
    if (!jogador) return;
    lancar({ tipo: 'evento', evento: { tipo: t, jogadorId: jogador.id, assistenciaId, minuto } });
    limpar();
  };

  if (jogador) {
    const ehGoleiroDaPartida = goleiros[jogador.lado] === jogador.id || (!goleiros[jogador.lado] && jogador.goleiro);
    const companheiros = jogadores.filter((j) => j.lado === jogador.lado && j.id !== jogador.id);
    return (
      <section className="hud-card relative space-y-3 p-3" aria-label="Lançamento">
        <div className="flex items-center justify-between gap-2">
          <p className="titulo-hero t-sm text-xl">
            {jogador.numero !== undefined && <span className="numero mr-2 text-text-3">{jogador.numero}</span>}
            {jogador.nome}
          </p>
          <button type="button" className="btn-mini" onClick={limpar}>
            Trocar
          </button>
        </div>
        {tipo === 'gol' ? (
          <>
            <p className="hud-label">Quem deu a assistência?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button type="button" className="btn-cta col-span-2 sm:col-span-3" onClick={() => enviar('gol')}>
                <span>Sem assistência</span>
              </button>
              {companheiros.map((j) => (
                <BotaoJogador key={j.id} jogador={j} onClick={() => enviar('gol', j.id)} />
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {EVENTOS.filter((e) => e.so !== 'goleiro' || ehGoleiroDaPartida).map((e) => (
              <button
                key={e.tipo}
                type="button"
                className="btn-hud !min-h-14 justify-center text-base"
                style={e.cor ? { borderLeft: `6px solid ${e.cor}` } : undefined}
                onClick={() => (e.tipo === 'gol' ? setTipo('gol') : enviar(e.tipo))}
              >
                {e.rotulo}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-text-3">{minuto ? `Entra no minuto ${minuto}'.` : 'Cronômetro parado: o lance entra sem minuto.'}</p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-3" aria-label="Escolha o jogador">
      {(['mandante', 'visitante'] as const).map((lado) => (
        <div key={lado}>
          <p className="hud-label mb-1.5 truncate">{(lado === 'mandante' ? mandante : visitante).sigla}</p>
          <ul className="space-y-1.5">
            {jogadores
              .filter((j) => j.lado === lado)
              .map((j) => (
                <li key={j.id}>
                  <BotaoJogador jogador={j} onClick={() => setJogadorId(j.id)} />
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function BotaoJogador({ jogador, onClick }: { jogador: JogadorMesario; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn-mini flex !min-h-12 w-full items-center gap-2 text-left">
      <span className="numero w-6 shrink-0 text-center text-lg text-text-3">{jogador.numero ?? ''}</span>
      <span className="min-w-0 flex-1 truncate text-[15px]">{jogador.nome}</span>
      {jogador.goleiro && <span className="hud-label !text-[10px]">GOL</span>}
      {jogador.suspenso && (
        <span className="hud-label !text-[10px]" style={{ color: 'var(--error)' }}>
          Suspenso
        </span>
      )}
    </button>
  );
}

function LinhaLance({
  lance,
  sigla,
  emEnvio,
  apagar,
  cancelar,
  bloqueado,
}: {
  lance: LanceMesario;
  sigla: string;
  emEnvio: boolean;
  apagar: () => void;
  cancelar: () => void;
  bloqueado: boolean;
}) {
  const [armado, setArmado] = useState(false);
  return (
    <li className="flex items-center gap-2 bg-[var(--surface1)] px-3 py-2 text-sm">
      <span className="numero w-8 shrink-0 text-lg text-text-3">{lance.minuto ? `${lance.minuto}'` : ''}</span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{lance.rotulo}</span> · {lance.jogador} <span className="text-text-3">({sigla})</span>
        {lance.assistente && <span className="block text-xs text-text-3">Assistência: {lance.assistente}</span>}
      </span>
      {lance.pendente ? (
        <>
          <span className="hud-label !text-[10px]" style={{ color: 'var(--error)' }}>
            Na fila
          </span>
          {!emEnvio && (
            <button type="button" className="btn-mini" onClick={cancelar}>
              Cancelar
            </button>
          )}
        </>
      ) : (
        !bloqueado && (
          <button
            type="button"
            className="btn-mini"
            data-perigo={armado || undefined}
            onClick={() => {
              if (armado) apagar();
              else {
                setArmado(true);
                window.setTimeout(() => setArmado(false), 3000);
              }
            }}
          >
            {armado ? 'Apagar?' : 'Apagar'}
          </button>
        )
      )}
    </li>
  );
}
