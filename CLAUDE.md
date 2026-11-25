# COPA JUMENTUS — VICE CITY

Sistema de sorteio balanceado para uma competição de futebol amadora. Sorteia **todos os jogadores entre times que começam vazios** (sem capitão fixo desde 18/11/2026), com equilíbrio por nível (estrelas), revelação jogador-por-jogador em formato de cerimônia, e um link compartilhável com o resultado final.

Este arquivo é a fonte de verdade do projeto. Ao implementar qualquer coisa, siga-o. Se uma decisão aqui estiver errada ou faltando, **pergunte antes de inventar** — não resolva ambiguidade de regra de sorteio por conta própria.

---

## 1. Contexto e papéis

| Papel | Quem | O que faz |
|---|---|---|
| **Operador** | o dono do projeto (única pessoa com acesso de escrita) | cadastra jogadores, dispara o sorteio, conduz a cerimônia na própria tela e, depois, registra o capitão que cada time escolheu |
| **Mesário** | quem anota o jogo na beira do campo (conta própria, papel `mesario`) | só o Modo Mesário: lista de jogos, cronômetro, lances e pênaltis (§4.5, §8.11) |
| **Plateia** | a galera da pelada | abre o **link de resultado** no celular depois da cerimônia e vê os elencos |

Há **contas de admin**, só para a organização (decisão do operador em 17/11/2026): cada admin entra com usuário e senha próprios e só admins editam qualquer coisa. Não há níveis entre admins. A única exceção é a **conta de mesário** (decisão do operador em 21/11/2026: "o mesário deve ter um login"): também entra com usuário e senha, mas só abre o Modo Mesário. A plateia não tem conta nem login: vê o campeonato (tabela, jogos, rankings, elencos) e nunca vê estrelas.

---

## 2. Escopo

### Fase 1 — Sorteio (escopo atual, único que deve ser implementado agora)
1. Cadastro/edição do **elenco**: cada inscrito com nome, apelido, nível em estrelas e a marca **"Goleiro"** (decisão do operador em 18/11/2026: a posição de linha ZAG/MEI/ATA saiu da inscrição). O **número da camisa** não é pedido na inscrição: é lançado depois, em Admin › Equipes, quando os times estiverem montados.
2. **Times**: são as equipes do campeonato e começam vazios. **Não há capitão fixo** (decisão do operador em 18/11/2026): depois do sorteio, cada time escolhe o seu capitão e um admin o registra em Admin › Equipes.
3. **Sorteio com composição idêntica** dos jogadores de linha entre os times (§3.3).
4. **Sorteio separado de goleiros**: segunda etapa, 1 goleiro por time.
5. **Cerimônia de revelação**: primeiro os goleiros, depois os jogadores de linha um por vez em ordem aleatória, sem estrelas na tela, controlada pelo operador. Cada revelação tem **dois botões** (decisão do operador em 18/11/2026): "Sortear jogador" roda uma roleta curta pelos nomes que ainda estão no pote da etapa e para no sorteado, mostrando só o nome; "Sortear time" passa uma roleta curta pelos times com vaga e mostra o destino, e só então o jogador entra no elenco. Depois vem o próximo. O time já está decidido pela divisão equilibrada (§3.3); o segundo botão revela, não decide.
6. **Link de resultado estático**: ao fim, gerar uma URL compartilhável que renderiza os elencos finais sem precisar de backend.

### Fase 2 — Campeonato (implementada, ver §8)
Equipes, elencos vindos do sorteio, fases e grupos editáveis, partidas com data/hora editáveis, súmula ao vivo, classificação, rankings e controle de pagamento. Pedido do operador em 17/11/2026: "só o simples do campeonato, apenas os admins editam".

Decisões do operador em 17/11/2026 que ampliaram esta fase (§8.6):
- **Vários campeonatos por instalação**, com painel de listagem, criação e **duplicação** de campeonato.
- **Histórico de edições**: cada campeonato encerrado continua consultável em `/edicoes/[slug]`.
- **Exportação/impressão limpa** de súmula, classificação e elencos (CSS de impressão; sem biblioteca de PDF).
- **Modelo oficial "Copa Jumentus · 8 times · 34 jogos"**, aplicado com um clique ao criar o campeonato. O formato livre (§8.1) continua existindo para outras edições.
- **Modo Mesário e telão** (pedido do operador em 21/11/2026, §8.11): cronômetro do jogo, lançamento na beira do campo com fila offline e telão público.
- **Financeiro e patrocinadores** (pedido do operador em 18/11/2026, base na planilha "Financeiro Copa Jumentus 2027"): gastos, patrocínios e outras entradas editáveis em Admin › Financeiro, com o valor por atleta; patrocinadores fechados aparecem no Início (§8.8).
- **Edições antigas e premiação individual** (pedido do operador em 17/11/2026: "coloque as duas últimas edições no menu"): as edições jogadas no Copa Fácil entram com pódio, artilharia, assistências e prêmios lançados à mão (§8.7).

### Fora de escopo (não construir, nem "preparar terreno" com abstração especulativa)
Contas de usuário para a plateia (só os admins têm conta, §4.5), seguidores, comentários, enquetes, mídia enviada pelo público, app mobile nativo, notificações, carteirinhas, geração de PDF por biblioteca (a impressão é pelo navegador).

---

## 3. Regras de domínio

### 3.1 Entidades

```ts
type Posicao = 'GOL' | 'LIN';   // só marca goleiro; ZAG/MEI/ATA ficam aceitos para dados antigos e contam como linha

interface Jogador {
  id: string;
  nome: string;
  apelido?: string;        // o nome que a galera usa; preferir na UI quando existir
  posicao: Posicao;
  estrelas: 1|2|3|4|5|6;   // nível de força — ver 3.2
}

interface Time {
  id: string;
  nome: string;            // nome da equipe do campeonato
  escudo?: string;         // URL/asset; opcional na fase 1
}
// Sem capitão no sorteio. O capitão é da equipe do campeonato (Equipe.capitaoId),
// escolhido pelo time depois do sorteio e registrado por um admin.
```

### 3.2 Nível em estrelas
- Escala **1 a 6 estrelas**, atribuída manualmente pelo operador. 6 = craque, 1 = perna de pau.
- Visualmente a escala usa o **Wanted System de 6 estrelas** do design system (ver §5). A escala de domínio e a escala visual são a mesma coisa de propósito — nunca converta nem reescale.
- Todo time começa com **0 estrelas**: não há capitão pré-alocado.
- As estrelas funcionam como **cotas** (decisão do operador em 19/11/2026): cada nível precisa ter um múltiplo do número de times (§3.3).
- Estrelas do **goleiro NÃO contam** no balanceamento de linha (goleiro é sorteado em etapa separada, depois).

### 3.3 Sorteio de linha com composição idêntica

Decisão do operador em 19/11/2026; substituiu a serpentina com tolerância de 2 estrelas. Todo time recebe **exatamente a mesma quantidade de jogadores de cada nível**. Com 8 times e 56 jogadores de linha: **1 de 6★, 1 de 5★, 2 de 4★, 1 de 3★, 1 de 2★, 1 de 1★** por time (25 estrelas cada).

**Cotas** (`lib/domain/cotas.ts`, `calcularCotas`, puro e testado), derivadas do cadastro (§3.6): vagas por time = jogadores de linha ÷ times; 1 vaga por nível e a sobra no `NIVEL_DUPLO` (`config.ts`, **4**; decisão do operador em 19/11/2026, antes era 3). Para esta edição: 6★ 8, 5★ 8, 4★ 16, 3★ 8, 2★ 8, 1★ 8. Total que não divide pelos times, ou nível com contagem diferente da cota, é pendência por nível ("4★: 14 de 16, faltam 2.") e **bloqueia o sorteio**.

Algoritmo (`lib/domain/sorteio.ts`):
1. Validar as cotas. Se não fecharem, **não sortear**: `sortear` devolve `{ ok: false, pendencias }`.
2. Em cada nível, embaralhar (`random.ts`) e distribuir em blocos: cada time recebe as suas vagas daquele nível, em ordem de times também embaralhada. A aleatoriedade é quem cai em qual time.
3. **Ordem de revelação aleatória** (decisão do operador em 18/11/2026): a divisão fica pronta ao clicar em Sortear, e a ordem em que a linha é revelada na cerimônia é embaralhada de novo. A plateia não vê os níveis saindo em sequência.

Invariantes (`validacao.ts`, todas com teste; valide antes de exibir qualquer resultado):
1. Todo jogador de linha é alocado a exatamente um time.
2. Elencos do mesmo tamanho.
3. Contagem por nível idêntica em todos os times (e, por isso, soma de estrelas idêntica). A mensagem de violação não cita jogadores nem níveis.

Posição de linha (ZAG/MEI/ATA) não entra no sorteio: a inscrição marca só goleiro (18/11/2026).

### 3.4 Sorteio de goleiros
- Etapa **separada**. Na cerimônia, os goleiros são revelados **primeiro**, antes da linha (decisão do operador em 18/11/2026); no cálculo continuam fora do balanceamento.
- Pote = jogadores com `posicao === 'GOL'`.
- Exatamente **1 goleiro por time**, atribuição puramente aleatória (estrelas de goleiro não entram em nenhuma conta).
- Se houver menos goleiros que times, aloque os disponíveis e marque os times restantes como **"GOLEIRO: A DEFINIR"** na UI. Não invente jogador, não reutilize goleiro.
- Se houver mais goleiros que times, os excedentes **não** voltam para o pote de linha — ficam listados à parte como reservas. Qualquer mudança nessa regra é decisão do operador.

### 3.5 Aleatoriedade
- Use `crypto.getRandomValues` como fonte, encapsulado atrás de uma função única (`shuffle` / `randomInt`) para ser testável.
- O sorteio **não precisa ser reproduzível nem verificável por seed** — foi decisão explícita priorizar balanceamento sobre auditabilidade. Não adicione sistema de seed pública sem pedido.

### 3.6 Configuração
Constantes de regra ficam num único módulo (`src/lib/config.ts`), não espalhadas:
`ESTRELAS_MIN = 1`, `ESTRELAS_MAX = 6`, `NIVEL_DUPLO = 4`. (`TOLERANCIA_ESTRELAS` e `MAX_TENTATIVAS` saíram em 19/11/2026 com a composição idêntica.)
Número de times e tamanho de elenco são **derivados do cadastro**, nunca hardcoded.

---

## 4. Arquitetura

### 4.1 Stack
- **Next.js (App Router) + TypeScript (strict) + Tailwind CSS**
- **Postgres com Drizzle ORM** (§9): Neon em produção (Vercel), PGlite (Postgres em WebAssembly, arquivo local) em desenvolvimento. Decisão do operador em 17/11/2026.
- **Contas de admin** (tabela `admin`, §9), detalhes em §4.5. `src/middleware.ts` protege `/admin`, `/sorteio` e `/cerimonia` conferindo só o cookie; cada server action e cada layout do admin passam por `exigirAdmin()`, que confere a conta no banco.
- Testes: **Vitest** — obrigatórios para a camada de domínio (§4.3).
- **Ponta a ponta: Playwright** (pedido do operador em 19/11/2026: "um script de automação que abre o site e testa todas as funcionalidades"). `e2e/publico.spec.ts` (páginas públicas, só leitura, desktop e celular) e `e2e/admin.spec.ts` (fluxo completo do admin, em ordem). `npm run e2e` sobe o `next dev` com `PGLITE_PASTA=dados/e2e-pglite` e `DATABASE_URL` vazia (`e2e/preparar.mjs` apaga o banco e cria a conta `e2e` com troca obrigatória); `npm run e2e:producao` roda só o público contra o site no ar. O fluxo do admin **nunca** roda em produção. Mudou uma tela coberta, atualize o teste na mesma mudança.

### 4.2 Camada de dados — trocável de propósito
A decisão de persistência foi **adiada**. Portanto toda leitura/escrita passa por uma interface única:

```ts
// src/lib/repo/types.ts
interface CopaRepo {
  carregarElenco(): Promise<Jogador[]>;
  salvarElenco(jogadores: Jogador[]): Promise<void>;
  carregarTimes(): Promise<Time[]>;
  salvarTimes(times: Time[]): Promise<void>;
  carregarSorteio(): Promise<Sorteio | null>;
  salvarSorteio(sorteio: Sorteio): Promise<void>;
}
```

- O resultado do sorteio continua em `localStorage` e no link (§4.4); o que vale para o campeonato é o "Oficializar" (§8.4).
- **Fonte do cadastro: tabela `inscricao` no banco, editada em Admin › Inscrições** (decisão do operador em 17/11/2026: "direto no sistema"). A planilha vira só uma importação: o admin envia o CSV da aba `INSCRITOS` na mesma tela, e quem já existe (mesmo nome, sem acento/caixa) é mantido. `src/lib/repo/inscricoes-repo.ts` faz o CRUD; `interpretarInscricoes()` em `planilha.ts` (pura, testada) valida e monta `Jogador[]`/`Time[]` com as pendências, a mesma função para o CSV e para o banco. `carregarCadastro()` lê o banco e cai no seed de exemplo se não houver nenhuma inscrição.
  - Colunas do CSV (cabeçalho, sem acento/caixa): `Nome`, `Apelido`, `Estrelas` (1–6), `Status` (só `Confirmado` entra) e, opcional, `Goleiro` (sim/x/1) — ou a antiga `Posição`, da qual só `GOL` importa (`lerGoleiro`). Sem as duas, todos são de linha. Uma coluna `Capitão do time` antiga é ignorada, e a coluna `inscricao.capitao_de` do banco ficou sem uso.
  - Os times do sorteio são as **equipes do campeonato em edição**, na ordem cadastrada (`carregarCadastro`).
  - Goleiro com `Estrelas` vazio recebe `ESTRELAS_MIN` (não conta no balanceamento, §3.2).
  - Qualquer pendência (estrelas vazias em jogador de linha, nome repetido, menos de 2 equipes, **cota de estrelas aberta**) **bloqueia** o botão de sorteio. Na tela de sorteio e na cerimônia, a cota aberta aparece só como "As cotas de estrelas ainda não fecharam. Ajuste em Admin › Inscrições.", sem citar níveis; o contador por nível (6★ 8/8 … 4★ 14/16) fica em Admin › Inscrições.
- **`dados/` está no `.gitignore`** (exceto `dados/*.example.*`): lá fica o banco local (`dados/pglite`). Mantenha `dados/inscritos.example.csv` como referência de formato do CSV.
- Nenhum componente de UI importa `localStorage`, `fs`, caminho de arquivo ou o cliente do banco direto. Tudo pelos módulos de `src/lib/repo/`.

### 4.3 Separação obrigatória

```
src/
  lib/
    config.ts          # constantes de regra
    domain/            # tipos + sorteio. PURO: sem React, sem DOM, sem IO, sem random direto
      sorteio.ts
      validacao.ts     # as invariantes de 3.3 como funções
      random.ts        # única fonte de aleatoriedade, injetável nos testes
    repo/              # persistência atrás da interface
    share/             # codificação/decodificação do link de resultado
  app/                 # rotas Next
  components/          # UI
```

A lógica de sorteio em `lib/domain` precisa ser testável sem renderizar nada. Toda invariante de §3.3 tem teste. Todo bug de sorteio corrigido ganha um teste de regressão.

### 4.4 Link de resultado estático
- O resultado é serializado e **codificado na própria URL** (JSON compacto → base64url), rota `/resultado/[payload]`.
- A página de resultado é read-only: renderiza do payload, não lê `localStorage` nem repo.
- Mantenha o payload enxuto: nomes, posições e times. **Sem estrelas** desde 19/11/2026 (payload v2); links v1 antigos ainda abrem e as estrelas deles são descartadas na leitura (`decodificarResultado`). Se a URL passar de ~2000 caracteres, avise e proponha alternativa (publicar página estática) em vez de truncar dados.

### 4.5 Contas de admin

Substituiu a senha única `ADMIN_SENHA` em 17/11/2026. Código em `src/lib/auth/` (regras, testadas) e `src/lib/repo/admins-repo.ts` (banco).
- **Senha:** hash scrypt do `node:crypto`, formato `scrypt$N$r$p$<sal base64url>$<chave base64url>` (N=16384, r=8, p=1, sal de 16 bytes, chave de 64), comparação com `timingSafeEqual`. Nova senha: mínimo 10 caracteres, diferente da atual, digitada duas vezes. Senha temporária gerada com `node:crypto` (não pelo `random.ts`, que é do sorteio).
- **Login** em `/admin/entrar` com usuário (sem diferenciar maiúsculas) e senha. Todo campo de senha (login e troca) usa `CampoSenha`, com o olhinho para mostrar o que foi digitado. 5 erros seguidos bloqueiam a conta por 15 minutos. A mensagem de erro é a mesma para usuário inexistente, conta desativada, bloqueada e senha errada, e o usuário inexistente gasta o mesmo tempo de verificação.
- **Sessão:** cookie `cj_admin` httpOnly, `secure`, `sameSite=lax`, 30 dias, com `{adminId, versao, expira}` assinado por HMAC-SHA256 com `SESSAO_SEGREDO` (32+ caracteres). O middleware só confere assinatura e validade (Web Crypto, sem banco). `exigirAdmin()` confere conta ativa e `versao_sessao` igual. Trocar ou redefinir a senha e desativar a conta incrementam `versao_sessao`, encerrando as outras sessões. Sair apaga o cookie.
- **Troca obrigatória:** com `deve_trocar_senha`, toda página do admin (painel, `/sorteio`, `/cerimonia`, via `GuardaAdmin`) fica inerte sob um pop-up que não fecha (sem X, Esc ou clique fora) e `exigirAdmin()` recusa qualquer ação no servidor até a troca.
- **Gestão:** Admin › Admins lista, cria conta (senha temporária mostrada uma vez, só na resposta da ação), redefine senha (nova temporária, troca forçada, desbloqueia) e desativa. Ninguém desativa a própria conta nem o último admin ativo. Admin › Minha conta troca a própria senha (pede a atual).
- **Primeira conta** num banco vazio: `npm run admin:criar -- <usuario> [Nome]`.
- **Papel** (`admin.papel`, `admin` | `mesario`, padrão `admin`; decisão do operador em 21/11/2026). `exigirAdmin()` só aceita `admin`; conta de mesário que cai nele é mandada para `/admin/mesario`. `exigirMesario()` aceita os dois e vale só para o Modo Mesário (`/admin/mesario`, `/admin/mesario/[id]`, `app/admin/acoes-mesario.ts`) e para a troca da própria senha. O mesário opera só no campeonato atual do site (`idDoCampeonatoDoMesario`), não escolhe campeonato, não vê súmula completa, inscrições, estrelas, financeiro, sorteio nem as contas. O login de mesário cai direto na lista de jogos. Admin › Admins escolhe o tipo ao criar a conta. "Último admin ativo" conta só papel `admin`.

---

## 5. Frontend e design

O visual segue o **Manual de Marca da Copa Jumentus 2027** ([docs/marca/manual-de-marca.md](docs/marca/manual-de-marca.md)), adaptado para tela. Decisão do operador em 17/11/2026: o site usa a mesma identidade das artes do Instagram. Ele substitui o design system `leonida-design` usado na primeira versão.

A identidade é **híbrida**: a estrutura MLS organiza a informação, Vice City dá o clima. As telas do sistema são "peças de jogo" no manual: marinho e dourado, com Vice City só como luz âmbar no topo. A cerimônia e o banner da home são "peças de evento": céu Vice City forte.

Tokens em `src/app/globals.css` (fonte única; o Tailwind só aponta para eles):
- **Cores:** fundo marinho profundo `#06122A`, superfícies marinho Jumentus `#0B1F3F` em diante, texto off-white `#F4F2EC` e cinza concreto `#C9CCD1`, acento dourado `#D4A12A`, vermelho destaque `#E4002B` só para "ao vivo", erro e eliminado. Paleta Vice City (`#1E0838` e o céu) só em atmosfera.
- **Dourado metálico** (`--gradient-leonida`, nome mantido por compatibilidade): `#9C6F14 → #F2CB57 → #D4A12A` a 45°. Exclusivo da Copa: botão principal, filetes, item ativo.
- **Fontes (Google Fonts, via `next/font`):** títulos em **Anton** (`.titulo-hero`), números e placar em **Big Shoulders Black** (a antiga Big Shoulders Display; servida localmente de `src/app/fontes/` via `next/font/local`, porque o `next/font/google` do Next 15.5 quebra o build com ela) (`.numero`, `font-numero`), rótulos em **Barlow Condensed** (`.hud-label`, `font-mono`), texto em **Barlow** (`font-sans`).
- **Forma:** módulos de transmissão retos, com canto cortado a 45° (`.hud-clip`) e filete dourado na base (`.modulo`). Botões retos com a ponta direita cortada a 45°. Nada de pílula.
- **Diagonais** (`.faixas`): grupo marinho, vermelho e dourado a 45°, subindo da esquerda para a direita, só no canto do cabeçalho de tela. Nunca atrás de título, número ou escudo.
- **Cores dos times:** vêm de `src/lib/campeonato/marcas.ts`, iguais ao manual. Nos cards de equipe, a faixa larga usa a secundária e a fina é dourada, no canto.
- **Brasão oficial** (`public/imagens/logo/copa-jumentus-logo.png`) na barra de navegação, nunca redesenhado. Escudos só dos arquivos oficiais.
- **Sem emojis na interface** (manual, "Proibido"): cartões e gol são ícones desenhados (`Cartao`, `Sumula`).
- **Sem verde e sem azul fora dos times:** confirmação (`--success`) é dourada; goleiro (`--accent-armor`) é cinza concreto. `--text4` tem no mínimo 5:1 sobre as superfícies (leitura sob sol).
- **Texto sobre cor de time:** nunca fixo em branco. `textoSobre(cor)` (`src/lib/campeonato/cores.ts`, testado) escolhe off-white ou marinho profundo pelo contraste WCAG (≥ 4,5:1 nas 16 cores do manual), e `fundoVisivel([...])` troca a cor que some no marinho (preto do LAFC, marinho do NYC) pela outra cor do time. Nome e número ficam sempre sobre marinho nos destaques (líder dos rankings: a cor do time vira barra de 6 px à esquerda).
- **Navegação** (decisão do operador em 17/11/2026: "tire" o Admin do menu): o menu público tem Início, Tabela, Jogos, Rankings, Equipes e Edições (lista geral, mesmo dentro de uma edição antiga); no celular ele vira barra inferior fixa de 6 ícones. A área dos admins é um botão "Admin" (cadeado) no canto direito da barra de cima, em todas as telas (decisão do operador em 18/11/2026; antes ficava no rodapé), e tem menu próprio, numa linha que rola no celular. Admin, sorteio, cerimônia e resultado não mostram o menu público.
- **Aba antiga após um deploy:** server action desconhecida (`UnrecognizedActionError`) no `app/error.tsx` recarrega a tela uma vez (`lib/atualizacao.ts`, testado; sem laço: no máximo uma recarga automática a cada 30 s) e `AvisoAtualizacao` mostra "O site foi atualizado. Recarregamos esta tela." em toast.
- **Retorno de ação:** confirmação vira toast (`Toast`, some em 4,5 s e tira o `?ok=` da URL); erro continua fixo na página (`Aviso`). Telas carregando mostram esqueleto (`app/loading.tsx`); página inexistente e erro inesperado têm tela própria.
- **Classificação:** posição em quadrado neutro; a zona é a faixa de 6 px à esquerda, o fundo levemente tingido e a linha tracejada de corte onde a zona muda. No celular só PTS, J e SG, sem rolagem lateral.
- **Rankings:** empatados dividem a posição (1, 1, 3).
- **Jogos** (`components/campeonato/Partidas.tsx`): lista em linhas compactas (horário, AO VIVO ou FIM à esquerda; um time por linha; placar do vencedor em dourado; pênaltis entre parênteses em vermelho), com atalhos fixos no topo para o jogo de agora e cada rodada. "Rodada N" não se repete dentro da linha.
- **Mata-mata do modelo:** chave em 3 etapas (Repescagem → Semifinais → Final e 3º lugar), em colunas no desktop e empilhada no celular, com "Vencedor → Semifinal 2" sob cada jogo. Vaga ainda aberta mostra a origem e quem ocupa a posição hoje ("3º do Grupo Único · hoje HOU", `projecaoMataMata`, só jogos encerrados).
- **Início:** andamento ("22 de 34 jogos", barra dourada, dia), o jogo ao vivo ou o próximo em destaque no palco do Matchday (escudos grandes, placar ou horário no centro, cores dos times só nas bordas), "Na sequência" e "Últimos resultados". O pódio tem forma de pódio: campeão no centro e mais alto, só ele em dourado.
- **Andamento e projeção** ficam em `lib/domain/campeonato/andamento.ts` (puro, testado).
- **Rankings no celular:** uma categoria por vez, em abas fixas no topo (`AbasRankings`); no desktop, todas na grade.
- **Modo Mesário** (`/admin/mesario/[id]`, `components/admin/MesarioCliente.tsx`) e **telão** (`/telao`): tela inteira, sem a barra do site (§8.11).
- **Súmula rápida** (`components/admin/LancadorEventos.tsx`): na beira do campo, lançar é tocar no jogador, depois no evento (Gol, Gol de pênalti, Amarelo, Vermelho, Pênalti perdido, Gol contra; Defesa só para o goleiro) e, se for gol, em quem deu a assistência ou "Sem assistência". Minuto é opcional. A confirmação vem em toast com o placar. Apagar um evento pede dois toques ("Apagar?"). A regra continua toda em `adicionarEvento`/`removerEvento`.
- **Painel do admin:** o jogo da vez (ao vivo ou próximo) em destaque com "Abrir súmula", números do campeonato e "Na sequência".
- **Cerimônia projetada:** sem a barra do site; controles discretos no canto ("Tela cheia" e "Voltar" ao sorteio). Espaço avança um passo (nome, depois time); seta esquerda volta um passo. Com `prefers-reduced-motion`, as roletas (nome e time) não rodam.

Este app é **dark-only de propósito** — a cerimônia acontece à noite.

### Wordmark: Pricedown vetorizada

Os títulos de marca ("COPA JUMENTUS" e "VICE CITY" no hero e na página de resultado) **não são texto**. São paths SVG em [Wordmark.tsx](src/components/Wordmark.tsx), extraídos das curvas da **Pricedown Black**, de Raymond Larabie (Typodermic Fonts) — a fonte real do logo do GTA.

Três regras que vêm da licença, e não são negociáveis:

1. **Nunca adicione o arquivo `.otf` ao repositório.** A Typodermic Desktop License é para uma pessoa física e proíbe colocar a fonte em servidor ou pasta compartilhada. Um repo Git é exatamente isso.
2. **Nunca sirva a Pricedown como webfont.** Isso exige uma licença de embedding, que o projeto não tem. O que a licença grátis cobre é "logos, wordmarks" e "outlined SVG" — arte fixa.
3. **Para mudar o texto de um wordmark**, gere um SVG novo a partir da fonte, numa máquina com ela instalada. Não dá para editar o texto no código.

Por isso **só títulos de marca** usam wordmark. Todo texto dinâmico — nome de jogador, nome de time, rótulo de botão — usa as fontes livres do manual (Anton, Big Shoulders Display, Barlow Condensed e Barlow).

### Key art do hero

A home usa `public/banner-copa-jumentus.webp` (2000×504), arte da comissão com skyline, ponte, palmeiras e o wordmark já compostos. Substitui o palco que antes era montado em CSS.

- A arte é **4:1** e vale a partir de `sm`. **No celular** entra `public/banner-copa-jumentus-celular.webp` (2000×800, 5:2): a mesma arte com céu e água completados (Gemini, pedido do operador em 18/11/2026), já escurecendo para o marinho embaixo. Banner próprio de edição (`campeonato.banner`, 4:1) continua com a moldura desfocada no celular.
- O `<h1>` é `sr-only`, porque o título ali é pixel, não texto.
- **Trocar a arte**: troque as duas versões (4:1 e 5:2) e atualize `width`/`height` no `next/image`.

### Imagens da marca

Ficam em `public/imagens/` (logo oficial, kits, escudos, artes), descritas em `public/imagens/README.md`. Documentação de marca, a skill do Gemini e o guia das planilhas ficam em `docs/` (índice em `docs/README.md`). A logo oficial não é redesenhada. Escudo de time (`Time.escudo`, fase 2) usa `public/imagens/escudos/<slug-do-time>.webp`.

A página de resultado **não** usa o banner: ela é consumida no celular, onde 4:1 fica pequeno demais. Lá o título é o wordmark SVG, que escala melhor em retrato.

Pontos de amarração entre domínio e design:
- **Nível do jogador → 6 estrelas.** Mesma escala do domínio, sem conversão. Estrelas **só em Admin › Inscrições**, onde são atribuídas (operador, 19/11/2026: "não deve mostrar em hipótese alguma as estrelas de cada jogador na tela de sorteio"). O pote de `/sorteio` é alfabético e nem recebe as estrelas nos dados da página; a cerimônia e o link de resultado também não mostram. Teste de renderização em `components/sem-estrelas.test.ts`.
- **Cards de jogador e de time → módulos de transmissão** (`.hud-card`), com canto cortado e filete dourado na base.
- **Botão de sortear e de revelar próximo → botão principal** dourado metálico, com a ponta cortada a 45°.
- **Cerimônia de revelação** usa as transições snappy (140–320ms, `cubic-bezier(0.16, 1, 0.3, 1)`) e o selection flash. O suspense vem do **ritmo controlado pelo operador**, não de animação lenta: cada revelação é rápida; quem controla a pausa é o clique.

### Comportamento

Regras de interação que valem em todas as telas:

1. **Retorno nasce no pointer-down**, nunca na soltura. Todo controle tem `:active`, `touch-action: manipulation` e tap-highlight do sistema desligado.
2. **Tracking é específico de tamanho.** Use `.t-xl` acima de 2,2rem e `.t-sm` abaixo de 1,5rem junto de `.titulo-hero`. Um valor único numa escala que vai de 1,1rem a 6rem está errado em alguma ponta.
3. **Painel de vidro materializa**, não aparece: a entrada anima `blur` e escala junto com opacidade.
4. **Três preferências do sistema**, não uma: `prefers-reduced-motion`, `prefers-reduced-transparency` e `prefers-contrast` têm todas tratamento próprio.

A curva mecânica fixa vale porque **nada aqui é dirigido por gesto**. Se um dia entrar superfície arrastável — card que desliza, bottom sheet, slider que se arremessa —, a curva deixa de valer e o caso passa a pedir mola com entrega de velocidade.
- **Tela de cerimônia é projetada/compartilhada** — dimensione tipografia para ser legível de longe. Prioridade visual: nome do jogador e time que recebeu. Sem estrelas e sem soma de estrelas; no fim, só a confirmação de que os times ficaram dentro da tolerância.
- **Página de resultado é consumida no celular** — mobile-first, sem scroll horizontal.

Nunca introduza visual corporativo/SaaS genérico, biblioteca de componentes com tema próprio (shadcn default, MUI, Chakra) ou paleta fora do manual de marca.

---

## 6. Convenções

- **Idioma:** domínio, UI, nomes de entidade e mensagens em **português** (`Jogador`, `Time`, `sortear`, `estrelas`). Termos técnicos de framework ficam em inglês. Comentários e commits em português.
- **TypeScript strict.** Sem `any`. Sem `as` para calar o compilador.
- Sem classes onde função pura resolve. Domínio é funcional e imutável: `sortear(entrada) → resultado`, nunca mutando a entrada.
- Nomes de arquivo: `kebab-case.ts`; componentes React em `PascalCase.tsx`.
- Erros de regra violada são **visíveis ao operador na UI**, não só no console.
- Não adicione dependência sem necessidade clara. Animação: CSS primeiro; biblioteca só se o CSS não der conta.

---

## 7. Como trabalhar neste projeto

1. **Regra de sorteio é sagrada.** Mudança em §3 é decisão do operador. Se o código divergir deste arquivo, aponte a divergência antes de "consertar" qualquer lado.
2. **Teste o domínio antes da UI.** Sorteio sem teste não está pronto.
3. **Não amplie o escopo.** Construa só o que está no §2; o resto é decisão do operador.
4. **Não especule na abstração.** A única abstração deliberada é `CopaRepo` (§4.2), porque a decisão de dados foi adiada de propósito. Fora dela, código direto.
5. **Mantenha este arquivo vivo.** Decisão nova de regra, stack ou escopo → atualize o CLAUDE.md na mesma mudança.

---

## 8. Campeonato

### 8.1 Regras de disputa (decididas pelo operador)
- **Pontuação:** vitória 3, empate 1, derrota 0 por padrão, editável em Admin › Campeonato.
- **Desempate** (`classificacao.ts`): pontos, vitórias, saldo, gols marcados, gols sofridos (menos é melhor), confronto direto, cartões. A ordem é editável (botões ↑/↓; arrastar só se o operador pedir). Cada critério só é aplicado entre as equipes que continuam empatadas.
  - **Confronto direto:** minitabela só com os jogos entre as empatadas (pontos, depois saldo); com 2 equipes é o confronto simples. Se ela separa só parte do grupo, as que seguem empatadas refazem a minitabela entre si. (A comparação par a par antiga não era transitiva.)
  - **Cartões** (último): menos vermelhos; persistindo, menos amarelos. Contam os jogos encerrados da fase.
  - **Empate em tudo:** a posição fica **empatada** e, com o grupo encerrado, o admin vê uma pendência em Fases e grupos para decidir a ordem à mão (`fase.desempates`). O sistema nunca sorteia sozinho. Com o grupo em andamento, a tabela só mostra a ordem.
- **Formato:** modelo oficial (§8.6) ou livre. No livre, o admin cria as fases na ordem; cada fase é `grupos` (pontos corridos) ou `mata-mata`.
- **Grupos (formato livre):** o admin escolhe a quantidade e sorteia aleatoriamente (via `random.ts`) ou define à mão. "Gerar jogos dos grupos" cria o todos contra todos que falta. No modelo oficial isso fica bloqueado.
- **Mata-mata:** no livre, confrontos criados à mão em Admin › Partidas. Empate decide nos pênaltis, lançados no controle da partida. Jogo eliminatório empatado **não encerra** sem placar de pênaltis com vencedor (erro visível). Pênaltis só valem e só aparecem com empate no tempo normal.
- **Datas, horários e local** de cada partida são editáveis a qualquer momento (Admin › Partidas e "Remarcar horário" na súmula). Ao remarcar um jogo numerado, "empurrar os seguintes do dia" move os jogos seguintes daquele dia que ainda não começaram pela mesma diferença (atraso ou adiantamento), sem passar da meia-noite (`remarcarPartida`).

### 8.2 Cartões e suspensão
- 3 amarelos acumulados: suspenso no jogo seguinte da equipe; a contagem zera. Os amarelos **não** zeram entre as fases (confirmado pelo operador em 17/11/2026).
- Vermelho: suspenso no jogo seguinte da equipe.
- A suspensão é cumprida quando esse jogo seguinte é encerrado. Cartões contam em jogos ao vivo e encerrados.
- Cálculo em `lib/domain/campeonato/suspensoes.ts`, derivado das súmulas; nada é gravado. "Jogo seguinte" segue o número do jogo quando todas as partidas têm número (modelo oficial: um campo, um jogo por vez); senão, data/hora.

### 8.3 Súmula e placar
- Os admins editam o resultado durante o jogo em `/admin/partidas/[id]`.
- Gol registrado na súmula soma no placar (gol contra soma para o adversário); remover o evento desconta.
- Os botões + e − ajustam gols sem autor e pênaltis.
- Eventos: `gol`, `gol_penalti` (pênalti convertido durante o jogo, soma no placar e na artilharia), `gol-contra`, `penalti_perdido`, `amarelo`, `vermelho`, `defesa` (só do goleiro registrado na partida). A disputa de pênaltis é só placar (`penaltis_mandante/visitante`).
- **Goleiro de cada lado** (`partida.goleiro_mandante_id`/`goleiro_visitante_id`), escolhido na súmula; sem registro, vale o único GOL do elenco, se houver um só.
- Classificação e rankings são calculados das partidas (`lib/domain/campeonato/`); só jogos **encerrados** entram na tabela.
- **Rankings** (com filtro por fase): artilharia, assistências, penalidades (convertidos/perdidos), goleiros (gols sofridos, média, jogos sem sofrer gol, defesas; só jogos encerrados) e cartões.

### 8.4 Dados e integração com o sorteio
- `lib/repo/campeonato-repo.ts` monta o documento `Campeonato` de um campeonato a partir das tabelas (§9), já com os participantes derivados (§8.6), e o grava inteiro numa transação, só nas linhas daquele campeonato. Toda gravação passa pela **trava** e pelas **regras de consistência** (§8.6). Banco vazio: importa `dados/campeonato.json` se existir (legado e `npm run demo`), senão parte do `campeonatoPadrao()` (8 equipes do manual de marca, fases "Fase de grupos" e "Mata-mata").
- **Campeonato em edição** (`lib/campeonato/selecao.ts`): cada admin escolhe em Admin › Campeonatos; fica num cookie do navegador. Todas as telas e ações do admin, as inscrições, o pote e a cerimônia usam esse campeonato. Sem escolha, vale o atual do site público.
- **Inscrições** são de cada campeonato (`inscricao.campeonato_id`).
- No fim da cerimônia, **"Oficializar no campeonato"** grava os elencos (goleiro e linha) nas equipes do campeonato em edição, **sem capitão**: cada time escolhe o seu e um admin registra em Admin › Equipes. É bloqueado se já houver súmula preenchida. O pagamento de quem já estava cadastrado (pelo nome) é preservado.
- **Pagamentos** (pago/pendente por jogador, valor da inscrição) só aparecem em `/admin/pagamentos`.
- **Estrelas nunca aparecem em página pública** nem na tela de sorteio (§5).

### 8.5 Rotas
- Públicas: `/`, `/classificacao`, `/jogos`, `/jogos/[id]`, `/rankings`, `/equipes`, `/regulamento`, `/telao` mostram o **campeonato atual**: o mais recente em andamento; senão em inscrições; senão o último encerrado. Rascunho nunca é público. Histórico: `/edicoes` e `/edicoes/[slug]/…` (as mesmas telas, componentes em `src/components/paginas/`). Mais `/resultado/[payload]`.
- Admin: `/admin`, `/admin/campeonatos`, `/admin/inscricoes`, `/admin/campeonato`, `/admin/fases`, `/admin/partidas`, `/admin/partidas/[id]`, `/admin/mesario/[id]`, `/admin/equipes`, `/admin/pagamentos`, `/admin/financeiro`, `/admin/artes`, `/admin/admins`, `/admin/conta`, `/sorteio`, `/cerimonia`. Login em `/admin/entrar`.

### 8.6 Modelo oficial "Copa Jumentus · 8 times · 34 jogos"
Decisão do operador em 17/11/2026. Código em `lib/domain/campeonato/modelo.ts` (tabela e aplicação) e `chaveamento.ts` (participantes, trava e consistência), puro e testado.
- **Criar:** Admin › Campeonatos cria o campeonato com as 8 equipes do manual e, no modelo, já com os 34 jogos. "Aplicar modelo oficial" (Admin › Campeonato) faz o mesmo num campeonato sem partidas. Nasce em rascunho.
- **1ª fase — Grupo Único:** 28 jogos, 7 rodadas, turno único, um campo, um jogo por vez; rodadas 1–4 no dia 1 e 5–7 no dia 2. A ordem (`TABELA_GRUPO_UNICO`) mantém os confrontos e o mando de Berger enviados pelo operador em cada rodada, reordenados dentro da rodada para dar **isonomia de descanso** (decisão do operador em 17/11/2026): no mesmo dia, todo time descansa **pelo menos 2 jogos** entre uma partida e outra (nunca joga duas seguidas), ninguém tem mais de 2 descansos curtos (de 2 jogos) e a maior espera é de 5 jogos. É a mais equilibrada entre as 8.192 ordens que garantem esse mínimo (testado). A ordem literal do texto do operador fazia um time jogar duas seguidas na virada de cada rodada; não volte a ela. Zonas: 1º–2º semifinal, 3º–6º repescagem, 7º–8º eliminados (`fase.zonas`).
- **T1 a T8** são sorteados (`random.ts`) num botão em Admin › Partidas, depois de oficializar os elencos, e gravados em `equipe.numero_tabela`. Refazer é permitido enquanto nenhuma partida tiver começado.
- **Mata-mata (dia 2):** J29 Repescagem 1 (3º x 6º), J30 Repescagem 2 (4º x 5º), J31 Semifinal 1 (2º x vencedor J29), J32 Semifinal 2 (1º x vencedor J30) — nessa ordem os dois vencedores da repescagem descansam o mesmo tempo (aprovado pela comissão em 18/11/2026; antes a J31 era 1º x vencedor J30), J33 3º lugar (perdedores de J31 e J32), J34 Final (vencedores de J31 e J32). Sem vantagem de empate: empate no tempo normal vai para os pênaltis.
- **Participantes derivados, nunca gravados** (`resolverChaveamento`, como as suspensões): cada partida do modelo tem `origem_mandante`/`origem_visitante` (`{tipo:'tabela',numero}` | `{tipo:'posicao',faseId,posicao}` | `{tipo:'vencedor'|'perdedor',partidaNumero}`); `mandante_id`/`visitante_id` ficam vazios no banco. Origem por posição só resolve com todos os jogos da fase encerrados e sem empate pendente na posição; vencedor/perdedor, com o jogo de origem encerrado. Sem participante, a tela mostra a origem ("3º do Grupo Único", "Vencedor J30") e o jogo não pode começar.
- **Trava:** nenhuma mudança (correção de placar, súmula, T1–T8, desempate manual) pode alterar os participantes de uma partida já iniciada, com súmula ou com goleiro registrado; a mensagem diz qual jogo seria afetado. Antes disso, corrigir um resultado recalcula o chaveamento sozinho.
- **Pódio:** J34 (1º e 2º) e J33 (3º), mostrado no Início quando a final encerra.
- **Horários** (decisão do operador em 17/11/2026: "tem que ter horário"; grade aprovada pela comissão em 18/11/2026; `lib/domain/campeonato/programacao.ts`, puro e testado): a programação (`campeonato.programacao`) tem a data e o horário do primeiro jogo de cada um dos 2 dias e, à parte, os tempos e intervalos: **grupos 2 × 8 min, mata-mata 2 × 10 min, até 2 min entre os tempos, 3 min entre jogos (grupos e mesma etapa do mata-mata) e 10 min ao trocar de etapa** (grupos → repescagem → semifinais → finais; etapas em `ETAPAS_MATA_MATA`, `modelo.ts`). Um campo, um jogo por vez: cada jogo começa quando o anterior termina, mais o intervalo. Padrão: **16:00 nos dois dias** (para fugir do sol); com isso o dia 1 vai até 21:33 e a final começa às 22:38 e termina às 23:00 (teste "grade da comissão"). Com o período do campeonato preenchido, os 34 jogos já nascem com horário. Admin › Partidas › Programação regrava tudo; jogo já começado mantém o horário que tem (sem horário, recebe o da vez). Programação gravada no formato antigo (`duracaoMin`/`intervaloMin`) é convertida na leitura (`normalizarProgramacao`). Duplicar copia horários e tempos, não as datas.
- **Limite conhecido:** o descanso mínimo de 2 jogos vale dentro de cada dia do Grupo Único; do jogo 28 para o 29 o mesmo time pode jogar em seguida (depende da classificação).

### 8.7 Edições antigas e premiação individual
- **Premiação individual** (`campeonato.premios`, `Premio`): título livre (sugestões: Craque do campeonato, Artilheiro, Garçom, Melhor goleiro), jogador em texto (edição antiga não tem elenco), equipe opcional e número ("5 gols"). Editada em Admin › Campeonato, na ordem de exibição; aparece no Início (depois do pódio) e no topo dos Rankings. O primeiro prêmio leva o dourado. Duplicar não copia.
- **Edição antiga** (`campeonato.historico`, `Historico`): pódio (equipes) e artilharia/assistências oficiais, lançados em Admin › Campeonato › Edição antiga, uma linha por jogador no formato `Nome; Equipe; número` (`lerRankingManual`, puro e testado; casa a equipe pelo nome ou sigla, sem acento/caixa, e aponta a linha com erro). O pódio lançado só aparece se o modelo não der pódio pelas súmulas; os rankings lançados só aparecem se as súmulas não tiverem gols/assistências (e sem filtro de fase). Duplicar não copia.
- As duas edições do Copa Fácil foram inseridas uma vez no Neon por SQL (status encerrado, formato livre, sem jogos): **Copa Jumentus 2025** (clubes italianos; Roma campeã) e **Copa Jumentus 2026 · Copa do Mundo** (Espanha campeã; prêmios do post de 24/05 no @c.r.jumentus). Escudos em `public/imagens/escudos/selecoes/` e `public/imagens/escudos/clubes/` (enviados pelo operador; a Juventus vai na versão negativa branca, porque o preto some no marinho). Os jogos dessas edições não entram no site (decisão do operador em 18/11/2026: "só os resultados"): Tabela e Jogos mostram `AvisoEdicaoSemJogos` em vez de "a tabela ainda não saiu" (`edicaoSemJogos`: encerrado e sem partidas). As cores foram tiradas das camisas oficiais.

### 8.8 Financeiro e patrocinadores
Pedido do operador em 18/11/2026. Domínio em `lib/domain/campeonato/financeiro.ts` (puro, testado), gravado em `campeonato.financeiro` (jsonb). Valores sempre em **centavos**.
- **Admin › Financeiro** começa com o modelo da planilha (`financeiroPadrao`): aluguel do campo, arbitragem, troféus, fotógrafo, água (zerados), uniformes Camizzeria 64 × R$ 78,50 e as 5 cotas da camisa (Master frente, Mangas, Costas 1 e 2, Shorts) "A definir". Tudo editável, removível e acrescentável: **gastos** (descrição, categoria, quantidade × valor, previsto/pago), **patrocínios** (patrocinador, cota, valor, negociando/confirmado/recebido, logo, link, mostrar no site) e **outras entradas** (rifa, doação, venda; previsto/recebido).
- **Resumo** (`resumirFinanceiro`): a cobrar dos atletas = gastos − patrocínio fechado (confirmado ou recebido) − outras entradas; valor por atleta arredonda para cima no centavo; "falta para a meta" usa a meta por atleta (padrão R$ 70). Caixa = inscrições pagas (Pagamentos) + patrocínio e entradas recebidos − gastos pagos. Um botão copia o valor por atleta para o valor da inscrição.
- **Site:** o Início mostra "Patrocinadores" só com cotas fechadas, marcadas para o site e com nome (`patrocinadoresPublicos`), master em destaque; nunca valores. `campeonatoPublico()` tira o financeiro do campeonato antes de entregar às páginas públicas.
- Duplicar não copia o financeiro.

### 8.9 Regulamento e prévia do link
Pedido do operador em 18/11/2026.
- **`/regulamento`** (link no rodapé e no Início) é montado por `montarRegulamento(c)` (`lib/domain/campeonato/regulamento.ts`, puro e testado) a partir da configuração do campeonato atual: times, formato (modelo oficial ou fases do livre), tempos da programação, pontuação, ordem de desempate, mata-mata e cartões. Não é texto solto: mudar a pontuação, os critérios ou os tempos no admin muda o regulamento. Regra nova que não esteja no sistema entra aqui só por decisão do operador.
- **Prévia no WhatsApp/redes:** `app/opengraph-image.jpg` (1200×630, banner do celular com o brasão na faixa de baixo) e Open Graph no `layout.tsx`, com `metadataBase` no domínio de produção.

### 8.10 Artes do Instagram
Pedido do operador em 19/11/2026: "o botão de gerar a arte já pronta, pra feed e story".
- **Admin › Artes** gera as artes do campeonato em edição, em **feed 1080×1350** e **stories 1080×1920**: resultados de uma rodada (ou etapa do mata-mata: Repescagem, Semifinais, Finais), **artilharia** e **garçons** (assistências), top 8 com empatados dividindo a posição. Sem faixa de estatísticas (jogos, gols, média): o operador pediu para tirar.
- Dados em `lib/domain/campeonato/artes.ts` (`blocosDeJogos`, `rankingArte`, puro e testado): placar do vencedor em dourado, pênaltis só no mata-mata empatado, jogo sem resultado com o horário, vaga aberta com a origem, cor do time por `fundoVisivel`.
- **Arte de cada jogo** (pedido do operador em 24/11/2026): "Fim de jogo" (ou "Parcial" ao vivo), escudos e placar grandes, pênaltis no mata-mata e os lances de cada lado em ordem de minuto (gol com assistência, gol de pênalti "(PÊN.)", gol contra "(CONTRA)" do lado de quem ganhou o gol, amarelo e vermelho; ícones desenhados). Em Admin › Artes, um cartão por jogo da rodada escolhida que já começou; e **pública**, no fim da página de cada jogo (`BaixarArteJogo`: "Baixar feed", "Baixar stories" e, no celular, "Compartilhar"). Dados em `jogoArte` (`lances`, `rotulo`, `fase`, `quando`).
- **Estilo Vice City / pôr do sol** (decisão do operador em 25/11/2026, a partir de referências do GTA VI; exceção ao manual, que reserva o dourado e usa o céu só como atmosfera): céu em degradê violeta `#3B146B` → roxo `#7B208F` → magenta `#C9349B` → rosa `#F36A78` → laranja `#FF9B55` → amarelo `#FFB458`, nuvens finas, palmeiras em silhueta violeta `#2A0A45` (copas entrando pelos cantos e troncos nas bordas) e, só no stories, abaixo da área segura, sol no horizonte, skyline e água com reflexo. Blocos em violeta escuro quase opaco; destaques (palavra do título, placar do vencedor, minutos) em amarelo quente; filetes em degradê amarelo → coral; rodapé em violeta escuro sobre o céu claro. Tudo desenhado no canvas (`cenaViceCity`, `palmeira`, `copa`), sem imagem de terceiros: nada de logo, personagem ou arte da Rockstar. Brasão da Copa e escudos oficiais continuam. Vale só para as artes; o site segue o manual.
- Desenho em `components/artes/desenho.ts` (usado por `components/admin/GeradorArtes.tsx` e pela página pública do jogo), **canvas 2D no navegador** (sem dependência), na grade do manual (margens 80, cabeçalho com brasão e rótulo, rodapé com filete dourado e @C.R.JUMENTUS; no stories, nada antes de y 250 nem depois de y 1580), com as fontes do site (`--font-*`) e os escudos oficiais. "Baixar PNG" e, no celular, "Compartilhar" (Web Share com arquivo).


### 8.11 Modo Mesário e telão
Pedido do operador em 21/11/2026 ("faça a de modo mesário"), para o dia do jogo: um campo, internet de celular.
- **Regras da súmula no domínio** (`lib/domain/campeonato/sumula.ts`, testado): `lancarEvento`, `apagarEvento`, `comandarRelogio`, `duracaoDoTempo`. A súmula completa (`adicionarEvento`/`removerEvento` em `acoes.ts`) e o mesário usam as mesmas funções. Lançar em jogo encerrado é recusado (correção fica na súmula completa). Erro de regra é `ErroDoJogo`.
- **Cronômetro** (`relogio.ts`, testado), gravado em `partida.relogio` (jsonb): fases antes → 1º tempo → intervalo → 2º tempo → fim, com pausa; calculado de instantes, então mesário, telão e página do jogo mostram o mesmo tempo. Duração de cada tempo pela programação (grupos 8, mata-mata 10). O minuto do lance sai do cronômetro (2º tempo continua a contagem: 9 a 16); no acréscimo, fica no último minuto do tempo. Começar o 1º tempo põe o jogo ao vivo. Comandos são **idempotentes** ("fim do 1º tempo" repetido não faz nada) e fora de ordem é erro visível.
- **Lista de jogos** `/admin/mesario`: a tela inicial da conta de mesário (§4.5), na ordem dos jogos, com o jogo da vez em destaque e "Sair".
- **Tela** `/admin/mesario/[id]` (botão "Modo Mesário" no painel e na súmula): placar, cronômetro grande, jogadores dos dois times (goleiro primeiro, suspensos marcados), lançamento em 2–3 toques (jogador → evento → assistência), lista de lances com apagar em dois toques. Fim do 1º tempo e fim do jogo pedem dois toques. Empate no mata-mata: depois do fim do 2º tempo a tela abre a **disputa de pênaltis** (+/− de cada lado; a operação grava o placar absoluto, então reenviar é seguro; `definirPenaltis` em `sumula.ts`) e só encerra com vencedor. Correção de jogo encerrado fica na súmula completa, só para admin. Tela acesa (Wake Lock) e vibração ao lançar.
- **Fila offline** (`mesario.ts`, testado; `lib/repo/fila-mesario.ts` no localStorage): cada toque vira uma operação com **id próprio** gerado no celular e o instante corrigido pelo relógio do servidor; a fila sobe uma por vez pela server action `operarMesario` (`app/admin/acoes-mesario.ts`, que não redireciona). Sem internet, a tela mostra "Sem internet · N na fila", os lances como "Na fila" e o placar já atualizado (`comPendentes`); ao voltar, reenvia sozinha. Reenviar é seguro: evento com id já gravado é ignorado e o cronômetro aceita o mesmo comando duas vezes. Erro de regra tira a operação da fila e aparece na tela; erro de servidor/rede mantém e tenta de novo. Aba antiga após deploy recarrega com a fila salva. Outro celular no mesmo jogo é acompanhado a cada 8 s.
- **Telão** `/telao` (público, sem barra, para TV ou notebook no campo): jogo ao vivo ou o próximo, placar e cronômetro grandes, últimos lances e "Na sequência" com horários; atualiza a cada 5 s. A página pública do jogo também mostra o cronômetro quando está ao vivo.
- Testado de ponta a ponta em `e2e/admin.spec.ts` (inclusive internet caindo e voltando).
---

## 9. Banco de dados

- **Produção:** Postgres no **Neon** (São Paulo, `sa-east-1`), app na **Vercel** com funções em São Paulo (`vercel.json`, `gru1`) para ficar perto do banco. Repositório na organização `copa-jumentus` do GitHub (a Vercel não publica repo de conta pessoal de outra pessoa). `DATABASE_URL` (connection string *pooled* do Neon) nas variáveis de ambiente da Vercel. O cliente usa `postgres` 3.x com `prepare: false` (exigido pelo pooler).
- **Desenvolvimento:** sem `DATABASE_URL`, `src/lib/db/cliente.ts` abre um **PGlite** em `dados/pglite` e aplica as migrações sozinho. Para começar do zero, apague a pasta. Testes usam PGlite em memória (`bancoDeTeste()`).
- **Esquema:** `src/lib/db/schema.ts`. Tabelas: `admin` (contas, §4.5), `campeonato` (um por edição: `slug` único, `edicao`, `status` rascunho|inscricoes|andamento|encerrado, `modelo` copa-jumentus-8|livre, `banner`, `escudo`, `duplicado_de`, `programacao`, `premios`, `historico` e `financeiro` jsonb), `inscricao`, `equipe`, `jogador`, `fase`, `grupo`, `grupo_equipe`, `partida` (com `relogio` jsonb, §8.11), `evento`. As restrições do domínio que o banco consegue garantir (estrelas 1–6, mandante ≠ visitante, FKs) estão em `check` e `foreign key`.
- **Migrações:** SQL em `drizzle/`, geradas com `npm run db:gerar` depois de mudar o esquema (revise o SQL e versione). `npm run build` roda `scripts/migrar.mjs` antes do `next build`, então o deploy na Vercel atualiza o Neon sozinho. Nunca edite uma migração já aplicada; gere outra.
- **Vários campeonatos:** `inscricao`, `equipe` e `fase` têm `campeonato_id`; jogador, grupo, partida e evento pertencem pelo pai. Ids de texto novos (`novoId()`, 12 hex) são únicos entre campeonatos. `campeonato_id` tem default 1 só por compatibilidade com o código anterior (campeonato único) durante a transição; o código atual sempre informa.
- **Duplicar** copia configuração, fases, zonas, grupos e equipes (ids novos); elencos opcionais (pagamento zerado); nunca partidas, súmulas, pagamentos nem inscrições. Nasce em rascunho, com `duplicado_de`.
- **Escrita:** `atualizarCampeonato(id, alterar)` trava a linha do campeonato (`select … for update`), relê, aplica a mudança, recalcula o chaveamento, confere trava e consistência e regrava as tabelas filhas daquele campeonato numa transação. Ações concorrentes de dois admins são serializadas; erro em qualquer passo desfaz tudo. Volume esperado (~64 jogadores, ~20 partidas) torna a regravação inteira barata; se crescer muito, troque por escritas pontuais.
- **Segredos:** `DATABASE_URL` e `SESSAO_SEGREDO` só em `.env.local` e nas variáveis da Vercel. Nunca no Git, nem hashes de senha de contas reais (as contas iniciais foram inseridas uma vez no Neon por SQL fora do repositório).
- **Preview usa o banco de produção:** na Vercel, `DATABASE_URL` vale para production e preview, então o build de qualquer PR aplica as migrações dele no Neon de produção antes do merge. Toda migração precisa ser compatível com o código que está na `main`.

