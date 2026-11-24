import { GeradorArtes } from '@/components/admin/GeradorArtes';
import { campeonatoDoAdmin } from '@/lib/campeonato/selecao';
import { assinaturaDasArtes, blocosDeJogos, rankingArte } from '@/lib/domain/campeonato/artes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Artes — Admin Copa Jumentus' };

export default async function Artes() {
  const c = await campeonatoDoAdmin();
  const blocos = blocosDeJogos(c);
  // Começa na última rodada com jogo encerrado; sem nenhum, na primeira.
  const ultima = [...blocos].reverse().find((b) => b.jogos.some((j) => j.encerrado));
  const assinatura = assinaturaDasArtes(c);

  return (
    <div className="space-y-6">
      <h1 className="titulo-hero t-xl text-4xl">Artes</h1>
      <p className="text-sm text-text-2">
        Artes prontas para o Instagram, montadas com os resultados e os rankings do campeonato: escolha a rodada e o formato, confira a
        prévia e baixe o PNG (no celular, &ldquo;Compartilhar&rdquo; abre direto o Instagram ou o WhatsApp). Jogo ainda sem resultado
        aparece com o horário. A arte de cada jogo também fica pública, na página do jogo.
      </p>
      {blocos.length === 0 ? (
        <p className="text-sm text-text-3">Este campeonato ainda não tem jogos.</p>
      ) : (
        <GeradorArtes
          blocos={blocos}
          artilharia={rankingArte(c, 'artilharia')}
          assistencias={rankingArte(c, 'assistencias')}
          assinatura={assinatura}
          blocoInicial={ultima?.id}
        />
      )}
    </div>
  );
}
