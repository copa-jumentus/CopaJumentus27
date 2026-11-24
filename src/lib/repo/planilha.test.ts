import { describe, expect, it } from 'vitest';
import { sortear } from '@/lib/domain/sorteio';
import { interpretarPlanilha, lerCsv, ORDEM_TIMES } from './planilha';

const CAB = 'ID,Nome,Apelido,Posição,Estrelas,Status,Ref';

function linha(nome: string, pos: string, est: string, status = 'Confirmado'): string {
  return `,${nome},,${pos},${est},${status},`;
}

function cadastroCompleto(): string {
  const linhas = [CAB];
  ORDEM_TIMES.forEach((t, i) => {
    // Cotas fechadas (composição idêntica, 19/11/2026): por time 6, 5, 4, 4, 3, 2, 1.
    linhas.push(linha(`Veterano ${i} ${t}`, 'MEI', '4'));
    linhas.push(linha(`Goleiro ${i}`, 'GOL', ''));
    for (let k = 0; k < 6; k++) linhas.push(linha(`Jogador ${i}-${k}`, 'ATA', String(6 - k)));
  });
  linhas.push(linha('Reserva', 'ZAG', '3', 'Lista de espera'));
  return linhas.join('\r\n');
}

describe('lerCsv', () => {
  it('respeita aspas, virgulas e aspas escapadas', () => {
    expect(lerCsv('a,"b, c","d ""e"""\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });
});

describe('interpretarPlanilha', () => {
  it('monta 64 jogadores, 8 times na ordem oficial e ignora a lista de espera', () => {
    const r = interpretarPlanilha(cadastroCompleto());
    expect(r.problemas).toEqual([]);
    expect(r.jogadores).toHaveLength(64);
    expect(r.ignorados).toBe(1);
    expect(r.times.map((t) => t.nome)).toEqual([...ORDEM_TIMES]);
    expect(r.times.every((t) => !('capitaoId' in t))).toBe(true);
  });

  it('o resultado alimenta o sorteio sem erro', () => {
    const r = interpretarPlanilha(cadastroCompleto());
    const s = sortear({ jogadores: r.jogadores, times: r.times });
    if (!s.ok) throw new Error(s.pendencias.join(' '));
    expect(s.sorteio.linha).toHaveLength(56);
    expect(s.sorteio.goleiros).toHaveLength(8);
  });

  it('goleiro sem estrelas nao e pendencia; jogador de linha sem estrelas e', () => {
    const csv = [CAB, linha('Gol', 'GOL', ''), linha('Linha', 'MEI', '')].join('\n');
    const r = interpretarPlanilha(csv);
    expect(r.jogadores.map((j) => j.nome)).toEqual(['Gol']);
    expect(r.problemas.some((p) => p.startsWith('Linha (linha 3): estrelas vazias'))).toBe(true);
  });

  it('acusa nome repetido; nao cobra posicao nem capitao (so marca goleiro)', () => {
    const csv = [CAB, linha('Ana', '', '3'), linha('Bia', 'MEI', '4'), linha('Caio', 'ATA', '4'), linha('bia', 'ZAG', '2')].join('\n');
    const r = interpretarPlanilha(csv);
    expect(r.problemas.some((p) => /posição/.test(p))).toBe(false);
    expect(r.jogadores.find((j) => j.nome === 'Ana')?.posicao).toBe('LIN');
    expect(r.jogadores.find((j) => j.nome === 'Caio')?.posicao).toBe('LIN');
    expect(r.problemas).toContain('Nome repetido: bia (linhas 3 e 5).');
    expect(r.problemas.some((p) => /capit/i.test(p))).toBe(false);
    expect(r.times).toHaveLength(8);
  });

  it('os times sao as equipes informadas, na ordem dada', () => {
    const r = interpretarPlanilha([CAB, linha('Ana', 'MEI', '3')].join('\n'), ['Roma', 'Milan', 'Roma']);
    expect(r.times.map((t) => t.nome)).toEqual(['Roma', 'Milan']);
  });

  it('coluna "Goleiro" marca o goleiro; sem coluna, todos sao de linha', () => {
    const comColuna = interpretarPlanilha(['Nome,Apelido,Goleiro,Estrelas,Status', 'Ana,,sim,,Confirmado', 'Bia,,,4,Confirmado'].join('\n'));
    expect(comColuna.problemas).toEqual([]);
    expect(comColuna.jogadores.map((j) => j.posicao)).toEqual(['GOL', 'LIN']);
    const semColuna = interpretarPlanilha(['Nome,Apelido,Estrelas,Status', 'Ana,,3,Confirmado'].join('\n'));
    expect(semColuna.jogadores[0].posicao).toBe('LIN');
  });

  it('ignora uma coluna antiga de capitao no CSV', () => {
    const csv = ['Nome,Apelido,Posição,Estrelas,Capitão do time,Status', 'Ana,,MEI,3,LAFC,Confirmado'].join('\n');
    const r = interpretarPlanilha(csv);
    expect(r.problemas).toEqual([]);
    expect(r.jogadores).toHaveLength(1);
  });

  it('acusa cabecalho incompleto', () => {
    const r = interpretarPlanilha('Nome,Posição\nAna,MEI');
    expect(r.problemas[0]).toMatch(/^Colunas ausentes/);
  });
});
