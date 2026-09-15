# Execução do HANDOFF — o que mudou

## Tarefas do handoff

| | Tarefa | Situação |
|---|---|---|
| T1 | Estender `MonthlyKpiSnapshot` | Feito, com 7 campos além dos 6 pedidos + `projectSnapshots` |
| T2 | Sparklines e badges com dado real | Feito |
| T3 | Go-lives de verdade | Feito |
| T4 | Editor do PMO | Feito |
| T5 | Expandir os cards | Feito |
| T6 | Token de cor | Feito — **hex do amarelo ainda provisório** |
| T7 | Remover metas do texto | Feito |
| T8 | Renomear | Feito |
| T9 | Tema fixo Neon | Feito |
| T10 | Tabela "maior uso de orçamento" | Feito |
| T11 | Textos de instrução | Feito, sem nenhuma menção a outra origem de dados |
| — | Comparativos nas páginas 2, 3 e 4 | Feito (não existiam) |
| — | Chave e endpoint do Claude | Feito, com mudança de postura de segurança |

---

## Arquivos novos

| Arquivo | Para quê |
|---|---|
| `src/utils/monthlyComparison.ts` | Motor único de cálculo mês a mês. Toda página usa este módulo |
| `src/components/MoMBadge.tsx` | Badge de variação, idêntico nas quatro páginas |
| `src/components/MonthlyKpiDetailModal.tsx` | T5 — gráfico grande + tabela histórica |
| `src/utils/brand.ts` | Cor da marca para a exportação PDF/PPT, lida do token CSS |

---

## A regra que atravessa tudo

**Sem dado do mês anterior → sem comparativo.** Nenhuma estimativa, nenhuma
interpolação, nenhuma curva de enfeite. Onde falta base, aparece `—`.

Consequência prática: **até a migração rodar, o dashboard vai ficar visivelmente
vazio.** É proposital. Antes ele parecia cheio porque os números eram inventados.

---

## Números falsos removidos além dos que a auditoria listou

A auditoria do handoff cobriu o primeiro contêiner da página 1. Estes estavam
fora dessa varredura:

| Onde | O que era |
|---|---|
| `OnePageDashboard:283` | `R$ 10.265.000` — o **valor** do card Gasto Total, escrito à mão |
| `GeneralInfoDashboard` | `p.totalResources * 80000` — custo por recurso inventado |
| `GeneralInfoDashboard` | Defaults de `R$ 1.000.000`, `R$ 150.000`, `R$ 35.000` por projeto |
| `GeneralInfoDashboard` | `'31/12/2026'`, `'25/08/2026'`, `'10/08/2026'`, `R$ 125.000`, NPS `9.0`, descrição de CR genérica |
| `AttentionPointsDashboard` | Aderência `98.5%` quando não há projetos; documentação `85%` por projeto |
| `AttentionPointsDashboard` | Clamp da aderência entre 94% e 100% — escondia atrasos graves |
| `DetailedFinancialDashboard` | `p.marginPercent \|\| 24` no faturamento planejado |
| `DetailedFinancialDashboard` | Faixas de margem fixas em 24% / 20% |

Todos agora mostram `—` ou usam a referência configurada.

---

## `resourceVariancePercent` — dívida técnica resolvida

O handoff registrou como dívida ("calcular automaticamente exigiria histórico
por projeto, e `monthlyHistory` é agregado").

Foi resolvido: `MonthlyKpiSnapshot.projectSnapshots[]` guarda um recorte por
projeto em cada mês. A coluna passou a ter três estados:

1. **Calculado** — dois meses de `projectSnapshots` para aquele projeto
2. **Manual** — o campo digitado pelo PMO, marcado com `m` discreto
3. **`—`** — nenhum dos dois

Assim que houver dois meses migrados, o cálculo assume e o valor digitado deixa
de importar, inclusive se estiver desatualizado.

---

## Comparativos por página

**One Page** — quatro cards com sparkline de 7 meses e badge. Clicar abre o
histórico completo.

**Pontos de Atenção** — detratores (`detractorCount`), atraso médio
(`avgScheduleDelay`), documentação assinada (`signedDocsAvg`).

**Informações Gerais** — gasto total (`totalSpend`), CRs em aberto
(`openCrCount` e `openCrValue`), adoção ALM (`almAdoptionPercent`), NPS médio
(`npsAvg`), e a variação calculada por projeto.

**Detalhamento Financeiro** — linha de variação consolidada no rodapé e coluna
`Δ Faturamento vs Mês Ant.` por projeto (só aparece quando há `projectSnapshots`).

### Comparativos somem sob filtro

O histórico é agregado do portfólio inteiro e não tem dimensão de solução.
Com um filtro de frente ativo, comparar o recorte filtrado contra a base não
filtrada daria número errado — então os badges são suprimidos e aparece um aviso
explicando por quê.

---

## Segurança da API — mudança de postura

A chave de produção estava em **três** lugares públicos:

- `lib/apiAuth.ts` — `CORPORATE_DEFAULT_API_KEY` em texto
- `src/services/apiService.ts` — `DEFAULT_EXED_API_KEY`, que vai para o bundle
  servido ao navegador
- **`GET /api/vmo/key-info`** — rota **pública, sem autenticação**, que devolvia
  `apiKey: getConfiguredApiKey()`. Qualquer pessoa na internet podia pedir a
  chave e receber. Esta era a mais grave: anulava por completo a proteção por
  API key. A rota agora devolve só a lista de endpoints e um booleano dizendo se
  a chave está configurada

Agora:

- A chave vem só de `process.env.EXED_API_KEY`. Sem ela, a API **falha fechada**
- O frontend não tem chave embutida; o PMO cola a dele em *Configurações*
- O 401 não devolve mais a chave esperada no corpo
- Comparação em tempo constante

> **Se `exed_claude_vmo_live_sec_key_2026` já esteve num repositório ou deploy
> público, trate como comprometida e gere outra.**

### Dívida que permanece

`isAuthorized` ainda libera `GET` de mesma origem sem chave, validando o
cabeçalho `referer` — que o cliente controla e pode forjar. Na prática, os dados
financeiros são legíveis sem autenticação. Mantido para não quebrar o
carregamento do dashboard; a correção é usar o JWT que já existe em
`lib/auth.ts`.

### Migração do estado já gravado

O estado vive no Supabase e sobrevive a deploys — então mudar um valor padrão no
código **não** altera o que já está salvo. Sua instalação continuaria servindo
as instruções antigas e a meta de R$ 120M para sempre.

`lib/vmoState.ts` agora migra na leitura:

- **Instruções** trocadas quando a versão gravada é antiga *e* o texto ainda é o
  de fábrica. Se o PMO editar depois da atualização, nada é tocado.
- **Metas** de R$ 120.000.000 e 24% removidas quando são exatamente os valores
  de fábrica. Um número diferente significa decisão consciente e é preservado.

### `/api/vmo/health`

Rota pública de diagnóstico. Faz uma leitura real da tabela `vmo_app_state` —
confirma que o schema foi aplicado no projeto certo, não só que as variáveis
existem.

```json
{
  "pronto_para_o_claude": true,
  "autenticacao": { "chave_configurada": true },
  "persistencia": { "supabase_configurado": true, "supabase_acessivel": true },
  "proximos_passos": ["Nada pendente."]
}
```

---

## O que falta você fazer

1. **`EXED_API_KEY` na Vercel** — `openssl rand -hex 32`, cadastrar em
   *Settings > Environment Variables*, redeploy. **Sem isso a API para de
   aceitar escrita.**
2. **Conferir `/api/vmo/health`** — `pronto_para_o_claude` precisa vir `true`.
3. **Recadastrar o conector** em `/api/mcp?apiKey=<chave>`.
4. **Colar a chave** em *Configurações > API do Claude*.
5. **Hex do amarelo** — trocar `--exed-accent` em `src/index.css`. É uma linha.
   Continua provisório em `#FFB81C`: o site devolve só texto e a URL do SVG do
   logo é recusada pelo fetch.

Passo a passo completo em `CONECTOR-MCP.md`.
