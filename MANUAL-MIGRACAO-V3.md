MANUAL DE MIGRAÇÃO RSE → VMO — versão 4 (18/09/2026)
Escrito a partir do teste de agosto e setembro de 2026, e corrigido em 18/09/2026
após o usuário apontar 4 problemas reais no app (gastos do mês inflados,
"Receita acumulada" mal nomeada, frentes FÁBRICA/SUPPLY CHAIN/FSW misturadas
e documentação assinada nunca preenchida). Cada regra diz ONDE a informação
está na RSE e COMO foi encontrada. Se a planilha divergir deste texto, confie
na planilha e avise o usuário.

===============================================================================
0. PRINCÍPIOS
===============================================================================
- Fonte: a pasta indicada em "Local dos dados" (SharePoint da Exed). Em testes o
  usuário pode apontar uma pasta do Google Drive; a estrutura é a mesma.
- Identidade: SEMPRE o "Project ID (S4 Public Exed)". Nunca o nome do arquivo.
- Regra de ouro: sem dado, OMITA o campo. Zero só quando o zero é real
  (ex.: 0 CRs abertas, R$ 0 de despesa lançada).
- Nada de estimativa. Se um número não fecha, sinalize ao usuário.
- Solução e frente são coisas diferentes e o projeto guarda as duas (seção 7).
- Toda migração cadastra os clientes que ainda não existem (seção 9).
- Toda gravação termina com conferência no banco (seção 13). A resposta
  "sucesso" das ferramentas não basta.

===============================================================================
1. ESTRUTURA DAS PASTAS
===============================================================================
<raiz> (ex.: 2.Portfolio_2026)
  AAAAMM_Mês (ex.: 202608_Agosto, 202609_Setembro)
    AAAAMMDD - Delivery (uma pasta por semana; a data é a segunda-feira)
      Dashboard - GROW + DSC   → RSE das soluções GROW e DSC (SCP, SCE)
      Dashboard - RISE + FSW   → RSE das soluções RISE e FSW
      A pasta é só um agrupamento: a solução vem de cada RSE e a frente,
      do responsável (seção 7).
      (também há .pptx, .pdf e PMO_Acompanhamento_Semanal_*.xlsx: ignore)
  Na raiz há VMO_Dashboard_Lifecycle_*.xlsx: não é RSE, não use.
- Processe só arquivos com "PMO RSE_" no nome:
  AAAAMMDD_PMO RSE_<FRENTE>_<Cliente>_<Projeto>.xlsm
- Ignore arquivos com 0 bytes (em 10/08 havia uma cópia corrompida da ELGIN).
- A semana corrente pode estar incompleta (em 14/09 só havia 2 RSE). Use a RSE
  mais recente de cada projeto.

===============================================================================
2. COMO LER A PLANILHA
===============================================================================
- read_file_content devolve o .xlsm inteiro como UM texto CSV em uma linha:
  campos separados por vírgula, linhas separadas por espaço e textos com
  vírgula entre aspas. O resultado passa de 250 mil caracteres: salve em
  arquivo e processe por código.
- CUIDADO: o separador de linha por espaço NÃO é confiável em toda parte.
  Textos sem vírgula (ex.: "CONTRACT - ACTUAL", "Total Cost", "Job
  Position") têm espaço mas NÃO vêm entre aspas, então cortar por espaço
  quebra esses rótulos no meio (bug real encontrado processando a aba ETC —
  ver seção 12). Nesses trechos, separe SÓ por vírgula (respeitando aspas) e
  ache os campos por texto único (ex.: "Resource Name"), nunca por posição
  ou por valores soltos como "1"/"2" (podem colidir com dado real).
- Ordem das abas no texto: MIRROR ACTUAL, ADMIN, PROJECT DATA, RISKS,
  GERAL STATUS, BILLING, EXPENSES (+ DASHBOARD - EXPENSES), ETC - Actual Costs,
  EAC - Planned Costs, P&L Analytics, P&L Dashboard - MTD, QUALITY GATE.
- Números em formato americano (1,234.56). "R$ -" é zero.
- Datas: M/D/AAAA na MIRROR ACTUAL; "Month D, YYYY" nas abas visuais.
- Há caracteres escapados (\&, \_, \[, \], \#, \!): remova a barra.
- Erros de fórmula aparecem como #NAME?, #REF! e #DIV/0!. Nunca trate como
  número.

===============================================================================
3. ABA MIRROR ACTUAL (chave-valor; fonte principal)
===============================================================================
- 12 colunas: N° | Planilha | Nome | Valor | vazia | N° | Planilha | Nome |
  Valor (bloco LAST STATUS = semana anterior) | vazias.
- 1.084 linhas. No texto cada linha ocupa 11 campos, porque o último campo de
  uma linha se funde ao primeiro da seguinte. A coluna L às vezes traz texto
  ("CHECKPOINT"), então sincronize pelo número da linha, não pela contagem.
- Mapa das linhas:
    1       Status Date (define o mês)
    2 / 3   Schedule - Project Start / Project End
    4 / 5   Schedule - Project % Planned / % Realized
    7       Schedule - How many golives
    8       Schedule - Atual Phase (Explore, Realize, Deploy...)
    16–20   KPI - Schedule / Risk / HR / Finance / Health (Green, Yellow, Red)
    21      KPI - CR Open (Yes / Not)
    22 / 23 KPI - NPS Average / NPS Last Date
    24–63   Golive N - Status e Golive N - Date (status: Planned, In progress,
            Concluded). Atenção ao rótulo "Golive 11- Date", sem espaço.
    64–102  Kickoff e datas das waves
    103–372 RISK 01..30 (não usado no VMO)
    373–376 GERAL STATUS (textos)
    377–726 BILLING ACTUAL 01..50, em blocos de 50: Type (377–426),
            Milestone, Planned Value, Planned Date, Status,
            Effective Invoice Value, Effective Billing Date (677–726).
            É o espelho das parcelas da aba BILLING.
    727–1076 BILLING PLAN: tudo #REF!. IGNORE.
    1077    Expenses - Total Reimbursable
    1078    Expenses - Total Not Reimbursable
    1079 / 1080 Expenses - Planned CO / CR (vazios em todas as RSE do teste)
    1081 / 1082 EAC - CO Plan / EAC - CR Plan (custo planejado)
    1083 / 1084 ETC - CO Actual / ETC - CR Actual (custo previsto atual)

===============================================================================
4. ABAS VISUAIS — ONDE ESTÁ CADA INFORMAÇÃO
===============================================================================
PROJECT DATA (o valor fica 3 campos depois do rótulo):
  Project ID (S4 Public Exed) → identificação (seção 8)
  Project Name → name;  Customer Name → client (seção 9)
  Project Portfolio → SOLUÇÃO do projeto (seção 7)
  Portfolio Manager → RESPONSÁVEL PELA FRENTE (seção 7)
  Project Manager → GP (projectManager)
  Using SAP Cloud ALM? (Sim/Não), Accountable Partner.
  "CR Open Date": valor 2 campos depois do rótulo ("August 10, 2026").
  SPI: primeiro número decimal depois de "SPI","Planned (%)" (ex.: 1.00).
  Na GERAL STATUS o SPI aparece como "001": não use.

GERAL STATUS (o valor fica 2 campos depois do rótulo):
  Revenue (CTR + CR), Total Cost (EAC), Actual Cost (ETC),
  Margin Plan (CTR), Margin Plan (CTR + CR), Forecast Margin,
  "SAP Cloud ALM:" (Yes / Not).

BILLING — a aba mais organizada do faturamento:
  Cabeçalho TOTAL VALUE: Contract | Change Request | Total, depois
  Paid Value | Payment Delayed.
  INVOICE STATUS: Planned Value | Effective Value | Deviation.
  Uma linha por parcela: N°, Type (Contract ou Change Request), Milestone,
  (coluna vazia), Planned Value, Planned Date, % Total, Is Late?, Status,
  Status (Flag), Planned Invoice Value, Effective Invoice Value,
  Effective Billing Date, Invoice Number, Expected Payment Date,
  Status Payment, Paid Value, Payment Delayed, Delayed Payment Date,
  Observation, Justificativa. Localize as colunas pelo cabeçalho, porque
  existe uma coluna vazia depois de Milestone.

EXPENSES — gastos reais do projeto, um lançamento por linha: Type (CO/CR),
  Description, Date, Value, Resource, Category e Reimbursable.
  O painel "DASHBOARD - EXPENSES" traz TOTAL, REIMBURSABLE e
  NOT REIMBURSABLE (os mesmos valores das linhas 1077 e 1078). Isso é só UMA
  das duas fontes do gasto real do mês — ver seção 12.

ETC - Actual Costs — custo de recursos (a maior parte do custo, e a OUTRA
  fonte do gasto real do mês — ver seção 12). Cabeçalho: Contract Plan /
  Actual, Change Request Plan / Actual, Total e Deviation. Duas grades
  ("CONTRACT - ACTUAL" e "CHANGE REQUEST - ACTUAL"), cada uma por pessoa:
  Resource Name, Job Position, Rate, Start Date, End Date, Total Hours,
  Total Cost e Horas/Custo de cada mês ATÉ O FIM DO PROJETO (rótulo
  "MonthName-YYYY", ex.: "August-2026"). Por isso o "Actual Cost (ETC)" do
  PROJETO (GERAL STATUS, e o campo budgetRealized do cadastro do projeto) é
  o CUSTO TOTAL PREVISTO ATUALIZADO (realizado + alocação futura), e não o
  gasto até hoje — mas a MESMA grade, lida por coluna de mês, dá o gasto
  daquele mês especificamente. Ex.: na BTG, com 10% de avanço, o ETC total
  já soma R$ 427.350, mas o custo de agosto/2026 sozinho é R$ 31.350.

EAC - Planned Costs — custo planejado na proposta (Contract + CR), com a
  mesma grade mensal.

P&L Analytics — Taxa (imposto do projeto), Revenue, Taxes, Net Income,
  Direct Labor, Expenses (Not Reimbursable) e Total Cost, planejado e atual,
  por mês.

===============================================================================
5. FINANCEIRO — MAPEAMENTO CORRETO (validado nos 20 projetos do teste)
===============================================================================
Por que "custo × receita" não fazia sentido: a versão 2 punha a RECEITA em
"Orçado" e a comparava com CUSTO. Todos os desvios saíam negativos, e o painel
financeiro, que calcula receita = Orçado ÷ (1 − margem), inflava a receita.

Mapeamento v3 (campos do CADASTRO DO PROJETO — substituir_projetos; isto é
diferente do histórico mensal, ver seção 12):
  budgetPlanned (Orçado)     = Total Cost (EAC) = linhas 1081 + 1082
  budgetRealized (Realizado) = Actual Cost (ETC) (1083 + 1084)
                               + Expenses - Total Not Reimbursable (1078)
                               [ACUMULADO até o fim do projeto — usado na
                               margem e no remainingResources. NÃO é o gasto
                               do mês; para o gasto do mês, ver seção 12]
  plannedResources           = EAC total
  totalResources              = ETC total
  remainingResources          = EAC − ETC (negativo = estouro previsto)
  costVariancePercent        = (budgetRealized − budgetPlanned)
                               ÷ budgetPlanned × 100
                               (positivo = custo acima do planejado)
  contractRevenue             = Revenue (CTR + CR) = BILLING → Total
  contractValue                = BILLING → Contract
  crValue                      = BILLING → Change Request (só se houver CR aberta)
  taxRatePercent               = P&L Analytics → Taxa
                               (0% nos contratos no exterior, 10% nos
                               nacionais e 23% na CIMPOR)
  marginPlanPercent            = Margin Plan (CTR + CR)
  marginPercent                 = Forecast Margin
  expensesNotReimbursable     = linha 1078
  reimbursableExpenseTotal    = linha 1077 (repassado ao cliente; não é custo)

Conferência da margem (fechou em todos os projetos do teste):
  Receita líquida = Receita × (1 − Taxa)
  Margem prevista = (Receita líquida − ETC − Despesas não reembolsáveis)
                    ÷ Receita líquida
  Margem planejada = (Receita líquida − EAC) ÷ Receita líquida
  Se a margem calculada divergir mais de 0,2 p.p. da planilha, sinalize.

Receita com erro (#NAME?, caso da Ignite): omita contractRevenue,
contractValue, marginPercent e marginPlanPercent e sinalize. Não use o 0,0%
que a planilha mostra. Custos e faturamento continuam valendo.

===============================================================================
6. FATURAMENTO (revenueBilled do mês e billed do projeto)
===============================================================================
Fonte: parcelas da BILLING (espelhadas nas linhas 377–726).
  a) Ignore parcelas cujo Type não seja "Contract" nem "Change Request".
     Na Ignite, a linha 10 (Type #REF!) é cópia quebrada da linha 11, e a
     própria planilha a descarta.
  b) Parcela com Effective Invoice Value e Effective Billing Date válidos:
     conta, qualquer que seja o Status, desde que a data não seja posterior
     ao Status Date.
  c) "Billed (As planned)" sem valor/data efetivos: use Planned Value e
     Planned Date. (Regra confirmada pelo usuário.)
  d) "Billed (Early or Late)" sem valor/data efetivos: NÃO conte, sinalize e
     OMITA o billed do projeto, porque o acumulado ficaria errado. No teste:
     JBS, Frasle IBP, Vibra S4, OMNI e Votorantim.
  e) "Pending" com valor efetivo e sem data válida:
     - Planned Date já passou: parcela ambígua. Não conte, omita o billed e
       sinalize. (CEEC: a data efetiva traz o texto "Faturamento realizado -
       aguardo do pagamento (?)".)
     - Planned Date futura: valor pré-preenchido; ignore. (Ipiranga linha 20,
       CIMPOR linha 9.)
  revenueBilled do mês = soma das parcelas com data dentro do mês civil,
  usando a RSE mais recente de cada projeto (ela traz a lista completa).
  billed do projeto = acumulado até o fim do mês (no histórico) ou até o
  Status Date (na lista de projetos).
  NOTA (18/09/2026): este campo (revenueBilled) é o FATURAMENTO do mês, não
  a receita contratada (contractRevenue, seção 5). O app rotula o burnup
  como "Faturamento acumulado" desde 18/09/2026 — antes dizia "Receita
  acumulada", o que confundia os dois conceitos.

===============================================================================
7. FRENTE × SOLUÇÃO
===============================================================================
São dois conceitos diferentes, e o projeto guarda os dois:
- SOLUÇÃO (campo solution): o tipo de oferta SAP. Vem da RSE, em
  PROJECT DATA → "Project Portfolio". São 6, com chaves fixas:
  RISE, GROW, SCE, SCP, FSW e DSC.
- FRENTE (campo front): a unidade de gestão, chefiada por gerentes de
  portfólio. São 6, com chaves fixas: RISE, GROW, IBP, SUPPLY_CHAIN
  (exibida como "SUPPLY CHAIN"), FABRICA (exibida como "FÁBRICA") e FSW
  (exibida como "FWS", fábrica de software — frente própria desde
  18/09/2026, separada de FÁBRICA).
A divisão por frente é POR PROJETO e segue o NOME do gerente de portfólio
(Portfolio Manager, em PROJECT DATA), nunca a solução. Projetos da mesma
solução podem estar em frentes diferentes: os projetos GROW do Felipe Beni
(BTG, CEEC) estão na frente FÁBRICA, e os do Alexandre Ferreira (Vibra S4,
OMNI) estão na frente RISE.
Os nomes exibidos e os responsáveis de cada frente ficam no catálogo:
ler_estado_vmo secao="catalogo" ou, no app, Configurações > Gestão de
projetos SAP > Frentes e soluções. São sempre 6 soluções e 6 frentes. Grave
sempre as CHAVES, nunca os nomes exibidos.

Responsáveis (corrigido pelo usuário em 18/09/2026 — a tabela de 15-17/09
juntava os três na FÁBRICA por engano; cada gerente tem a própria frente):
  Frente         Responsáveis
  RISE           Alexandre Ferreira
  GROW           (nenhum)
  IBP            Zorday Cavalcanti
  SUPPLY CHAIN   Guto Leite
  FÁBRICA        Felipe Beni
  FSW (FWS)      Samuel Angarani
O catálogo gravado prevalece sobre esta tabela: leia-o antes de classificar.

Como classificar, projeto a projeto:
1) solution = Project Portfolio convertido para a chave. Conversões:
   "SCP (IBP)" e "IBP" → SCP; "Fábrica" → FSW; os demais pelo próprio nome.
   Valor fora da lista: omita e sinalize.
2) front:
   a) Frente fixada pelo PMO (frontManual = true no projeto já gravado):
      mantenha.
   b) Senão, abra a RSE do projeto, leia o Portfolio Manager e use a frente
      em que esse nome é responsável no catálogo.
   c) Nome fora do catálogo ou responsável por mais de uma frente: mantenha
      a frente atual do projeto (se houver), sinalize e pergunte ao usuário.
   Se front vier vazio, o servidor aplica estas mesmas regras.
Filtros do app: frentes e soluções são filtradas em grupos separados que se
combinam (itens do mesmo grupo somam; os dois grupos se cruzam). Por isso a
quantidade é fixa e as chaves não mudam.

===============================================================================
8. IDENTIFICAÇÃO (Project ID)
===============================================================================
- Procure SEMPRE o projeto pelo "Project ID (S4 Public Exed)" (PROJECT DATA).
- Grave o valor em projectIdS4 e use o mesmo em id e code.
- O campo às vezes vem com texto, como em
  "FSW | [1605] Elgin - Nova Planta Jundiaí (BRLFSWELGA250410)".
  Nesse caso, use o código entre parênteses.
- IDs com sufixo valem como estão (Braskem: BRLTKBRAS250377.1.1).
- Sem ID na RSE (caso da CSN DELTA): use a chave provisória
  "<Project Portfolio>_<Project Name>" (ex.: RISE_DELTA), marque
  projectIdMissing = true e avise o usuário. Quando o ID aparecer, troque a
  chave em projetos, snapshots e registro.
- Registre todo projeto encontrado na tabela vmo_projetos_ids do Supabase
  (chave, project_id_s4, id_ausente, nome, cliente, frente, gestores,
  situação, última semana, último Status Date e arquivo).

===============================================================================
9. CLIENTES — CADASTRO OBRIGATÓRIO EM TODA MIGRAÇÃO
===============================================================================
- Todo cliente citado em um projeto precisa existir em clients. Cadastre os
  que faltarem. O servidor faz isso sozinho ao gravar projetos e informa em
  "clientes_cadastrados"; confira mesmo assim.
- Normalize grafias do mesmo cliente para um nome só e use esse nome nos
  projetos: "VIBRA ENERGIA S.A" = "Vibra Energia". A CSN tem dois projetos.
- Não una empresas diferentes: "Frasle SA" (taxa 10%) e "Fras-Le Mobility"
  (taxa 0%) são entidades distintas.
- Formato: { id, name, shortName, logoUrl: "", status, defaultSolution },
  com defaultSolution = chave da solução principal do cliente.
  status = "ENCERRADO" só quando todos os projetos do cliente estiverem
  encerrados.
- Clientes de projetos sem atualização (seção 10) também são cadastrados.

===============================================================================
10. MÊS, STATUS DATE E PROJETOS SEM ATUALIZAÇÃO
===============================================================================
- O mês vem do Status Date (linha 1), nunca da pasta. A pasta do início do
  mês traz o fechamento do anterior (pasta 03/08 → Status Date 31/07).
- Ciclo do app: dia 02 de um mês até dia 01 do seguinte. Status Date 01/09
  conta para agosto (caso Votorantim).
- Fechamento do mês: a última RSE com Status Date dentro do ciclo (em agosto,
  a pasta 31/08).
- GP que não atualizou: se a RSE mais recente do projeto tem Status Date fora
  do mês, o projeto NÃO entra no histórico nem na lista de projetos daquele
  mês. (Regra do usuário.) Registre-o com a ferramenta
  registrar_projetos_sem_atualizacao (com solução e frente); ele aparece em
  Pontos de Atenção.
  Caso do teste: OMNI Fly SAP (pasta 07/09 ainda com Status Date 31/08 e
  nenhuma RSE em 14/09) — por isso a OMNI entrou no histórico de agosto
  (com RSE válida) mas saiu do de setembro.
- Isso é diferente de um projeto ATIVO cuja RSE de setembro existe e está
  atualizada, mas cuja grade de custo (aba ETC, seção 12) não tem nenhum
  valor lançado na coluna do mês: nesse caso o projeto CONTINUA no mês
  (billing, margem etc. continuam válidos), só o gasto do mês fica R$ 0,00 —
  não use registrar_projetos_sem_atualizacao para isso, porque excluiria o
  projeto inteiro incorretamente. Grave o R$ 0,00 e sinalize em notes (ex.:
  "Setembro/2026: aba ETC sem custo de recurso lançado para o mês — GP não
  atualizou essa parte da RSE; gasto real do mês pode estar subestimado.").
  Casos do teste (18/09/2026): Elgin (Nova Planta Jundiaí), Alpargatas
  (Squad Planejamento) e CEEC.
- Encerrado: fim planejado vencido E ausente das RSE do mês seguinte →
  status "ENCERRADO" e closureDate = fim planejado. (Confirmado com
  Votorantim COL.)
- Fim vencido mas com RSE atualizada (ELGIN, CEEC): continua ATIVO; sinalize.
- Projetos que só aparecem antes do período pedido (Cateno e Cogna, em
  julho) ficam fora dessa carga, mas entram no registro de IDs.

===============================================================================
11. CAMPOS DO PROJETO (substituir_projetos)
===============================================================================
id, code, projectIdS4, projectIdMissing, name, client, solution (chave da
solução), front (chave da frente; frontManual só o PMO marca), projectManager (GP = "Project Manager";
confirmado), portfolioManager (responsável pela frente), status,
closureDate, budgetPlanned, budgetRealized, billed, costVariancePercent,
marginPercent, marginPlanPercent, contractRevenue, contractValue,
taxRatePercent, plannedResources, totalResources, remainingResources,
reimbursableExpenseTotal, expensesNotReimbursable,
trafficTag (KPI - Health: Green → Verde, Yellow → Amarelo, Red → Vermelho),
scheduleDelayPercent = (1 − SPI) × 100 (negativo = adiantado),
npsScore, npsDate, usesCloudAlm, hasOpenCr (KPI - CR Open = Yes), crValue,
crOpenDate, plannedStartDate, plannedEndDate, referenceDate (= Status Date),
sharePointFolder (caminho completo do arquivo usado), notes (divergências).
Datas no formato AAAA-MM-DD.
Não existem na RSE (não preencher a partir da planilha): crDescription,
qaStatus e pendenciesCount. signedDocumentsPercent NÃO vem da RSE, mas do
Playbook Portal (QA/Quality Gate) — ver seção 16; preencha só para projetos
ATIVOS, nunca para ENCERRADOS.

===============================================================================
12. HISTÓRICO MENSAL (upsert_historico_mensal)
===============================================================================
Por mês, com os projetos daquele mês (seção 10):
  revenueBilled (obrigatório) e marginAvg (obrigatório; média das margens
  válidas, sem as omitidas)

  totalSpend e projectSnapshots[].budgetRealized = GASTO REAL DO MÊS, não o
  custo total do projeto. CORRIGIDO em 18/09/2026: a versão anterior deste
  manual mandava usar Σ budgetRealized (o campo do PROJETO, que é ETC
  acumulado até o fim do projeto — seção 5) e isso inflava o total mensal em
  ~13x (agosto saiu R$ 37,3M em vez dos ~R$ 2,9M reais). O campo do PROJETO
  (budgetRealized, cadastro + margem) continua sendo o acumulado — não mexa
  nele. O do HISTÓRICO MENSAL é outra coisa, soma de duas fontes:
    a) Custo de recursos do mês: aba "ETC - Actual Costs" da RSE mais
       recente do mês (seção 4). Tem duas grades (CONTRACT - ACTUAL e
       CHANGE REQUEST - ACTUAL), uma linha por recurso, com colunas
       Hours/Cost repetidas por mês (rótulo "MonthName-YYYY", ex.:
       "August-2026"). Some o campo Cost da coluna do mês desejado, de
       TODAS as linhas de recurso, nas duas grades.
    b) Despesas avulsas do mês: aba EXPENSES (seção 4), um lançamento por
       linha. Some o Value das linhas cuja Date cai dentro do mês civil
       (mesma janela da seção 10: dia 02 até dia 01 do mês seguinte).
    totalSpend do mês = Σ (a + b) de todos os projetos daquele mês.
    projectSnapshots[].budgetRealized = (a + b) daquele projeto naquele mês.
  Como extrair (a) sem quebrar o rótulo "CONTRACT - ACTUAL" (ver aviso da
  seção 2 sobre separar só por vírgula): ache o campo com o texto único
  "Resource Name" (cabeçalho da grade de recursos) e conte quantos rótulos
  "MonthName-YYYY" existem entre o marcador do bloco e "Resource Name" —
  isso dá o número de colunas de mês (monthCount). A largura de cada linha
  de recurso é sempre 9 + 2×monthCount campos (9 = N°, Resource Name, Job
  Position, Rate, Start Date, End Date, Total Hours, Total Cost, + 1 campo
  em branco). A primeira linha de recurso começa logo após a linha de
  cabeçalho. NÃO ache a linha de recurso 1 procurando o valor "1" solto: se
  algum recurso tiver Horas = 1 ou = 2 num mês qualquer, esse valor pode ser
  confundido com o início da próxima linha (bug real na RSE da Cimpor, que
  zerou o resultado até ser corrigido) — ancore sempre pela largura
  calculada a partir de "Resource Name" + monthCount, nunca por valores.

  plannedBudgetTotal = Σ budgetPlanned (esse continua sendo o EAC total do
  projeto — é orçamento/meta, não gasto do mês, não muda)
  clientsServed = clientes distintos (normalizados);  activeProjects
  goLivesCompleted = go-lives "Concluded" com data no mês (RSE mais recente)
  avgScheduleDelay;  npsAvg (só projetos com NPS);  almAdoptionPercent
  openCrCount;  openCrValue = Σ crValue;  reimbursableTotal
  projectSnapshots: projectId, client, solution, front, budgetRealized (ver
  acima — gasto do MÊS, não acumulado), billed, marginPercent,
  reimbursableExpenseTotal
Omita signedDocsAvg quando não houver QA do Playbook para nenhum projeto do
mês (seção 16) e detractorCount (sem definição acordada). Mês em andamento:
grave com parcial: true e regrave no fechamento (sem o parcial). O app usa o
mês analisado do período configurado e ignora meses parciais quando esse mês
não tem histórico.

===============================================================================
13. ORDEM DE GRAVAÇÃO E CONFERÊNCIA
===============================================================================
1) ler_estado_vmo (secao resumo e secao catalogo) e listar_projetos.
2) upsert_historico_mensal, mês a mês.
3) substituir_projetos com a lista COMPLETA do mês mais recente, mais os
   encerrados. O servidor cadastra os clientes que faltarem e devolve avisos
   (ID ausente, solução inválida, frente sem definição).
4) registrar_projetos_sem_atualizacao do mês.
5) Registre os arquivos em vmo_migracao_arquivos e os projetos em
   vmo_projetos_ids.
6) Confira no banco: vmo_app_state (id = 'singleton') deve ter os projetos,
   clientes e meses gravados. A tabela vmo_app_state_auditoria mostra quem
   gravou e o que foi bloqueado.
Por que conferir: no teste, o webapp aberto com a lista vazia no navegador
apagou os projetos 22 minutos depois da migração. Agora o banco bloqueia
listas vazias e gravações de versões antigas do app, e o webapp só sincroniza
depois de carregar os dados do servidor.

===============================================================================
14. RELATÓRIO FINAL AO USUÁRIO
===============================================================================
Informe: meses e projetos migrados; projetos com ID provisório; projetos sem
atualização; encerrados; clientes cadastrados; parcelas pela regra
"as planned"; parcelas ignoradas e o motivo; erros de fórmula; custo previsto
acima do EAC; go-lives vencidos ainda "Planned"; projetos sem frente definida; gerentes de portfólio
fora do catálogo; projetos ativos com a grade ETC do mês vazia (seção 10).

===============================================================================
15. BACKUP, RESTAURAÇÃO E LIMPEZA
===============================================================================
- Backup completo: Configurações > Dados e backup > Baixar backup (JSON), ou
  GET /api/vmo/backup. O arquivo (formato "vmo-backup", versão 2) traz o
  estado inteiro do app (projetos, clientes, histórico mensal, projetos sem
  atualização, frentes e soluções, instruções, layouts, configurações, links
  e período) e as tabelas vmo_projetos_ids e vmo_migracao_arquivos.
  Usuários e senhas não entram.
- Restaurar: Carregar backup substitui tudo pelo conteúdo do arquivo, no
  banco e na tela, de uma vez só (função vmo_restaurar_backup). Arquivos
  antigos, sem o formato vmo-backup, ainda passam pela importação de
  Importação e Alimentação de Dados, mas trazem só parte dos dados.
- Apagar todos os dados: remove projetos, clientes, histórico, projetos sem
  atualização, registro de IDs e log de arquivos, no banco e no navegador
  (função vmo_apagar_dados). Mantém instruções, frentes e soluções, layout e
  configurações. Exige digitar APAGAR.
- Antes de uma migração grande ou de apagar, baixe um backup.

===============================================================================
16. DOCUMENTAÇÃO ASSINADA (signedDocumentsPercent, via Playbook Portal)
===============================================================================
Pedido pelo usuário em 17/09/2026: signedDocumentsPercent (% de documentos
assinados/concluídos) NÃO vem da RSE — vem do Playbook Portal, cruzando pelo
cliente + projeto (ideal: pelo campo sapProjectId do Playbook, mas em
17/09/2026 esse campo estava vazio em quase todos os projetos de lá; se
ainda estiver vazio, cruze por nome do cliente + solução, confirme com o
usuário antes de gravar em massa, e aproveite para preencher sapProjectId no
Playbook com o "Project ID (S4 Public Exed)" do VMO — a chave de API do
Playbook tem escopo de escrita desde 17/09/2026 justamente para isso).

Como calcular:
1. listar_qa_reviews (ou ler_portfolio_playbook secao="qa_reviews") traz uma
   lista de auditorias QA, cada uma com projectName, client, phase,
   validationDate, adherence e qualityGateDocs (array de {doc, status, fase}).
2. Para cada projeto ATIVO do VMO, ache o QA mais recente do Playbook (maior
   validationDate) para o projeto correspondente. Projetos ENCERRADOS não
   precisam desse campo — pule-os.
3. Dentro do qualityGateDocs desse QA, calcule:
     signedDocumentsPercent = (docs com status "Concluído (evidência
     anexada)") ÷ (docs com status != "Não aplicável (fora de escopo)") × 100
   Confirmado pelo usuário em 17/09/2026: só "Concluído (evidência
   anexada)" conta como assinado — "Aprovado internamente", "Em
   elaboração" e "Não iniciado" NÃO contam.
4. Grave em signedDocumentsPercent, projeto a projeto, via substituir_projetos
   (lista completa, ver seção 11).
Se o Playbook não tiver nenhum QA para um projeto ativo, omita o campo
(regra de ouro da seção 0) e sinalize no relatório final. Requer o conector
MCP do Playbook Portal conectado com escopo de leitura (mínimo) — sem ele,
pule esta seção e avise o usuário.

===============================================================================
17. OBSERVAÇÃO IMPORTANTE
===============================================================================
Este manual é a "memória" do processo de migração. Ele não compartilha
automaticamente a memória usada no chat do Claude.ai nem o CLAUDE.md do
repositório local. Sempre que uma regra nova for definida numa conversa,
replique aqui manualmente (ou peça para o Claude atualizar via
atualizar_estado_vmo) E no CLAUDE.md / <projeto>/CONECTOR-MCP.md quando for
uma lição de infraestrutura (não de dado financeiro).
