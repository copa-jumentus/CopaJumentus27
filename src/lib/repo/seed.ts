// DADOS DE EXEMPLO para a demonstracao a comissao.
// Os 8 nomes de time sao reais; jogadores sao PLACEHOLDER inventados
// e devem ser substituidos pelo cadastro de verdade antes de qualquer sorteio oficial.
// Ao sair da demo, estes dados viram dados/elenco.json e dados/times.json (CLAUDE.md §4.2).

import type { Estrelas, Jogador, Posicao, Time } from '@/lib/domain/tipos';

interface LinhaSeed {
  nome: string;
  apelido?: string;
  posicao: Posicao;
  estrelas: Estrelas;
}

// Ex-capitaes fixos: desde 18/11/2026 entram no pote como qualquer jogador.
// As cotas do exemplo fecham para 8 times (19/11/2026): 6★ 8, 5★ 8, 4★ 16, 3★ 8, 2★ 8, 1★ 8 (nível duplo 4★).
const VETERANOS: LinhaSeed[] = [
  { nome: 'Rodrigo Albuquerque', apelido: 'Digão', posicao: 'LIN', estrelas: 6 },
  { nome: 'Marcelo Tavares', apelido: 'Celo', posicao: 'LIN', estrelas: 5 },
  { nome: 'Fernando Quirino', apelido: 'Nando', posicao: 'LIN', estrelas: 5 },
  { nome: 'Thiago Bastos', apelido: 'Thiagão', posicao: 'LIN', estrelas: 6 },
  { nome: 'Leandro Paiva', apelido: 'Léo', posicao: 'LIN', estrelas: 6 },
  { nome: 'Gustavo Rangel', apelido: 'Guto', posicao: 'LIN', estrelas: 6 },
  { nome: 'Vinícius Sampaio', apelido: 'Vina', posicao: 'LIN', estrelas: 6 },
  { nome: 'Rafael Cordeiro', apelido: 'Rafa', posicao: 'LIN', estrelas: 6 },
];

const GOLEIROS: LinhaSeed[] = [
  { nome: 'Alexandre Bulhões', apelido: 'Xandão', posicao: 'GOL', estrelas: 5 },
  { nome: 'Júlio Peçanha', apelido: 'Juca', posicao: 'GOL', estrelas: 4 },
  { nome: 'Wagner Dantas', apelido: 'Waguinho', posicao: 'GOL', estrelas: 4 },
  { nome: 'Cláudio Bezerra', apelido: 'Cacá', posicao: 'GOL', estrelas: 3 },
  { nome: 'Emerson Vilela', apelido: 'Emerson', posicao: 'GOL', estrelas: 3 },
  { nome: 'Patrick Amorim', apelido: 'Pato', posicao: 'GOL', estrelas: 3 },
  { nome: 'Sidnei Barroso', apelido: 'Sid', posicao: 'GOL', estrelas: 2 },
  { nome: 'Henrique Vasques', apelido: 'Rique', posicao: 'GOL', estrelas: 2 },
];

const LINHA: LinhaSeed[] = [
  // 6 estrelas
  { nome: 'Douglas Maciel', apelido: 'Dodô', posicao: 'LIN', estrelas: 6 },
  { nome: 'Everton Nogueira', apelido: 'Tatu', posicao: 'LIN', estrelas: 6 },
  // 5 estrelas
  { nome: 'Bruno Capelli', apelido: 'Capa', posicao: 'LIN', estrelas: 5 },
  { nome: 'Caio Ferraz', apelido: 'Caiozinho', posicao: 'LIN', estrelas: 5 },
  { nome: 'Igor Medrado', apelido: 'Igorzinho', posicao: 'LIN', estrelas: 5 },
  { nome: 'Luan Peixoto', apelido: 'Peixe', posicao: 'LIN', estrelas: 5 },
  { nome: 'Matheus Aragão', apelido: 'Matheuzinho', posicao: 'LIN', estrelas: 5 },
  { nome: 'Otávio Brandão', apelido: 'Tavinho', posicao: 'LIN', estrelas: 5 },
  // 4 estrelas
  { nome: 'André Lustosa', apelido: 'Dedé', posicao: 'LIN', estrelas: 4 },
  { nome: 'Carlos Henrique Sá', apelido: 'Cacau', posicao: 'LIN', estrelas: 4 },
  { nome: 'Diego Furtado', apelido: 'Didi', posicao: 'LIN', estrelas: 4 },
  { nome: 'Fábio Menezes', apelido: 'Fabinho', posicao: 'LIN', estrelas: 4 },
  { nome: 'Guilherme Patriota', apelido: 'Gui', posicao: 'LIN', estrelas: 4 },
  { nome: 'Jonas Caldeira', apelido: 'Jonas', posicao: 'LIN', estrelas: 4 },
  { nome: 'Kleber Assunção', apelido: 'Kiko', posicao: 'LIN', estrelas: 4 },
  { nome: 'Murilo Tanaka', apelido: 'Japa', posicao: 'LIN', estrelas: 4 },
  // 3 estrelas
  { nome: 'Nelson Siqueira', apelido: 'Nelsinho', posicao: 'LIN', estrelas: 4 },
  { nome: 'Osvaldo Brito', apelido: 'Vadinho', posicao: 'LIN', estrelas: 4 },
  { nome: 'Pedro Ivo Carvalho', apelido: 'Pedrinho', posicao: 'LIN', estrelas: 4 },
  { nome: 'Renan Guedes', apelido: 'Renanzinho', posicao: 'LIN', estrelas: 4 },
  { nome: 'Samuel Lacerda', apelido: 'Samuca', posicao: 'LIN', estrelas: 4 },
  { nome: 'Tales Varejão', apelido: 'Talinho', posicao: 'LIN', estrelas: 4 },
  { nome: 'Ubirajara Pontes', apelido: 'Bira', posicao: 'LIN', estrelas: 4 },
  { nome: 'Válter Nunes', apelido: 'Val', posicao: 'LIN', estrelas: 4 },
  { nome: 'Wesley Portela', apelido: 'Wes', posicao: 'LIN', estrelas: 3 },
  { nome: 'Yuri Chagas', apelido: 'Yuri', posicao: 'LIN', estrelas: 3 },
  { nome: 'Zeca Moura', apelido: 'Zeca', posicao: 'LIN', estrelas: 3 },
  { nome: 'Alan Freitas', apelido: 'Alanzinho', posicao: 'LIN', estrelas: 3 },
  { nome: 'Bento Ribeiro', apelido: 'Bentinho', posicao: 'LIN', estrelas: 3 },
  { nome: 'Cícero Lopes', apelido: 'Ciço', posicao: 'LIN', estrelas: 3 },
  { nome: 'Danilo Prado', apelido: 'Dan', posicao: 'LIN', estrelas: 3 },
  { nome: 'Edson Queiroz', apelido: 'Edinho', posicao: 'LIN', estrelas: 3 },
  // 2 estrelas
  { nome: 'Adilson Ramalho', apelido: 'Dilso', posicao: 'LIN', estrelas: 2 },
  { nome: 'Breno Falcão', apelido: 'Brenão', posicao: 'LIN', estrelas: 2 },
  { nome: 'César Mourão', apelido: 'Cesinha', posicao: 'LIN', estrelas: 2 },
  { nome: 'Davi Antunes', apelido: 'Davizinho', posicao: 'LIN', estrelas: 2 },
  { nome: 'Elias Trindade', apelido: 'Lili', posicao: 'LIN', estrelas: 2 },
  { nome: 'Flávio Rezende', apelido: 'Flavinho', posicao: 'LIN', estrelas: 2 },
  { nome: 'Geraldo Pimentel', apelido: 'Geraldinho', posicao: 'LIN', estrelas: 2 },
  { nome: 'Hélio Macedo', apelido: 'Helinho', posicao: 'LIN', estrelas: 2 },
  // 1 estrela
  { nome: 'Ivan Dourado', apelido: 'Ivanzinho', posicao: 'LIN', estrelas: 1 },
  { nome: 'Joel Aparecido', apelido: 'Joelzinho', posicao: 'LIN', estrelas: 1 },
  { nome: 'Lucas Botelho', apelido: 'Luquinhas', posicao: 'LIN', estrelas: 1 },
  { nome: 'Norberto Faria', apelido: 'Beto', posicao: 'LIN', estrelas: 1 },
  { nome: 'Plínio Gusmão', apelido: 'Pliu', posicao: 'LIN', estrelas: 1 },
  { nome: 'Quirino Salles', apelido: 'Qui', posicao: 'LIN', estrelas: 1 },
  { nome: 'Rogério Teles', apelido: 'Rogerinho', posicao: 'LIN', estrelas: 1 },
  { nome: 'Sandro Viana', apelido: 'Sandrinho', posicao: 'LIN', estrelas: 1 },
];

/** Os 8 times da edicao, definidos pela comissao. */
export const NOMES_TIMES = [
  'Inter Miami',
  'LA Galaxy',
  'Atlanta United',
  'LA FC',
  'Seattle Sounders',
  'New York City FC',
  'Orlando City',
  'Houston Dynamo',
] as const;

function montar(prefixo: string, seeds: LinhaSeed[]): Jogador[] {
  return seeds.map((s, i) => ({
    id: `${prefixo}${String(i + 1).padStart(2, '0')}`,
    nome: s.nome,
    apelido: s.apelido,
    posicao: s.posicao,
    estrelas: s.estrelas,
  }));
}

export const JOGADORES_EXEMPLO: Jogador[] = [
  ...montar('c', VETERANOS),
  ...montar('g', GOLEIROS),
  ...montar('j', LINHA),
];

export const TIMES_EXEMPLO: Time[] = NOMES_TIMES.map((nome, i) => ({ id: `t${i + 1}`, nome }));
