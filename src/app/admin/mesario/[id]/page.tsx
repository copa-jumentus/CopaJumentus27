import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MesarioCliente, type JogadorMesario, type LadoMesario } from '@/components/admin/MesarioCliente';
import { exigirAdmin } from '@/lib/auth/servidor';
import { indices, lados } from '@/lib/campeonato/consultas';
import { fundoVisivel } from '@/lib/campeonato/cores';
import { campeonatoDoAdmin } from '@/lib/campeonato/selecao';
import { estadoMesario } from '@/lib/domain/campeonato/mesario';
import { goleiroDaPartida } from '@/lib/domain/campeonato/rankings';
import { calcularSuspensoes, ordenarPartidas } from '@/lib/domain/campeonato/suspensoes';
import type { Equipe } from '@/lib/domain/campeonato/tipos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modo Mesário — Copa Jumentus' };

function lado(e: Equipe): LadoMesario {
  return { sigla: e.sigla, nome: e.nome, escudo: e.escudo, cor: fundoVisivel([e.corPrimaria, e.corSecundaria], '#0B1F3F') ?? '#D4A12A' };
}

export default async function Mesario({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  const c = await campeonatoDoAdmin();
  const p = c.partidas.find((x) => x.id === id);
  if (!p) notFound();

  const { equipe } = indices(c);
  const l = lados(c, p, equipe);
  if (!l.mandante || !l.visitante) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4">Os participantes deste jogo ainda não estão definidos: ele não pode começar.</p>
        <Link href={`/admin/partidas/${p.id}`} className="btn-hud">
          Voltar à súmula
        </Link>
      </div>
    );
  }

  const ordem = ordenarPartidas(c.partidas);
  const anteriores = ordem.slice(0, ordem.findIndex((x) => x.id === p.id));
  const situacao = calcularSuspensoes(anteriores, new Map(c.jogadores.map((j) => [j.id, j.equipeId])));
  const suspensos = new Set([...situacao.values()].filter((s) => s.suspenso).map((s) => s.jogadorId));

  const jogadores: JogadorMesario[] = c.jogadores
    .filter((j) => j.equipeId === p.mandanteId || j.equipeId === p.visitanteId)
    .map((j) => ({
      id: j.id,
      nome: j.nome,
      numero: j.numero,
      lado: j.equipeId === p.mandanteId ? ('mandante' as const) : ('visitante' as const),
      goleiro: j.posicao === 'GOL',
      suspenso: suspensos.has(j.id),
    }))
    // Goleiro primeiro, depois pela camisa e pelo nome.
    .sort((a, b) => Number(b.goleiro) - Number(a.goleiro) || (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, 'pt-BR'));

  const titulo = [p.numero !== undefined ? `J${p.numero}` : undefined, p.rotulo].filter(Boolean).join(' · ') || 'Jogo';

  return (
    <MesarioCliente
      campeonatoId={c.id}
      partidaId={p.id}
      titulo={titulo}
      mandante={lado(l.mandante)}
      visitante={lado(l.visitante)}
      jogadores={jogadores}
      goleiros={{ mandante: goleiroDaPartida(p, 'mandante', c.jogadores), visitante: goleiroDaPartida(p, 'visitante', c.jogadores) }}
      mataMata={c.fases.find((f) => f.id === p.faseId)?.tipo === 'mata-mata'}
      estadoInicial={estadoMesario(c, p.id, Date.now())}
    />
  );
}
