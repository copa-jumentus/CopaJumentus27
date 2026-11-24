import { AutoAtualizar } from '@/components/campeonato/AutoAtualizar';
import { CronometroAoVivo } from '@/components/campeonato/CronometroAoVivo';
import { campeonatoPublico } from '@/lib/campeonato/selecao';
import { indices, lados } from '@/lib/campeonato/consultas';
import { andamento } from '@/lib/domain/campeonato/andamento';
import { estadoMesario } from '@/lib/domain/campeonato/mesario';
import { ordenarPartidas } from '@/lib/domain/campeonato/suspensoes';
import type { Campeonato, Equipe, Partida } from '@/lib/domain/campeonato/tipos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Telão — Copa Jumentus' };

// Telão do campo (Modo Mesário, 21/11/2026): TV ou notebook ao lado do campo, em
// tela cheia. Placar e cronômetro grandes, últimos lances e a sequência de jogos.
// Atualiza sozinho a cada 5 s; o cronômetro anda no navegador entre as atualizações.

function hora(p: Partida): string {
  return p.dataHora?.slice(11, 16) ?? '';
}

function Lado({ equipe, rotulo, direita = false }: { equipe?: Equipe; rotulo?: string; direita?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-3 ${direita ? '' : ''}`}>
      {equipe?.escudo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={equipe.escudo} alt="" className="h-[22vh] w-[22vh] object-contain" />
      ) : (
        <span className="h-[22vh] w-3" style={{ background: equipe?.corPrimaria ?? 'var(--surface2)' }} />
      )}
      <p className="titulo-hero t-xl max-w-full truncate text-[6vh] leading-none">{equipe?.sigla ?? rotulo ?? 'A definir'}</p>
      <p className="max-w-full truncate text-[2.4vh] text-text-2">{equipe?.nome ?? ''}</p>
    </div>
  );
}

function Destaque({ c, p, agora }: { c: Campeonato; p: Partida; agora: number }) {
  const { equipe } = indices(c);
  const l = lados(c, p, equipe);
  const aoVivo = p.status === 'ao-vivo';
  const e = estadoMesario(c, p.id, agora);
  return (
    <section className="flex flex-1 flex-col justify-center">
      <p className="hud-label mb-[3vh] text-center !text-[2.4vh]" style={{ color: aoVivo ? 'var(--error-text)' : 'var(--accent)' }}>
        {aoVivo ? 'Ao vivo' : 'Próximo jogo'}
        {p.numero !== undefined && ` · J${p.numero}`}
        {p.rotulo && ` · ${p.rotulo}`}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[4vw]">
        <Lado equipe={l.mandante} rotulo={l.rotuloMandante} />
        <div className="text-center">
          {aoVivo ? (
            <>
              <p className="numero text-[24vh] leading-none" data-testid="placar-telao">
                {p.golsMandante}
                <span className="mx-[2vw] text-[12vh] text-text-3">:</span>
                {p.golsVisitante}
              </p>
              <CronometroAoVivo
                relogio={e.relogio}
                duracaoMin={e.duracaoMin}
                agoraServidor={agora}
                classeNumero="numero text-[9vh] leading-none text-[var(--accent)]"
                classeRotulo="hud-label !text-[2.2vh]"
              />
            </>
          ) : (
            <p className="numero text-[16vh] leading-none">{hora(p) || 'x'}</p>
          )}
        </div>
        <Lado equipe={l.visitante} rotulo={l.rotuloVisitante} direita />
      </div>
      {aoVivo && e.lances.length > 0 && (
        <ul className="mx-auto mt-[4vh] w-full max-w-[80vw] space-y-[1vh]">
          {e.lances.slice(0, 4).map((lance) => (
            <li key={lance.id} className="flex items-baseline gap-[1.5vw] text-[2.6vh]">
              <span className="numero w-[5vw] shrink-0 text-right text-text-3">{lance.minuto ? `${lance.minuto}'` : ''}</span>
              <span className="font-semibold">{lance.rotulo}</span>
              <span>{lance.jogador}</span>
              <span className="text-text-3">({(lance.lado === 'mandante' ? l.mandante : l.visitante)?.sigla})</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Telao() {
  const atual = await campeonatoPublico();
  const agora = Date.now();
  if (!atual) {
    return (
      <main className="fixed inset-0 grid place-items-center bg-[var(--bg)]">
        <p className="titulo-hero text-[5vh]">Copa Jumentus</p>
      </main>
    );
  }
  const { c } = atual;
  const a = andamento(c.partidas);
  const daVez = a.aoVivo[0] ?? a.proxima;
  const { equipe } = indices(c);
  const depois = ordenarPartidas(c.partidas)
    .filter((p) => p.status === 'agendada' && p.id !== daVez?.id)
    .slice(0, 3);

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-[var(--bg)] px-[4vw] py-[4vh]" aria-label="Telão">
      <AutoAtualizar ativo segundos={5} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[30vh]"
        style={{ background: 'linear-gradient(180deg, rgba(30,8,56,0.9), rgba(122,46,110,0.35) 60%, transparent)' }}
      />
      <header className="relative flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/imagens/logo/copa-jumentus-logo.png" alt="Copa Jumentus" className="h-[10vh] w-auto" />
        <p className="hud-label !text-[2.2vh]">
          {a.encerrados} de {a.total} jogos
        </p>
      </header>

      {daVez ? (
        <Destaque c={c} p={daVez} agora={agora} />
      ) : (
        <section className="flex flex-1 items-center justify-center">
          <p className="titulo-hero t-xl text-[8vh]">{a.terminou ? 'Fim de campeonato' : 'Tabela em breve'}</p>
        </section>
      )}

      {depois.length > 0 && (
        <footer className="relative border-t-4 pt-[2vh]" style={{ borderImage: 'var(--gradient-leonida) 1' }}>
          <p className="hud-label mb-[1vh] !text-[2vh]">Na sequência</p>
          <ul className="grid grid-cols-3 gap-[2vw]">
            {depois.map((p) => {
              const l = lados(c, p, equipe);
              return (
                <li key={p.id} className="flex items-baseline gap-[1vw] text-[2.6vh]">
                  <span className="numero text-[var(--accent)]">{hora(p)}</span>
                  <span className="truncate">
                    {l.mandante?.sigla ?? l.rotuloMandante} <span className="text-text-3">x</span> {l.visitante?.sigla ?? l.rotuloVisitante}
                  </span>
                </li>
              );
            })}
          </ul>
        </footer>
      )}
    </main>
  );
}
