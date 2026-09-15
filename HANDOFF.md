# HANDOFF — conversa 2 (ajustes no app)

Anexe este arquivo e o zip do projeto numa conversa nova e diga:
*"Execute o HANDOFF.md."*

Tudo que está aqui já foi verificado no código. A conversa 2 não precisa
reexplorar nada — pode ir direto para a implementação.

---

## 1. Auditoria: quais comparativos são reais

Varri todas as comparações mês a mês do app. O resultado:

### Falsos — escritos à mão no JSX

Todos em `src/components/OnePageDashboard.tsx`, primeiro contêiner:

| Linha | O que está lá | Card |
|---|---|---|
| 46 | `Math.max(1, Math.round(filteredProjects.length * 0.35))` | Go-Lives |
| 229 | `+8.4% vs mês ant.` | Faturamento |
| 235 | `formatCurrencyBRL(totalBilled \|\| 9850000)` | Faturamento |
| 246, 252 | `points="0,22 30,20 65,14 ..."` | Faturamento |
| 277 | `-3.2% vs mês ant.` | Gasto Total |
| 294, 300 | `points="0,8 30,12 65,10 ..."` | Gasto Total |
| 324 | `+2 novos` | Clientes |
| 341, 347 | `points="0,24 35,20 70,18 ..."` | Clientes |
| 371 | `+1 vs mês ant.` | Go-Lives |
| 388, 394 | `points="0,26 30,22 65,24 ..."` | Go-Lives |

São **quatro badges de variação, quatro sparklines e um fallback de
faturamento** — nenhum deles olha para dado nenhum. As curvas são as mesmas
sempre, independente do mês ou do filtro.

### Real, mas digitado à mão pelo PMO

`resourceVariancePercent` — a coluna "Comparativo Mês Ant." da tabela em
`GeneralInfoDashboard.tsx:191`. É um campo por projeto, preenchido em
`ConfigurationView.tsx:1488` ("Variação de Orçamento (% MoM)").

Não é inventado, mas também não é derivado: alguém digita o número. Se ele não
for atualizado todo mês, ele congela e ninguém percebe. Fica como está por
enquanto — calcular automaticamente exigiria histórico **por projeto**, e
`monthlyHistory` é agregado. Vale registrar como dívida técnica.

### Real e calculado

- Burn-up de receita acumulada (consome `monthlyHistory.revenueBilled`)
- `uniqueClients` — `Set` dos clientes dos projetos filtrados
- Todos os KPIs que agregam os projetos do estado atual
- As páginas Pontos de Atenção, Informações Gerais e Detalhamento Financeiro
  **não têm nenhum número escrito à mão** — o problema está contido no
  primeiro contêiner da primeira página

---

## 2. Tarefas

### T1 — Estender `MonthlyKpiSnapshot`

`src/types.ts:11`. Acrescentar como **opcionais** (não quebrar registros já
gravados):

```ts
totalSpend?: number;        // Card 2 — gasto total do mês
clientsServed?: number;     // Card 3 — clientes distintos no mês
goLivesCompleted?: number;  // Card 4 — go-lives concluídos no mês
activeProjects?: number;    // contagem de projetos ativos no mês
avgScheduleDelay?: number;  // atraso médio (%)
npsAvg?: number;            // NPS médio do mês
```

Todos derivam do RSE, então a migração preenche Jan–Set/2026 retroativamente.

### T2 — Sparklines e badges com dado real

Substituir os `points` fixos por coordenadas geradas a partir dos últimos ~7
meses de `monthlyHistory`. Cada badge vira o delta calculado entre o mês
corrente e o anterior.

**Regra quando faltar dado:** não renderizar o sparkline e não mostrar o badge.
Nunca desenhar curva de enfeite. Um card sem histórico mostra só o número atual.

### T3 — Go-lives de verdade

Apagar a fórmula dos 35% (linha 46). O card passa a ler
`goLivesCompleted` do mês corrente. Sem dado, mostra `—`.

### T4 — Editor do PMO

`MonthlyHistoryConfigSection.tsx` ganha os campos de T1. Oito números por mês,
continua simples de preencher à mão.

### T5 — Expandir os cards

Clicar num card abre: gráfico grande + tabela com os valores históricos mês a
mês. Usa os mesmos campos de T1 — T5 depende de T1.

### T6 — Token de cor + laranja → amarelo

Criar **um** token CSS (ex.: `--exed-accent`) em `src/index.css` e trocar as 35
ocorrências de laranja por ele. Hoje `#F26522` está espalhado literal pelo
código — foi assim que virou trabalho manual.

Hex do amarelo: **pendente** (ver seção 4). Usar um provisório no token; trocar
depois é uma linha.

Manter `#0B2240` (azul da marca) como está.

### T7 — Remover metas do texto, manter os gráficos

Tirar o nome e as informações de meta da interface, preservando gráficos e
tabelas. Quando o valor da meta estiver vazio na configuração, a **linha de
meta não deve ser renderizada** (hoje ela aparece com o default de
`annualRevenueTarget = 120000000`). Vale para o burn-up e para o gauge.

### T8 — Renomear

- `OnePageDashboard.tsx:197` — "PRINCIPAIS INFORMAÇÕES" → "PRINCIPAIS INFORMAÇÕES DO MÊS"
- `OnePageDashboard.tsx:330` — "empresas" → "clientes"

### T9 — Tema fixo Neon

Remover o seletor de temas da interface e fixar `theme: 'neon'`.

Manter o tipo `AppTheme` e as ramificações `isLight` no código, marcadas como
código morto. São 41 pontos de ramificação; arrancar todos agora é risco de
regressão visual sem ganho. Limpeza completa fica para depois da validação da
equipe.

### T10 — Tabela "maior uso de orçamento"

Encolher a coluna de cliente e encurtar os títulos quando a tabela **não**
estiver expandida, para caber sem rolagem horizontal:

- "TOTAL DO GASTO REEMBOLSÁVEL" → "REEMBOLSÁVEL"
- "COMPARATIVO MÊS ANT." → "VARIAÇÃO"

Expandida, voltam os títulos completos.

### T11 — Textos de instrução para o Claude

Três lugares:

- `api/vmo/state.ts` → `DIRETRIZ_OBRIGATORIA_CLAUDE`
- `lib/vmoState.ts` linhas ~270–340 → instruções padrão
- `ConfigurationView.tsx:72` → `DEFAULT_APP_INSTRUCOES`

Reescrever para dizer:

- **A única fonte de dados é o SharePoint corporativo da Exed.** Não existe
  nenhuma outra origem; qualquer indicação em contrário está desatualizada.
- Estrutura esperada:
  `AAAAMM_Mês / AAAAMMDD - Delivery / Dashboard - .../ AAAAMMDD_PMO RSE_<PORTFOLIO>_<CLIENTE>_<PROJETO>.xlsm`
- A aba `MIRROR ACTUAL` é a superfície de leitura (lista chave-valor de 1 a
  1084). Não raspar as abas visuais.
- A identidade do projeto é o `Project ID (S4 Public Exed)`, **nunca** o nome do
  arquivo — os nomes mudam entre semanas (`CSN_PROJETO_DELTA` → `_v2` → `_v3`).
- Os rótulos das subpastas (`RISE + FSW`, `GROW + DSC`) não são fonte confiável
  de portfólio; usar o campo `Project Portfolio` de dentro da planilha.
- Cada arquivo traz **duas** semanas (`MIRROR ACTUAL` + `LAST STATUS`), não o
  histórico inteiro.
- `substituir_projetos` troca o array todo: sempre enviar a lista completa.
- `upsert_historico_mensal` faz merge por `monthKey`, seguro para incremental.

Mesmo conteúdo como valor inicial do texto editável pelo PMO.

---

## 3. O que já está pronto no zip

| Arquivo | Estado |
|---|---|
| `lib/mcpServer.ts` | **novo** — servidor MCP (JSON-RPC 2.0), 5 ferramentas |
| `api/mcp.ts` | **novo** — Serverless Function em `/api/mcp` |
| `server.ts` | **alterado** — mesma rota no Express local |
| `supabase/schema-vmo.sql` | **novo** — schema idempotente, com 2 bugs corrigidos |
| `CONECTOR-MCP.md` | **novo** — por que o conector não funcionava e como cadastrar |
| `PLANO.md` | **novo** — plano completo |
| `HANDOFF.md` | este arquivo |

Nada foi removido. `/api/vmo/state` continua funcionando igual.

---

## 4. Decisões pendentes

1. **Hex do amarelo Exed.** Não consegui extrair do site: o fetch devolve o
   texto das páginas e descarta o CSS, e as URLs dos arquivos de estilo e do
   logo SVG ele recusa buscar. Os assets dentro do app só têm `#F26522`
   (laranja) e `#0B2240` (azul). Pegue inspecionando o elemento amarelo no
   site, ou no manual de marca.

2. **Projeto Supabase do VMO.** Rodar `supabase/schema-vmo.sql` e configurar
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` na Vercel **antes** da
   migração. Sem isso o `saveState` cai no disco efêmero e os dados somem no
   próximo deploy.

3. **Chave da API no repositório.** `lib/apiAuth.ts` tem
   `CORPORATE_DEFAULT_API_KEY = 'exed_claude_vmo_live_sec_key_2026'` em texto.
   Se `EXED_API_KEY` não estiver no ambiente, é essa que vale. Defina a
   variável e troque o literal por string vazia, para um deploy mal configurado
   falhar fechado em vez de abrir acesso.

4. **`resourceVariancePercent` manual.** Dívida técnica registrada acima.

---

## 5. Depois da conversa 2

1. Deploy na Vercel.
2. Rodar `schema-vmo.sql` no Supabase e configurar as variáveis.
3. Recadastrar o conector apontando para `/api/mcp?apiKey=...`
   (passo a passo em `CONECTOR-MCP.md`).
4. Conversa 3: migração dos nove meses, em lotes, com conferência.
