import type { Patrocinio } from '@/lib/domain/campeonato/financeiro';

/**
 * Espaço dos patrocinadores no Início: só cotas fechadas e marcadas para o site
 * (patrocinadoresPublicos). Master da frente da camisa em destaque; os demais em grade.
 * Logo opcional; sem logo, o nome em Anton. Nada de valores.
 */
export function Patrocinadores({ patrocinadores }: { patrocinadores: Patrocinio[] }) {
  if (patrocinadores.length === 0) return null;
  const master = patrocinadores.filter((p) => p.cota === 'Master (frente)');
  const demais = patrocinadores.filter((p) => p.cota !== 'Master (frente)');
  return (
    <section aria-labelledby="titulo-patrocinadores">
      <h3 id="titulo-patrocinadores" className="titulo-hero t-sm mb-4 text-2xl">
        Patrocinadores
      </h3>
      <div className="space-y-3">
        {master.map((p) => (
          <Cartao key={p.id} p={p} destaque />
        ))}
        {demais.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {demais.map((p) => (
              <li key={p.id}>
                <Cartao p={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Cartao({ p, destaque = false }: { p: Patrocinio; destaque?: boolean }) {
  const conteudo = (
    <>
      {p.logo ? (
        // Placa clara: a maioria dos logos é feita para fundo branco e some no marinho.
        <span className={`flex max-w-full items-center justify-center bg-[#F4F2EC] ${destaque ? 'px-10 py-5' : 'w-full px-3 py-2'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.logo} alt={p.patrocinador} className={`${destaque ? 'max-h-24' : 'max-h-12'} w-auto max-w-full object-contain`} />
        </span>
      ) : (
        <span className={`titulo-hero ${destaque ? 't-xl text-4xl' : 't-sm text-xl'} text-text-1`}>{p.patrocinador}</span>
      )}
      <span className="hud-label !text-[11px]">{destaque ? 'Patrocinador master' : p.cota}</span>
    </>
  );
  const classe = `hud-card hud-clip modulo relative flex h-full flex-col items-center justify-center gap-2 px-4 text-center ${destaque ? 'py-6' : 'py-4'}`;
  return p.link ? (
    <a href={p.link} target="_blank" rel="noopener noreferrer" className={`${classe} transition-colors hover:bg-[var(--surface2)]`}>
      {conteudo}
    </a>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}
