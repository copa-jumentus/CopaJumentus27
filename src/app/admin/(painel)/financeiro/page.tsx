import { Aviso, Numero, Secao } from '@/components/campeonato/ui';
import { campeonatoDoAdmin } from '@/lib/campeonato/selecao';
import {
  CATEGORIAS_ENTRADA,
  CATEGORIAS_GASTO,
  COTAS_PATROCINIO,
  formatarReais,
  reaisParaCampo,
  resumirFinanceiro,
  totalGasto,
  type Entrada,
  type Gasto,
  type Patrocinio,
} from '@/lib/domain/campeonato/financeiro';
import {
  iniciarFinanceiroAcao,
  removerEntradaAcao,
  removerGastoAcao,
  removerPatrocinioAcao,
  salvarEntradaAcao,
  salvarGastoAcao,
  salvarParametrosFinanceiroAcao,
  salvarPatrocinioAcao,
  usarValorPorAtletaAcao,
} from '../../acoes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Financeiro — Admin Copa Jumentus' };
const VOLTA = '/admin/financeiro';

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const c = await campeonatoDoAdmin();
  const fin = c.financeiro;

  if (!fin) {
    return (
      <div className="space-y-6">
        <h1 className="titulo-hero t-xl text-4xl">Financeiro</h1>
        <Aviso texto={erro} />
        <Secao titulo="Começar">
          <p className="mb-4 text-sm text-text-2">
            Gastos, patrocínios e outras entradas da edição, com o valor que cada atleta precisa pagar. Começa com o modelo da planilha
            Financeiro: aluguel do campo, arbitragem, troféus, fotógrafo, água, uniformes da Camizzeria (64 × R$ 78,50) e as nove cotas de
            patrocínio de 2027. Tudo pode ser editado, removido ou acrescentado depois.
          </p>
          <form action={iniciarFinanceiroAcao}>
            <input type="hidden" name="volta" value={VOLTA} />
            <button type="submit" className="btn-cta">
              <span>Começar com o modelo da planilha</span>
            </button>
          </form>
        </Secao>
      </div>
    );
  }

  const pagos = c.jogadores.filter((j) => j.pago).length;
  const recebidoAtletas = Math.round(pagos * c.valorInscricao * 100);
  const r = resumirFinanceiro(fin, c.jogadores.length, recebidoAtletas);
  const valorAtualInscricao = Math.round(c.valorInscricao * 100);

  return (
    <div className="space-y-6">
      <h1 className="titulo-hero t-xl text-4xl">Financeiro</h1>
      <Aviso texto={erro} />
      <Aviso texto={ok} tipo="ok" />

      <div className="hud-card hud-clip modulo relative grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4 [&_.numero]:text-2xl sm:[&_.numero]:text-4xl">
        <Numero valor={formatarReais(r.gastos)} rotulo="Gastos" />
        <Numero valor={formatarReais(r.patrocinioFechado)} rotulo="Patrocínio fechado" />
        <Numero valor={formatarReais(r.entradas)} rotulo="Outras entradas" />
        <Numero valor={formatarReais(r.aCobrarDosAtletas)} rotulo="A cobrar dos atletas" />
      </div>

      <Secao titulo="Valor por atleta">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="numero text-5xl text-[var(--dourado-claro)]">{r.valorPorAtleta === null ? '—' : formatarReais(r.valorPorAtleta)}</p>
            <p className="mt-1 text-sm text-text-2">
              {formatarReais(r.aCobrarDosAtletas)} divididos por {r.atletas || '?'} atletas.
              {r.faltaParaMeta !== null && fin.metaPorAtleta !== undefined && (
                <>
                  {' '}
                  {r.faltaParaMeta > 0 ? (
                    <>
                      Para chegar a <strong>{formatarReais(fin.metaPorAtleta)}</strong>, faltam{' '}
                      <strong className="text-text-1">{formatarReais(r.faltaParaMeta)}</strong> de patrocínio ou entradas.
                    </>
                  ) : (
                    <>
                      Meta de <strong>{formatarReais(fin.metaPorAtleta)}</strong> atingida.
                    </>
                  )}
                </>
              )}
            </p>
            {r.patrocinioNegociando > 0 && (
              <p className="mt-1 text-sm text-text-3">Em negociação (ainda não abatido): {formatarReais(r.patrocinioNegociando)}.</p>
            )}
          </div>
          {r.valorPorAtleta !== null && r.valorPorAtleta !== valorAtualInscricao && (
            <form action={usarValorPorAtletaAcao}>
              <input type="hidden" name="volta" value={VOLTA} />
              <button type="submit" className="btn-hud">
                Usar como valor da inscrição (hoje {formatarReais(valorAtualInscricao)})
              </button>
            </form>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--panel-stroke)] pt-4 sm:grid-cols-4 [&_.numero]:text-2xl sm:[&_.numero]:text-4xl">
          <Numero valor={formatarReais(r.recebidoAtletas)} rotulo={`Recebido de atletas (${pagos})`} />
          <Numero valor={formatarReais(r.patrocinioRecebido)} rotulo="Patrocínio recebido" />
          <Numero valor={formatarReais(r.gastosPagos)} rotulo="Gastos pagos" />
          <Numero valor={formatarReais(r.caixa)} rotulo="Caixa hoje" />
        </div>

        <form action={salvarParametrosFinanceiroAcao} className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--panel-stroke)] pt-4">
          <input type="hidden" name="volta" value={VOLTA} />
          <label>
            <span className="rotulo-campo">Atletas que dividem a conta</span>
            <input name="atletas" type="number" min={0} inputMode="numeric" defaultValue={fin.atletas ?? ''} placeholder={String(c.jogadores.length || 64)} className="campo w-40" />
          </label>
          <label>
            <span className="rotulo-campo">Meta por atleta (R$)</span>
            <input name="metaPorAtleta" inputMode="decimal" defaultValue={fin.metaPorAtleta !== undefined ? reaisParaCampo(fin.metaPorAtleta) : ''} placeholder="70,00" className="campo w-40" />
          </label>
          <button type="submit" className="btn-mini">
            Salvar
          </button>
        </form>
      </Secao>

      <Secao titulo={`Gastos · ${formatarReais(r.gastos)}`}>
        <datalist id="categorias-gasto">
          {CATEGORIAS_GASTO.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <ul className="space-y-2">
          {fin.gastos.map((g) => (
            <li key={g.id}>
              <FormGasto gasto={g} />
            </li>
          ))}
        </ul>
        <p className="hud-label mb-2 mt-5">Novo gasto</p>
        <FormGasto />
      </Secao>

      <Secao titulo={`Patrocínios · ${formatarReais(r.patrocinioFechado)} fechados`}>
        <p className="mb-3 text-sm text-text-2">
          Só patrocínio <strong>confirmado</strong> ou <strong>recebido</strong> abate do valor por atleta. Com &ldquo;Mostrar no site&rdquo;
          marcado, ele aparece no espaço dos patrocinadores do Início (logo: caminho como <code>/imagens/patrocinadores/nome.webp</code> ou
          endereço da imagem).
        </p>
        <datalist id="cotas">
          {COTAS_PATROCINIO.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <ul className="space-y-2">
          {fin.patrocinios.map((p) => (
            <li key={p.id}>
              <FormPatrocinio patrocinio={p} />
            </li>
          ))}
        </ul>
        <p className="hud-label mb-2 mt-5">Novo patrocínio</p>
        <FormPatrocinio />
      </Secao>

      <Secao titulo={`Outras entradas · ${formatarReais(r.entradas)}`}>
        <p className="mb-3 text-sm text-text-2">Dinheiro que não é inscrição nem patrocínio (rifa, doação, venda). As inscrições pagas vêm de Pagamentos.</p>
        <datalist id="categorias-entrada">
          {CATEGORIAS_ENTRADA.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <ul className="space-y-2">
          {fin.entradas.map((e) => (
            <li key={e.id}>
              <FormEntrada entrada={e} />
            </li>
          ))}
        </ul>
        {fin.entradas.length === 0 && <p className="text-sm text-text-3">Nenhuma entrada lançada.</p>}
        <p className="hud-label mb-2 mt-5">Nova entrada</p>
        <FormEntrada />
      </Secao>
    </div>
  );
}

const LINHA = 'grid grid-cols-2 items-end gap-2 bg-[var(--surface1)] p-2';

function FormGasto({ gasto }: { gasto?: Gasto }) {
  return (
    <form action={salvarGastoAcao} className={`${LINHA} sm:grid-cols-[1fr_10rem_5rem_7rem_7rem_8rem_auto_auto]`}>
      <input type="hidden" name="volta" value={VOLTA} />
      {gasto && <input type="hidden" name="itemId" value={gasto.id} />}
      <input name="descricao" required defaultValue={gasto?.descricao} placeholder="Descrição" aria-label="Descrição" className="campo col-span-2 sm:col-span-1" />
      <input name="categoria" list="categorias-gasto" defaultValue={gasto?.categoria ?? 'Outros'} aria-label="Categoria" className="campo" />
      <input name="quantidade" type="number" min={1} inputMode="numeric" defaultValue={gasto?.quantidade ?? 1} aria-label="Quantidade" className="campo" />
      <input name="valorUnitario" required inputMode="decimal" defaultValue={gasto ? reaisParaCampo(gasto.valorUnitario) : ''} placeholder="Valor un. (R$)" aria-label="Valor unitário em reais" className="campo" />
      <span className="numero self-center text-right text-lg" aria-label="Total">
        {gasto ? formatarReais(totalGasto(gasto)) : ''}
      </span>
      <select name="status" defaultValue={gasto?.status ?? 'previsto'} aria-label="Situação" className="campo">
        <option value="previsto">Previsto</option>
        <option value="pago">Pago</option>
      </select>
      <button type="submit" className="btn-mini">
        {gasto ? 'Salvar' : 'Adicionar'}
      </button>
      {gasto && (
        <button type="submit" formAction={removerGastoAcao} className="btn-mini" data-perigo>
          Remover
        </button>
      )}
    </form>
  );
}

function FormPatrocinio({ patrocinio }: { patrocinio?: Patrocinio }) {
  return (
    <form action={salvarPatrocinioAcao} className={`${LINHA} sm:grid-cols-[1fr_9rem_7rem_8rem_1fr_1fr_auto_auto_auto]`}>
      <input type="hidden" name="volta" value={VOLTA} />
      {patrocinio && <input type="hidden" name="itemId" value={patrocinio.id} />}
      <input name="patrocinador" defaultValue={patrocinio?.patrocinador} placeholder="Patrocinador" aria-label="Patrocinador" className="campo col-span-2 sm:col-span-1" />
      <input name="cota" list="cotas" defaultValue={patrocinio?.cota ?? 'Apoio'} aria-label="Cota" className="campo" />
      <input name="valor" required inputMode="decimal" defaultValue={patrocinio ? reaisParaCampo(patrocinio.valor) : ''} placeholder="Valor (R$)" aria-label="Valor da cota em reais" className="campo" />
      <select name="status" defaultValue={patrocinio?.status ?? 'negociando'} aria-label="Situação" className="campo">
        <option value="negociando">Negociando</option>
        <option value="confirmado">Confirmado</option>
        <option value="recebido">Recebido</option>
      </select>
      <input name="logo" defaultValue={patrocinio?.logo} placeholder="Logo (opcional)" aria-label="Logo" className="campo" />
      <input name="link" defaultValue={patrocinio?.link} placeholder="Site ou Instagram (opcional)" aria-label="Link" className="campo" />
      <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ touchAction: 'manipulation' }}>
        <input name="exibir" type="checkbox" defaultChecked={patrocinio?.exibir ?? true} className="h-4 w-4 accent-[var(--accent)]" />
        Mostrar no site
      </label>
      <button type="submit" className="btn-mini">
        {patrocinio ? 'Salvar' : 'Adicionar'}
      </button>
      {patrocinio && (
        <button type="submit" formAction={removerPatrocinioAcao} className="btn-mini" data-perigo>
          Remover
        </button>
      )}
    </form>
  );
}

function FormEntrada({ entrada }: { entrada?: Entrada }) {
  return (
    <form action={salvarEntradaAcao} className={`${LINHA} sm:grid-cols-[1fr_10rem_8rem_8rem_auto_auto]`}>
      <input type="hidden" name="volta" value={VOLTA} />
      {entrada && <input type="hidden" name="itemId" value={entrada.id} />}
      <input name="descricao" required defaultValue={entrada?.descricao} placeholder="Descrição" aria-label="Descrição" className="campo col-span-2 sm:col-span-1" />
      <input name="categoria" list="categorias-entrada" defaultValue={entrada?.categoria ?? 'Outros'} aria-label="Categoria" className="campo" />
      <input name="valor" required inputMode="decimal" defaultValue={entrada ? reaisParaCampo(entrada.valor) : ''} placeholder="Valor (R$)" aria-label="Valor em reais" className="campo" />
      <select name="status" defaultValue={entrada?.status ?? 'previsto'} aria-label="Situação" className="campo">
        <option value="previsto">Previsto</option>
        <option value="recebido">Recebido</option>
      </select>
      <button type="submit" className="btn-mini">
        {entrada ? 'Salvar' : 'Adicionar'}
      </button>
      {entrada && (
        <button type="submit" formAction={removerEntradaAcao} className="btn-mini" data-perigo>
          Remover
        </button>
      )}
    </form>
  );
}
