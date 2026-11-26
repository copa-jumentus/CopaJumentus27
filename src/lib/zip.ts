// Arquivo .zip sem compressão (método "store"), para baixar várias artes de uma vez
// sem dependência nova (CLAUDE.md §6). PNG já vem comprimido: compressar de novo
// quase não reduz e só gasta tempo. Puro e testado.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ArquivoZip {
  nome: string;
  dados: Uint8Array;
}

/** Monta o .zip. Nomes repetidos ganham "-2", "-3" antes da extensão. */
export function criarZip(arquivos: readonly ArquivoZip[]): Uint8Array {
  const codificar = new TextEncoder();
  const usados = new Map<string, number>();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;

  for (const a of arquivos) {
    const vezes = (usados.get(a.nome) ?? 0) + 1;
    usados.set(a.nome, vezes);
    const nome = vezes === 1 ? a.nome : a.nome.replace(/(\.[^.]*)?$/, (ext) => `-${vezes}${ext}`);
    const nomeBytes = codificar.encode(nome);
    const crc = crc32(a.dados);
    const tam = a.dados.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nome em UTF-8
    local.setUint16(8, 0, true); // store
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true); // 01/01/1980
    local.setUint32(14, crc, true);
    local.setUint32(18, tam, true);
    local.setUint32(22, tam, true);
    local.setUint16(26, nomeBytes.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nomeBytes, a.dados);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true);
    cd.setUint16(14, 0x21, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, tam, true);
    cd.setUint32(24, tam, true);
    cd.setUint16(28, nomeBytes.length, true);
    cd.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(cd.buffer), nomeBytes);

    deslocamento += 30 + nomeBytes.length + tam;
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, deslocamento, true);

  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const saida = new Uint8Array(todas.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of todas) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}
