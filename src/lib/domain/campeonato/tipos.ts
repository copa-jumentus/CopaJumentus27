// Tipos do campeonato (gestão simples: equipes, fases, grupos, partidas, súmula).
// Fonte: CLAUDE.md §8.

import type { Financeiro } from './financeiro';
import type { Programacao } from './programacao';
import type { Relogio } from './relogio';

import type { Posicao } from '@/lib/domain/tipos';

export interface Pontuacao {
  vitoria: number;
  empate: number;
  derrota: number;
}

/** Critérios de desempate, aplicados na ordem configurada pelo admin. */
export type Criterio = 'pontos' | 'vitorias' | 'saldo' | 'golsPro' | 'golsContra' | 'confronto' | 'cartoes';

export const CRITERIOS_PADRAO: readonly Criterio[] = [
  'pontos',
  'vitorias',
  'saldo',
  'golsPro',
  'golsContra',
  'confronto',
  'cartoes',
];

export const ROTULO_CRITERIO: Record<Criterio, string> = {
  pontos: 'Pontos',
  vitorias: 'Vitórias',
  saldo: 'Saldo de gols',
  golsPro: 'Gols marcados',
  golsContra: 'Gols sofridos (menos é melhor)',
  confronto: 'Confronto direto',
  cartoes: 'Cartões (menos vermelhos, depois menos amarelos)',
};

export interface Equipe {
  id: string;
  nome: string;
  sigla: string;
  escudo?: string;
  corPrimaria: string;
  corSecundaria: string;
  corTexto: string;
  /** Id do jogador capitão, quando vier do sorteio. */
  capitaoId?: string;
  /** T1 a T8 do modelo oficial, definido por sorteio no admin. */
  numeroTabela?: number;
}

export interface JogadorCampeonato {
  id: string;
  nome: string;
  equipeId: string;
  posicao: Posicao;
  numero?: number;
  /** Pagamento da inscrição, controlado pelos admins. */
  pago: boolean;
}

export type TipoFase = 'grupos' | 'mata-mata';

export type TipoZona = 'semifinal' | 'repescagem' | 'eliminado';

/** Faixa de posições da classificação (1 = primeiro). */
export interface Zona {
  de: number;
  ate: number;
  zona: TipoZona;
}

export interface Fase {
  id: string;
  nome: string;
  tipo: TipoFase;
  zonas?: Zona[];
  /**
   * Desempates decididos à mão pelo admin quando todos os critérios empatam:
   * cada item é a ordem final de um grupo de equipes totalmente empatadas.
   */
  desempates?: string[][];
}

export interface Grupo {
  id: string;
  faseId: string;
  nome: string;
  equipeIds: string[];
}

export type StatusPartida = 'agendada' | 'ao-vivo' | 'encerrada';

export type TipoEvento = 'gol' | 'gol-contra' | 'gol_penalti' | 'penalti_perdido' | 'amarelo' | 'vermelho' | 'defesa';

export const TIPOS_EVENTO: readonly TipoEvento[] = ['gol', 'gol_penalti', 'gol-contra', 'penalti_perdido', 'amarelo', 'vermelho', 'defesa'];

/** Eventos que somam gol no placar (gol contra soma para o adversário). */
export function ehGol(tipo: TipoEvento): boolean {
  return tipo === 'gol' || tipo === 'gol_penalti' || tipo === 'gol-contra';
}

/**
 * De onde vem um participante de partida do modelo, calculado sem gravar
 * (chaveamento.ts): número da tabela (T1–T8, sorteado), posição numa fase,
 * ou vencedor/perdedor de outra partida.
 */
export type Origem =
  | { tipo: 'tabela'; numero: number }
  | { tipo: 'posicao'; faseId: string; posicao: number }
  | { tipo: 'vencedor' | 'perdedor'; partidaNumero: number };

export interface EventoPartida {
  id: string;
  tipo: TipoEvento;
  jogadorId: string;
  /** Equipe do jogador que gerou o evento. */
  equipeId: string;
  assistenciaId?: string;
  minuto?: number;
}

export interface Partida {
  id: string;
  faseId: string;
  grupoId?: string;
  /** Ex.: "Rodada 1", "Semifinal 1", "Final". */
  rotulo?: string;
  /** Número do jogo (1 a 34 no modelo). */
  numero?: number;
  rodada?: number;
  dia?: number;
  campo?: string;
  /**
   * Participantes. Em partida com origem, são derivados (chaveamento.ts) ao
   * carregar e ficam vazios enquanto a origem não estiver decidida.
   */
  mandanteId?: string;
  visitanteId?: string;
  origemMandante?: Origem;
  origemVisitante?: Origem;
  goleiroMandanteId?: string;
  goleiroVisitanteId?: string;
  /** Data e hora local no formato do input datetime-local (AAAA-MM-DDTHH:mm). */
  dataHora?: string;
  local?: string;
  status: StatusPartida;
  golsMandante: number;
  golsVisitante: number;
  penaltisMandante?: number;
  penaltisVisitante?: number;
  eventos: EventoPartida[];
  /** Cronômetro do Modo Mesário (relogio.ts); ausente enquanto ninguém começou o jogo por ele. */
  relogio?: Relogio;
}

export type StatusCampeonato = 'rascunho' | 'inscricoes' | 'andamento' | 'encerrado';
export type ModeloCampeonato = 'copa-jumentus-8' | 'livre';

export const ROTULO_STATUS_CAMPEONATO: Record<StatusCampeonato, string> = {
  rascunho: 'Rascunho',
  inscricoes: 'Inscrições',
  andamento: 'Em andamento',
  encerrado: 'Encerrado',
};

export interface Campeonato {
  versao: 1;
  id: number;
  slug: string;
  nome: string;
  edicao?: string;
  status: StatusCampeonato;
  modelo: ModeloCampeonato;
  /** Caminho ou URL das artes da edição. */
  banner?: string;
  escudo?: string;
  duplicadoDe?: number;
  subtitulo?: string;
  inicio?: string;
  fim?: string;
  local?: string;
  pontuacao: Pontuacao;
  criterios: Criterio[];
  /** Valor da inscrição por jogador, em reais. */
  valorInscricao: number;
  equipes: Equipe[];
  jogadores: JogadorCampeonato[];
  fases: Fase[];
  grupos: Grupo[];
  partidas: Partida[];
  /** Quando o resultado do sorteio virou elenco oficial. */
  sorteioOficializadoEm?: string;
  /** Horário de início de cada dia, duração e intervalo dos jogos (modelo oficial). */
  programacao?: Programacao;
  /** Premiação individual da edição (craque, artilheiro, garçom, goleiro...), na ordem de exibição. */
  premios?: Premio[];
  /** Resultado lançado à mão de edição antiga, sem súmulas no sistema. */
  historico?: Historico;
  /** Gastos, patrocínios e entradas (financeiro.ts). Só os admins veem, exceto os patrocinadores exibidos. */
  financeiro?: Financeiro;
}

/** Linha de ranking lançada à mão (edições antigas). */
export interface LinhaRankingManual {
  jogador: string;
  equipeId?: string;
  valor: number;
}

/**
 * Edição antiga (jogada no Copa Fácil, antes do sistema): pódio e rankings vêm do
 * resultado oficial, não das súmulas. Só aparecem onde o sistema não tem o cálculo.
 */
export interface Historico {
  podio?: { primeiro?: string; segundo?: string; terceiro?: string };
  artilharia?: LinhaRankingManual[];
  assistencias?: LinhaRankingManual[];
}

/**
 * Prêmio individual. O jogador é texto (edições antigas não têm elenco cadastrado);
 * a equipe, quando informada, dá escudo e cor.
 */
export interface Premio {
  id: string;
  /** "Craque do campeonato", "Artilheiro", "Garçom", "Melhor goleiro" ou outro. */
  titulo: string;
  jogador: string;
  equipeId?: string;
  /** Número do prêmio, quando houver: "12 gols", "7 assistências". */
  detalhe?: string;
}

/** Prêmios sugeridos na tela do admin (decisão do operador: craque, artilheiro, garçom e goleiro). */
export const TITULOS_PREMIO = ['Craque do campeonato', 'Artilheiro', 'Garçom', 'Melhor goleiro'] as const;
