# Imagens

Servidas pelo Next a partir de `/imagens/...`.

| Pasta | Conteúdo | Regra |
|---|---|---|
| `logo/` | Logo oficial (escudo marinho, contorno dourado, "J" com cabeça de jumento) em PNG transparente e PDF, mais as versões com brilho e neon | Não redesenhar nem distorcer a logo. Use a versão `copa-jumentus-logo.png` como base. |
| `uniformes/` | Prancha com os kits finais dos 8 times | Referência para camisas e artes; atualize se algum kit mudar. |
| `escudos/` | Escudos dos 8 times, fundo transparente, 512 px no lado maior (`Time.escudo`, fase 2) | Nome do arquivo = slug do time, ex.: `inter-miami.webp`, `lafc.webp`. |
| `escudos/selecoes/` | Escudos das seleções da edição Copa do Mundo (2026), enviados pelo operador; fundo transparente, 256 px no lado maior | `alemanha`, `argentina`, `brasil`, `espanha`, `franca`, `portugal` (`.webp`). |
| `escudos/clubes/` | Escudos dos clubes italianos da edição 2025, enviados pelo operador; fundo transparente, 256 px; Juventus na versão negativa (branca) | `fiorentina`, `inter`, `juventus`, `milan`, `napoli`, `roma` (`.webp`). |
| `patrocinadores/` | Logos dos patrocinadores, enviados pelo operador; WebP com fundo transparente | Nome do arquivo = slug do patrocinador, ex.: `em-empreendimentos.webp`. No site o logo fica sobre uma placa clara (CLAUDE.md §8.8). |
| `fundos/` | Fundos das artes geradas pelo site (Admin › Artes), só atmosfera, aprovados pelo operador em 25/11/2026 | `<peça>-feed.webp` (1080×1350) e `<peça>-stories.webp` (1080×1920); fundo de time é `time-<slug-do-escudo>-…`. Nada de texto, logo ou caixa: o código desenha por cima (CLAUDE.md §8.10). |
| `divulgacao/` | Peças fixas prontas (anúncio, premiação, sorteio, patrocínio), baixadas em Admin › Artes › Divulgação | WebP no tamanho final; trocar a arte é trocar o arquivo. |
| `artes/2027/` | Artes publicadas no Instagram (@copajumentus; até nov/2026, @c.r.jumentus), numeradas na ordem do feed (`01-teaser-feed.webp`) | WebP 1080×1350 (feed) ou 1080×1920 (stories), até ~500 KB. |

O banner da home continua em `public/banner-copa-jumentus.webp` (ver CLAUDE.md §5).
Fontes nunca entram aqui: a Pricedown não pode ser versionada (CLAUDE.md §5).
