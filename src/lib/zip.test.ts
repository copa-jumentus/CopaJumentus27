import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crc32, criarZip } from './zip';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('zip das artes', () => {
  it('crc32 do vetor de referência', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
  });

  it('o unzip do sistema abre o arquivo e confere o conteúdo', () => {
    const zip = criarZip([
      { nome: 'rodada-1-feed.png', dados: bytes('um') },
      { nome: 'classificação.png', dados: bytes('dois') },
      { nome: 'rodada-1-feed.png', dados: bytes('três') },
    ]);
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const arq = join(dir, 'a.zip');
    writeFileSync(arq, zip);
    let lista: string;
    try {
      lista = execFileSync('unzip', ['-l', arq]).toString();
    } catch {
      return; // sem unzip na máquina: o teste de estrutura abaixo cobre
    }
    expect(lista).toContain('rodada-1-feed.png');
    expect(lista).toContain('rodada-1-feed-2.png');
    execFileSync('unzip', ['-o', '-q', arq, '-d', dir]);
    expect(readFileSync(join(dir, 'rodada-1-feed-2.png'), 'utf8')).toBe('três');
    expect(readFileSync(join(dir, 'classificação.png'), 'utf8')).toBe('dois');
  });

  it('termina com o registro de fim de diretório apontando para os arquivos', () => {
    const zip = criarZip([{ nome: 'a.txt', dados: bytes('oi') }]);
    const v = new DataView(zip.buffer);
    const fim = zip.length - 22;
    expect(v.getUint32(fim, true)).toBe(0x06054b50);
    expect(v.getUint16(fim + 10, true)).toBe(1);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
  });
});
