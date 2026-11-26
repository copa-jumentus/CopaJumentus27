// Regulamento público (pedido do operador em 18/11/2026). Montado a partir da
// configuração do campeonato e das regras que o sistema já aplica (§8 do CLAUDE.md),
// para nunca divergir do que a tabela, a súmula e as suspensões calculam. Puro e testado.

import { normalizarProgramacao, programacaoPadrao } from './programacao';
import { DIAS_DO_MODELO } from './modelo';
import { ROTULO_CRITERIO, type Campeonato } from './tipos';

export interface SecaoRegulamento {
  titulo: string;
  itens: string[];
}

const pts = (n: number) => `${n} ${n === 1 ? 'ponto' : 'pontos'}`;
const min = (n: number) => `${n} ${n === 1 ? 'minuto' : 'minutos'}`;

export function montarRegulamento(c: Campeonato): SecaoRegulamento[] {
  const oficial = c.modelo === 'copa-jumentus-8';
  const secoes: SecaoRegulamento[] = [];

  secoes.push({
    titulo: 'Times',
    itens: [
      `${c.equipes.length} equipes, montadas por sorteio entre os inscritos, com equilíbrio por nível de cada jogador.`,
      'Cada equipe recebe 1 goleiro, sorteado à parte.',
      'O capitão é escolhido pelo próprio time depois do sorteio.',
    ],
  });

  if (oficial) {
    secoes.push({
      titulo: 'Formato',
      itens: [
        `${DIAS_DO_MODELO} dias de competição, 34 jogos, um campo, um jogo por vez.`,
        '1ª fase, Grupo Único: todos jogam contra todos uma vez (28 jogos, 7 rodadas). Rodadas 1 a 4 no dia 1 e 5 a 7 no dia 2.',
        '1º e 2º colocados vão direto para as semifinais. 3º ao 6º disputam a repescagem. 7º e 8º estão eliminados.',
        'Repescagem: 3º x 6º (J29) e 4º x 5º (J30).',
        'Semifinais: 2º x vencedor da J29 (J31) e 1º x vencedor da J30 (J32).',
        'Disputa de 3º lugar entre os perdedores das semifinais (J33) e Final entre os vencedores (J34).',
        'A ordem dos confrontos (T1 a T8) é sorteada depois que os times são montados.',
      ],
    });
  } else {
    secoes.push({
      titulo: 'Formato',
      itens: c.fases.map((f, i) => `${i + 1}ª fase, ${f.nome}: ${f.tipo === 'grupos' ? 'pontos corridos dentro de cada grupo.' : 'mata-mata, jogo único.'}`),
    });
  }

  const p = normalizarProgramacao(c.programacao) ?? programacaoPadrao(c.inicio, c.fim, DIAS_DO_MODELO);
  if (oficial) {
    secoes.push({
      titulo: 'Tempo de jogo',
      itens: [
        `Fase de grupos: 2 tempos de ${min(p.tempoGrupoMin)}.`,
        `Mata-mata: 2 tempos de ${min(p.tempoMataMataMin)}.`,
        p.intervaloTemposMin > 0 ? `Intervalo entre os tempos: até ${min(p.intervaloTemposMin)}.` : 'Sem intervalo entre os tempos.',
        `Entre um jogo e outro: ${min(p.intervaloGrupoMin)} na fase de grupos e ${min(p.intervaloMataMataMin)} no mata-mata; ${min(p.intervaloFasesMin)} ao passar de uma etapa do mata-mata para a outra.`,
        'Os horários de cada jogo estão na página Jogos e podem ser ajustados pela organização no dia.',
      ],
    });
  }

  secoes.push({
    titulo: 'Pontuação',
    itens: [`Vitória: ${pts(c.pontuacao.vitoria)}. Empate: ${pts(c.pontuacao.empate)}. Derrota: ${pts(c.pontuacao.derrota)}.`],
  });

  secoes.push({
    titulo: 'Desempate na classificação',
    itens: [
      `Na ordem: ${c.criterios.map((k, i) => `${i + 1}) ${ROTULO_CRITERIO[k]}`).join('; ')}.`,
      'Cada critério só vale entre as equipes que continuam empatadas.',
      'Confronto direto: uma tabela só com os jogos entre as equipes empatadas (pontos, depois saldo).',
      'Se o empate persistir em todos os critérios, a organização decide a ordem.',
    ],
  });

  secoes.push({
    titulo: 'Mata-mata',
    itens: ['Jogo único, sem vantagem de empate.', 'Empate no tempo normal é decidido nos pênaltis.'],
  });

  secoes.push({
    titulo: 'Cartões e suspensões',
    itens: [
      '3 cartões amarelos acumulados: o jogador cumpre suspensão no jogo seguinte da sua equipe, e a contagem recomeça.',
      'Cartão vermelho: suspensão no jogo seguinte da equipe.',
      'Dois amarelos no mesmo jogo viram vermelho: o jogador é expulso e cumpre suspensão no jogo seguinte. Esses dois amarelos não entram na contagem dos 3 acumulados.',
      'Os amarelos não zeram na passagem da fase de grupos para o mata-mata.',
    ],
  });

  return secoes;
}
