import { GeradorArtes } from '@/components/admin/GeradorArtes';
import { campeonatoDoAdmin } from '@/lib/campeonato/selecao';
import { assinaturaDasArtes } from '@/lib/domain/campeonato/artes';
import { montarRegulamento } from '@/lib/domain/campeonato/regulamento';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Artes — Admin Copa Jumentus' };

export default async function Artes() {
  const completo = await campeonatoDoAdmin();
  // A tela monta as artes no navegador: vai só o que elas usam (sem financeiro nem histórico).
  const c = { ...completo, financeiro: undefined, historico: undefined };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-hero t-xl text-4xl">Artes</h1>
        <p className="mt-2 text-sm text-text-2">
          Escolha a seção, ajuste o que quer gerar e baixe. Tudo sai com os dados atuais do campeonato, em feed (1080×1350) e stories
          (1080×1920). No celular, &ldquo;Compartilhar&rdquo; manda direto para o Instagram ou o WhatsApp.
        </p>
      </div>
      <GeradorArtes c={c} assinatura={assinaturaDasArtes(completo)} regulamento={montarRegulamento(completo)} />
    </div>
  );
}
