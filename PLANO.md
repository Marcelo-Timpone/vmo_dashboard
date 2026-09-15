# Plano — correções do app, modelo de dados e migração

---

## 1. Você estava certo: há números inventados no dashboard

Encontrei os pontos exatos em `src/components/OnePageDashboard.tsx`.

### 1.1 Go-lives é uma fórmula fabricada

```ts
// linha 46
const totalGoLives = filteredProjects.length === 0
  ? 0
  : Math.max(1, Math.round(filteredProjects.length * 0.35));
```

O card "Total de Go-Lives no mês" mostra **35% da quantidade de projetos,
arredondado**. Não há nenhuma relação com go-live real. Com 20 projetos ele
sempre mostra 7.

### 1.2 Os quatro mini gráficos são desenhos fixos

Os `<polyline>` dos quatro cards têm coordenadas escritas à mão no código:

```tsx
points="0,22 30,20 65,14 100,16 135,10 170,8 200,4"   // faturamento
points="0,8 30,12 65,10 100,18 135,15 170,22 200,20"  // gasto total
points="0,24 35,20 70,18 105,14 140,11 175,8 200,6"   // clientes
points="0,26 30,22 65,24 100,16 135,13 170,8 200,4"   // go-lives
```

São sempre as mesmas curvas, independente dos dados. É esse o bug que você
notou.

### 1.3 As variações vs. mês anterior também são fixas

`+8.4% vs mês ant.` e `+1 vs mês ant.` são strings literais no JSX. E o
faturamento tem um valor fictício de fallback: `formatCurrencyBRL(totalBilled || 9850000)`.

### 1.4 A causa raiz

`MonthlyKpiSnapshot` tem só dois números por mês:

```ts
revenueBilled: number;  // faturamento do mês
marginAvg: number;      // margem média do mês
```

Só o gráfico burn-up de receita acumulada consome isso. Os outros três cards
não têm de onde tirar série histórica — então alguém desenhou uma curva
plausível e seguiu em frente. Sua suspeita estava certa: **o histórico
editável pelo PMO não é suficiente para alimentar os gráficos.**

---

## 2. Extensão do histórico mensal

Proposta para `MonthlyKpiSnapshot` — todos os campos derivam do RSE, então a
migração consegue preencher retroativamente:

| Campo | Alimenta | De onde vem no RSE |
|---|---|---|
| `revenueBilled` *(existe)* | Card 1 + burn-up | Billing Actual do mês |
| `marginAvg` *(existe)* | Burn-up / margem | Forecast Margin, média |
| `totalSpend` | Card 2 (Gasto Total) | ETC - CO/CR Actual |
| `clientsServed` | Card 3 (Clientes) | clientes distintos com RSE no mês |
| `goLivesCompleted` | Card 4 (Go-Lives) | Go-live 1–20 (status + data) |
| `activeProjects` | Contagem de ativos | projetos com RSE naquele mês |
| `avgScheduleDelay` | Pontos de Atenção | SPI / % planejado vs realizado |
| `npsAvg` | Informações Gerais | KPI - NPS Average |

Os campos novos entram como opcionais, para não quebrar registros já gravados.
Onde o dado faltar, o card mostra o valor atual sem variação e **o mini gráfico
não é renderizado** — em vez de desenhar uma curva falsa.

O editor do PMO (`MonthlyHistoryConfigSection.tsx`) ganha os campos novos. São
oito números por mês; continua simples de preencher à mão, e a migração já
deixa Jan–Set/2026 prontos.

### 2.1 Go-lives merece atenção

O RSE tem `Go-live 01..20` com status e data por projeto. Dá para reconstruir
quantos go-lives caíram em cada mês com precisão — não é estimativa. Vale
confirmar na migração se o campo de status distingue "planejado" de
"concluído"; se não distinguir, uso a data como critério (go-live com data no
passado = concluído).

---

## 3. Ajustes pedidos após o teste com a equipe

| # | Ajuste | Onde |
|---|---|---|
| 1 | Remover nome e informações de meta; manter gráficos e tabelas, só mudar a nomenclatura | `OnePageDashboard`, `ContainerParamSettings` |
| 2 | Linha de meta some quando o valor estiver vazio na configuração | `OnePageDashboard` (burn-up e gauge) |
| 3 | "empresas" → "clientes" | `OnePageDashboard:330` |
| 4 | "PRINCIPAIS INFORMAÇÕES" → "PRINCIPAIS INFORMAÇÕES DO MÊS" | `OnePageDashboard:197` |
| 5 | Todo laranja → amarelo Exed | 35 ocorrências (`#F26522`, `orange-*`, `amber-*`) |
| 6 | Remover seletor de temas, fixar Neon | `AppTheme`, `ConfigurationView`, `LateralControls`, 41 ocorrências |
| 7 | Clicar num card expande: gráfico grande + tabela de valores históricos | `OnePageDashboard` (estado de expansão novo) |
| 8 | Tabela "maior uso de orçamento": encolher coluna de cliente, encurtar títulos quando não expandida | `OnePageDashboard` (tabela) |

Sobre o item 5: preciso do **hex exato do amarelo da Exed**. Se você não tiver
à mão, eu extraio do `exed-logo.svg` que está em `public/`.

Sobre o item 6: removo o seletor da interface e fixo `theme: 'neon'`, mas
mantenho o tipo `AppTheme` e as ramificações `isLight` no código, marcadas como
código morto. Arrancar os 41 pontos de ramificação agora é risco alto de
regressão visual sem ganho — se quiser a limpeza completa, fica como passo
separado depois que a equipe validar.

Sobre o item 7: a tabela expandida usa os mesmos oito campos da seção 2. Ou
seja, o item 7 depende da extensão do histórico — são a mesma entrega.

---

## 4. Textos de instrução para o Claude

Hoje três lugares carregam orientação:

- `api/vmo/state.ts` → `DIRETRIZ_OBRIGATORIA_CLAUDE` (texto fixo no código)
- `lib/vmoState.ts` linhas ~270–340 → instruções padrão de preenchimento
- `state.instrucoesPreenchimento` / `state.localDosDados` (editáveis pelo PMO)

Todos mencionam "Link 1 / Link 2" e histórico de versões em JSON. Vou reescrever
para refletir o que descobri e deixar explícito que:

- **A única fonte de dados é o SharePoint corporativo da Exed.**
- O acesso ao Drive foi temporário, só para mapear, depurar e fazer a carga
  inicial. Depois disso ele não é mais consultado.
- A estrutura esperada é a mesma mapeada:
  `AAAAMM_Mês / AAAAMMDD - Delivery / Dashboard - .../ AAAAMMDD_PMO RSE_<PORTFOLIO>_<CLIENTE>_<PROJETO>.xlsm`
- A aba `MIRROR ACTUAL` é a superfície de leitura; não raspar as abas visuais.
- A identidade do projeto é o `Project ID (S4 Public Exed)`, nunca o nome do
  arquivo — os nomes mudam entre semanas.
- Os rótulos das subpastas (`RISE + FSW`, `GROW + DSC`) não são fonte confiável
  de portfólio; usar o campo `Project Portfolio` de dentro da planilha.
- `substituir_projetos` troca o array inteiro: sempre enviar a lista completa.
- `upsert_historico_mensal` faz merge por `monthKey` e é seguro incremental.

O texto editável pelo PMO fica com o mesmo conteúdo como valor inicial, para
que a equipe possa ajustar sem mexer em código.

---

## 5. Ordem de execução

**Agora (esta conversa):** nada mais. Plano fechado.

**Conversa 2 — ajustes no app.** Você abre uma conversa nova, sobe o zip e cola
a lista de ajustes. Eu devolvo o zip corrigido com: seções 2, 3 e 4 deste plano
+ o `lib/mcpServer.ts` e `api/mcp.ts` que já escrevi.

**Deploy.** Você sobe para produção e recadastra o conector apontando para
`/api/mcp?apiKey=...` (instruções em `CONECTOR-MCP.md`).

**Conversa 3 — migração.** Com o conector funcionando, leio o Drive, monto os
projetos e os nove meses de histórico, e escrevo via MCP. Faço em lotes, com
conferência a cada lote.

---

## 6. Riscos que seguem em aberto

1. **Projeto Supabase.** A conta conectada não tem o projeto do VMO. Antes da
   migração preciso saber onde ele está — ou o `saveState` vai cair no fallback
   de disco, que na Vercel é efêmero e some no próximo deploy.
2. **Chave no repositório.** `CORPORATE_DEFAULT_API_KEY` está em texto em
   `lib/apiAuth.ts`. Detalhado em `CONECTOR-MCP.md`.
3. **Pausa vs. encerramento.** Projeto que sumiu do RSE em julho pode estar
   encerrado ou pausado — no Drive as duas situações são idênticas. Vou marcar
   como `ENCERRADO` e listar os casos para você revisar.
4. **Amarelo Exed.** Preciso do hex, ou extraio do SVG.
