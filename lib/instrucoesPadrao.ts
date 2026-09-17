// ==============================================================================
// MANUAIS PADRÃO DE MIGRAÇÃO (RSE → VMO)
// ==============================================================================
// V3 é o atual (escrito após o teste de agosto/setembro de 2026).
// V2 fica aqui só para reconhecer instalações que ainda guardam o texto de
// fábrica antigo e atualizá-las sem tocar em textos editados pelo PMO.

export const INSTRUCOES_PADRAO_V3: string = [
  "MANUAL DE MIGRAÇÃO RSE → VMO — versão 3 (16/09/2026)",
  "Escrito a partir do teste de agosto e setembro de 2026. Cada regra diz ONDE a",
  "informação está na RSE e COMO foi encontrada. Se a planilha divergir deste",
  "texto, confie na planilha e avise o usuário.",
  "",
  "===============================================================================",
  "0. PRINCÍPIOS",
  "===============================================================================",
  "- Fonte: a pasta indicada em \"Local dos dados\" (SharePoint da Exed). Em testes o",
  "  usuário pode apontar uma pasta do Google Drive; a estrutura é a mesma.",
  "- Identidade: SEMPRE o \"Project ID (S4 Public Exed)\". Nunca o nome do arquivo.",
  "- Regra de ouro: sem dado, OMITA o campo. Zero só quando o zero é real",
  "  (ex.: 0 CRs abertas, R$ 0 de despesa lançada).",
  "- Nada de estimativa. Se um número não fecha, sinalize ao usuário.",
  "- Solução e frente são coisas diferentes e o projeto guarda as duas (seção 7).",
  "- Toda migração cadastra os clientes que ainda não existem (seção 9).",
  "- Toda gravação termina com conferência no banco (seção 13). A resposta",
  "  \"sucesso\" das ferramentas não basta.",
  "",
  "===============================================================================",
  "1. ESTRUTURA DAS PASTAS",
  "===============================================================================",
  "<raiz> (ex.: 2.Portfolio_2026)",
  "  AAAAMM_Mês (ex.: 202608_Agosto, 202609_Setembro)",
  "    AAAAMMDD - Delivery (uma pasta por semana; a data é a segunda-feira)",
  "      Dashboard - GROW + DSC   → RSE das soluções GROW e DSC (SCP, SCE)",
  "      Dashboard - RISE + FSW   → RSE das soluções RISE e FSW",
  "      A pasta é só um agrupamento: a solução vem de cada RSE e a frente,",
  "      do responsável (seção 7).",
  "      (também há .pptx, .pdf e PMO_Acompanhamento_Semanal_*.xlsx: ignore)",
  "  Na raiz há VMO_Dashboard_Lifecycle_*.xlsx: não é RSE, não use.",
  "- Processe só arquivos com \"PMO RSE_\" no nome:",
  "  AAAAMMDD_PMO RSE_<FRENTE>_<Cliente>_<Projeto>.xlsm",
  "- Ignore arquivos com 0 bytes (em 10/08 havia uma cópia corrompida da ELGIN).",
  "- A semana corrente pode estar incompleta (em 14/09 só havia 2 RSE). Use a RSE",
  "  mais recente de cada projeto.",
  "",
  "===============================================================================",
  "2. COMO LER A PLANILHA",
  "===============================================================================",
  "- read_file_content devolve o .xlsm inteiro como UM texto CSV em uma linha:",
  "  campos separados por vírgula, linhas separadas por espaço e textos com",
  "  vírgula entre aspas. O resultado passa de 250 mil caracteres: salve em",
  "  arquivo e processe por código.",
  "- Ordem das abas no texto: MIRROR ACTUAL, ADMIN, PROJECT DATA, RISKS,",
  "  GERAL STATUS, BILLING, EXPENSES (+ DASHBOARD - EXPENSES), ETC - Actual Costs,",
  "  EAC - Planned Costs, P&L Analytics, P&L Dashboard - MTD, QUALITY GATE.",
  "- Números em formato americano (1,234.56). \"R$ -\" é zero.",
  "- Datas: M/D/AAAA na MIRROR ACTUAL; \"Month D, YYYY\" nas abas visuais.",
  "- Há caracteres escapados (\\&, \\_, \\[, \\], \\#, \\!): remova a barra.",
  "- Erros de fórmula aparecem como #NAME?, #REF! e #DIV/0!. Nunca trate como",
  "  número.",
  "",
  "===============================================================================",
  "3. ABA MIRROR ACTUAL (chave-valor; fonte principal)",
  "===============================================================================",
  "- 12 colunas: N° | Planilha | Nome | Valor | vazia | N° | Planilha | Nome |",
  "  Valor (bloco LAST STATUS = semana anterior) | vazias.",
  "- 1.084 linhas. No texto cada linha ocupa 11 campos, porque o último campo de",
  "  uma linha se funde ao primeiro da seguinte. A coluna L às vezes traz texto",
  "  (\"CHECKPOINT\"), então sincronize pelo número da linha, não pela contagem.",
  "- Mapa das linhas:",
  "    1       Status Date (define o mês)",
  "    2 / 3   Schedule - Project Start / Project End",
  "    4 / 5   Schedule - Project % Planned / % Realized",
  "    7       Schedule - How many golives",
  "    8       Schedule - Atual Phase (Explore, Realize, Deploy...)",
  "    16–20   KPI - Schedule / Risk / HR / Finance / Health (Green, Yellow, Red)",
  "    21      KPI - CR Open (Yes / Not)",
  "    22 / 23 KPI - NPS Average / NPS Last Date",
  "    24–63   Golive N - Status e Golive N - Date (status: Planned, In progress,",
  "            Concluded). Atenção ao rótulo \"Golive 11- Date\", sem espaço.",
  "    64–102  Kickoff e datas das waves",
  "    103–372 RISK 01..30 (não usado no VMO)",
  "    373–376 GERAL STATUS (textos)",
  "    377–726 BILLING ACTUAL 01..50, em blocos de 50: Type (377–426),",
  "            Milestone, Planned Value, Planned Date, Status,",
  "            Effective Invoice Value, Effective Billing Date (677–726).",
  "            É o espelho das parcelas da aba BILLING.",
  "    727–1076 BILLING PLAN: tudo #REF!. IGNORE.",
  "    1077    Expenses - Total Reimbursable",
  "    1078    Expenses - Total Not Reimbursable",
  "    1079 / 1080 Expenses - Planned CO / CR (vazios em todas as RSE do teste)",
  "    1081 / 1082 EAC - CO Plan / EAC - CR Plan (custo planejado)",
  "    1083 / 1084 ETC - CO Actual / ETC - CR Actual (custo previsto atual)",
  "",
  "===============================================================================",
  "4. ABAS VISUAIS — ONDE ESTÁ CADA INFORMAÇÃO",
  "===============================================================================",
  "PROJECT DATA (o valor fica 3 campos depois do rótulo):",
  "  Project ID (S4 Public Exed) → identificação (seção 8)",
  "  Project Name → name;  Customer Name → client (seção 9)",
  "  Project Portfolio → SOLUÇÃO do projeto (seção 7)",
  "  Portfolio Manager → RESPONSÁVEL PELA FRENTE (seção 7)",
  "  Project Manager → GP (projectManager)",
  "  Using SAP Cloud ALM? (Sim/Não), Accountable Partner.",
  "  \"CR Open Date\": valor 2 campos depois do rótulo (\"August 10, 2026\").",
  "  SPI: primeiro número decimal depois de \"SPI\",\"Planned (%)\" (ex.: 1.00).",
  "  Na GERAL STATUS o SPI aparece como \"001\": não use.",
  "",
  "GERAL STATUS (o valor fica 2 campos depois do rótulo):",
  "  Revenue (CTR + CR), Total Cost (EAC), Actual Cost (ETC),",
  "  Margin Plan (CTR), Margin Plan (CTR + CR), Forecast Margin,",
  "  \"SAP Cloud ALM:\" (Yes / Not).",
  "",
  "BILLING — a aba mais organizada do faturamento:",
  "  Cabeçalho TOTAL VALUE: Contract | Change Request | Total, depois",
  "  Paid Value | Payment Delayed.",
  "  INVOICE STATUS: Planned Value | Effective Value | Deviation.",
  "  Uma linha por parcela: N°, Type (Contract ou Change Request), Milestone,",
  "  (coluna vazia), Planned Value, Planned Date, % Total, Is Late?, Status,",
  "  Status (Flag), Planned Invoice Value, Effective Invoice Value,",
  "  Effective Billing Date, Invoice Number, Expected Payment Date,",
  "  Status Payment, Paid Value, Payment Delayed, Delayed Payment Date,",
  "  Observation, Justificativa. Localize as colunas pelo cabeçalho, porque",
  "  existe uma coluna vazia depois de Milestone.",
  "",
  "EXPENSES — gastos reais do projeto, um lançamento por linha: Type (CO/CR),",
  "  Description, Date, Value, Resource, Category e Reimbursable.",
  "  O painel \"DASHBOARD - EXPENSES\" traz TOTAL, REIMBURSABLE e",
  "  NOT REIMBURSABLE (os mesmos valores das linhas 1077 e 1078).",
  "",
  "ETC - Actual Costs — custo de recursos (a maior parte do custo). Cabeçalho:",
  "  Contract Plan / Actual, Change Request Plan / Actual, Total e Deviation.",
  "  Por pessoa: Resource Name, Job Position, Rate, Start Date, End Date,",
  "  Total Hours, Total Cost e Horas/Custo de cada mês ATÉ O FIM DO PROJETO.",
  "  Por isso o \"Actual Cost (ETC)\" é o CUSTO TOTAL PREVISTO ATUALIZADO",
  "  (realizado + alocação futura), e não o gasto até hoje.",
  "  Ex.: na BTG, com 10% de avanço, o ETC já soma R$ 427.350.",
  "",
  "EAC - Planned Costs — custo planejado na proposta (Contract + CR), com a",
  "  mesma grade mensal.",
  "",
  "P&L Analytics — Taxa (imposto do projeto), Revenue, Taxes, Net Income,",
  "  Direct Labor, Expenses (Not Reimbursable) e Total Cost, planejado e atual,",
  "  por mês.",
  "",
  "===============================================================================",
  "5. FINANCEIRO — MAPEAMENTO CORRETO (validado nos 20 projetos do teste)",
  "===============================================================================",
  "Por que \"custo × receita\" não fazia sentido: a versão 2 punha a RECEITA em",
  "\"Orçado\" e a comparava com CUSTO. Todos os desvios saíam negativos, e o painel",
  "financeiro, que calcula receita = Orçado ÷ (1 − margem), inflava a receita.",
  "",
  "Mapeamento v3:",
  "  budgetPlanned (Orçado)     = Total Cost (EAC) = linhas 1081 + 1082",
  "  budgetRealized (Realizado) = Actual Cost (ETC) (1083 + 1084)",
  "                               + Expenses - Total Not Reimbursable (1078)",
  "  plannedResources           = EAC total",
  "  totalResources             = ETC total",
  "  remainingResources         = EAC − ETC (negativo = estouro previsto)",
  "  costVariancePercent        = (budgetRealized − budgetPlanned)",
  "                               ÷ budgetPlanned × 100",
  "                               (positivo = custo acima do planejado)",
  "  contractRevenue            = Revenue (CTR + CR) = BILLING → Total",
  "  contractValue              = BILLING → Contract",
  "  crValue                    = BILLING → Change Request (só se houver CR aberta)",
  "  taxRatePercent             = P&L Analytics → Taxa",
  "                               (0% nos contratos no exterior, 10% nos",
  "                               nacionais e 23% na CIMPOR)",
  "  marginPlanPercent          = Margin Plan (CTR + CR)",
  "  marginPercent              = Forecast Margin",
  "  expensesNotReimbursable    = linha 1078",
  "  reimbursableExpenseTotal   = linha 1077 (repassado ao cliente; não é custo)",
  "",
  "Conferência da margem (fechou em todos os projetos do teste):",
  "  Receita líquida = Receita × (1 − Taxa)",
  "  Margem prevista = (Receita líquida − ETC − Despesas não reembolsáveis)",
  "                    ÷ Receita líquida",
  "  Margem planejada = (Receita líquida − EAC) ÷ Receita líquida",
  "  Se a margem calculada divergir mais de 0,2 p.p. da planilha, sinalize.",
  "",
  "Receita com erro (#NAME?, caso da Ignite): omita contractRevenue,",
  "contractValue, marginPercent e marginPlanPercent e sinalize. Não use o 0,0%",
  "que a planilha mostra. Custos e faturamento continuam valendo.",
  "",
  "===============================================================================",
  "6. FATURAMENTO (revenueBilled do mês e billed do projeto)",
  "===============================================================================",
  "Fonte: parcelas da BILLING (espelhadas nas linhas 377–726).",
  "  a) Ignore parcelas cujo Type não seja \"Contract\" nem \"Change Request\".",
  "     Na Ignite, a linha 10 (Type #REF!) é cópia quebrada da linha 11, e a",
  "     própria planilha a descarta.",
  "  b) Parcela com Effective Invoice Value e Effective Billing Date válidos:",
  "     conta, qualquer que seja o Status, desde que a data não seja posterior",
  "     ao Status Date.",
  "  c) \"Billed (As planned)\" sem valor/data efetivos: use Planned Value e",
  "     Planned Date. (Regra confirmada pelo usuário.)",
  "  d) \"Billed (Early or Late)\" sem valor/data efetivos: NÃO conte, sinalize e",
  "     OMITA o billed do projeto, porque o acumulado ficaria errado. No teste:",
  "     JBS, Frasle IBP, Vibra S4, OMNI e Votorantim.",
  "  e) \"Pending\" com valor efetivo e sem data válida:",
  "     - Planned Date já passou: parcela ambígua. Não conte, omita o billed e",
  "       sinalize. (CEEC: a data efetiva traz o texto \"Faturamento realizado -",
  "       aguardo do pagamento (?)\".)",
  "     - Planned Date futura: valor pré-preenchido; ignore. (Ipiranga linha 20,",
  "       CIMPOR linha 9.)",
  "  revenueBilled do mês = soma das parcelas com data dentro do mês civil,",
  "  usando a RSE mais recente de cada projeto (ela traz a lista completa).",
  "  billed do projeto = acumulado até o fim do mês (no histórico) ou até o",
  "  Status Date (na lista de projetos).",
  "",
  "===============================================================================",
  "7. FRENTE × SOLUÇÃO",
  "===============================================================================",
  "São dois conceitos diferentes, e o projeto guarda os dois:",
  "- SOLUÇÃO (campo solution): o tipo de oferta SAP. Vem da RSE, em",
  "  PROJECT DATA → \"Project Portfolio\". São 6, com chaves fixas:",
  "  RISE, GROW, SCE, SCP, FSW e DSC.",
  "- FRENTE (campo front): a unidade de gestão, chefiada por gerentes de",
  "  portfólio. São 5, com chaves fixas: RISE, GROW, IBP, SUPPLY_CHAIN",
  "  (exibida como \"SUPPLY CHAIN\") e FABRICA (exibida como \"FÁBRICA\").",
  "A divisão por frente é POR PROJETO e segue o NOME do gerente de portfólio",
  "(Portfolio Manager, em PROJECT DATA), nunca a solução. Projetos da mesma",
  "solução podem estar em frentes diferentes: os projetos GROW do Felipe Beni",
  "(BTG, CEEC) estão na frente FÁBRICA, e os do Alexandre Ferreira (Vibra S4,",
  "OMNI) estão na frente RISE.",
  "Os nomes exibidos e os responsáveis de cada frente ficam no catálogo:",
  "ler_estado_vmo secao=\"catalogo\" ou, no app, Configurações > Gestão de",
  "projetos SAP > Frentes e soluções. São sempre 6 soluções e 5 frentes. Grave",
  "sempre as CHAVES, nunca os nomes exibidos.",
  "",
  "Responsáveis (informados pelo usuário entre 15 e 17/09/2026):",
  "  Frente         Responsáveis",
  "  RISE           Alexandre Ferreira",
  "  GROW           (nenhum)",
  "  IBP            Zorday Cavalcanti",
  "  SUPPLY CHAIN   (nenhum)",
  "  FÁBRICA        Guto Leite, Felipe Beni e Samuel Angarani",
  "                 (Samuel responde pela fábrica de software, FSW)",
  "O catálogo gravado prevalece sobre esta tabela: leia-o antes de classificar.",
  "",
  "Como classificar, projeto a projeto:",
  "1) solution = Project Portfolio convertido para a chave. Conversões:",
  "   \"SCP (IBP)\" e \"IBP\" → SCP; \"Fábrica\" → FSW; os demais pelo próprio nome.",
  "   Valor fora da lista: omita e sinalize.",
  "2) front:",
  "   a) Frente fixada pelo PMO (frontManual = true no projeto já gravado):",
  "      mantenha.",
  "   b) Senão, abra a RSE do projeto, leia o Portfolio Manager e use a frente",
  "      em que esse nome é responsável no catálogo.",
  "   c) Nome fora do catálogo ou responsável por mais de uma frente: mantenha",
  "      a frente atual do projeto (se houver), sinalize e pergunte ao usuário.",
  "   Se front vier vazio, o servidor aplica estas mesmas regras.",
  "Filtros do app: frentes e soluções são filtradas em grupos separados que se",
  "combinam (itens do mesmo grupo somam; os dois grupos se cruzam). Por isso a",
  "quantidade é fixa e as chaves não mudam.",
  "",
  "===============================================================================",
  "8. IDENTIFICAÇÃO (Project ID)",
  "===============================================================================",
  "- Procure SEMPRE o projeto pelo \"Project ID (S4 Public Exed)\" (PROJECT DATA).",
  "- Grave o valor em projectIdS4 e use o mesmo em id e code.",
  "- O campo às vezes vem com texto, como em",
  "  \"FSW | [1605] Elgin - Nova Planta Jundiaí (BRLFSWELGA250410)\".",
  "  Nesse caso, use o código entre parênteses.",
  "- IDs com sufixo valem como estão (Braskem: BRLTKBRAS250377.1.1).",
  "- Sem ID na RSE (caso da CSN DELTA): use a chave provisória",
  "  \"<Project Portfolio>_<Project Name>\" (ex.: RISE_DELTA), marque",
  "  projectIdMissing = true e avise o usuário. Quando o ID aparecer, troque a",
  "  chave em projetos, snapshots e registro.",
  "- Registre todo projeto encontrado na tabela vmo_projetos_ids do Supabase",
  "  (chave, project_id_s4, id_ausente, nome, cliente, frente, gestores,",
  "  situação, última semana, último Status Date e arquivo).",
  "",
  "===============================================================================",
  "9. CLIENTES — CADASTRO OBRIGATÓRIO EM TODA MIGRAÇÃO",
  "===============================================================================",
  "- Todo cliente citado em um projeto precisa existir em clients. Cadastre os",
  "  que faltarem. O servidor faz isso sozinho ao gravar projetos e informa em",
  "  \"clientes_cadastrados\"; confira mesmo assim.",
  "- Normalize grafias do mesmo cliente para um nome só e use esse nome nos",
  "  projetos: \"VIBRA ENERGIA S.A\" = \"Vibra Energia\". A CSN tem dois projetos.",
  "- Não una empresas diferentes: \"Frasle SA\" (taxa 10%) e \"Fras-Le Mobility\"",
  "  (taxa 0%) são entidades distintas.",
  "- Formato: { id, name, shortName, logoUrl: \"\", status, defaultSolution },",
  "  com defaultSolution = chave da solução principal do cliente.",
  "  status = \"ENCERRADO\" só quando todos os projetos do cliente estiverem",
  "  encerrados.",
  "- Clientes de projetos sem atualização (seção 10) também são cadastrados.",
  "",
  "===============================================================================",
  "10. MÊS, STATUS DATE E PROJETOS SEM ATUALIZAÇÃO",
  "===============================================================================",
  "- O mês vem do Status Date (linha 1), nunca da pasta. A pasta do início do",
  "  mês traz o fechamento do anterior (pasta 03/08 → Status Date 31/07).",
  "- Ciclo do app: dia 02 de um mês até dia 01 do seguinte. Status Date 01/09",
  "  conta para agosto (caso Votorantim).",
  "- Fechamento do mês: a última RSE com Status Date dentro do ciclo (em agosto,",
  "  a pasta 31/08).",
  "- GP que não atualizou: se a RSE mais recente do projeto tem Status Date fora",
  "  do mês, o projeto NÃO entra no histórico nem na lista de projetos daquele",
  "  mês. (Regra do usuário.) Registre-o com a ferramenta",
  "  registrar_projetos_sem_atualizacao (com solução e frente); ele aparece em",
  "  Pontos de Atenção.",
  "  Caso do teste: OMNI Fly SAP (pasta 07/09 ainda com Status Date 31/08 e",
  "  nenhuma RSE em 14/09).",
  "- Encerrado: fim planejado vencido E ausente das RSE do mês seguinte →",
  "  status \"ENCERRADO\" e closureDate = fim planejado. (Confirmado com",
  "  Votorantim COL.)",
  "- Fim vencido mas com RSE atualizada (ELGIN, CEEC): continua ATIVO; sinalize.",
  "- Projetos que só aparecem antes do período pedido (Cateno e Cogna, em",
  "  julho) ficam fora dessa carga, mas entram no registro de IDs.",
  "",
  "===============================================================================",
  "11. CAMPOS DO PROJETO (substituir_projetos)",
  "===============================================================================",
  "id, code, projectIdS4, projectIdMissing, name, client, solution (chave da",
  "solução), front (chave da frente; frontManual só o PMO marca), projectManager (GP = \"Project Manager\";",
  "confirmado), portfolioManager (responsável pela frente), status,",
  "closureDate, budgetPlanned, budgetRealized, billed, costVariancePercent,",
  "marginPercent, marginPlanPercent, contractRevenue, contractValue,",
  "taxRatePercent, plannedResources, totalResources, remainingResources,",
  "reimbursableExpenseTotal, expensesNotReimbursable,",
  "trafficTag (KPI - Health: Green → Verde, Yellow → Amarelo, Red → Vermelho),",
  "scheduleDelayPercent = (1 − SPI) × 100 (negativo = adiantado),",
  "npsScore, npsDate, usesCloudAlm, hasOpenCr (KPI - CR Open = Yes), crValue,",
  "crOpenDate, plannedStartDate, plannedEndDate, referenceDate (= Status Date),",
  "sharePointFolder (caminho completo do arquivo usado), notes (divergências).",
  "Datas no formato AAAA-MM-DD.",
  "Não existem na RSE (não preencher): signedDocumentsPercent, crDescription,",
  "qaStatus e pendenciesCount.",
  "",
  "===============================================================================",
  "12. HISTÓRICO MENSAL (upsert_historico_mensal)",
  "===============================================================================",
  "Por mês, com os projetos daquele mês (seção 10):",
  "  revenueBilled (obrigatório) e marginAvg (obrigatório; média das margens",
  "  válidas, sem as omitidas)",
  "  totalSpend = Σ budgetRealized;  plannedBudgetTotal = Σ budgetPlanned",
  "  clientsServed = clientes distintos (normalizados);  activeProjects",
  "  goLivesCompleted = go-lives \"Concluded\" com data no mês (RSE mais recente)",
  "  avgScheduleDelay;  npsAvg (só projetos com NPS);  almAdoptionPercent",
  "  openCrCount;  openCrValue = Σ crValue;  reimbursableTotal",
  "  projectSnapshots: projectId, client, solution, front, budgetRealized, billed,",
  "  marginPercent, reimbursableExpenseTotal",
  "Omita signedDocsAvg (não existe na RSE) e detractorCount (sem definição",
  "acordada). Mês em andamento: grave com parcial: true e regrave no fechamento",
  "(sem o parcial). O app usa o mês analisado do período configurado e ignora",
  "meses parciais quando esse mês não tem histórico.",
  "",
  "===============================================================================",
  "13. ORDEM DE GRAVAÇÃO E CONFERÊNCIA",
  "===============================================================================",
  "1) ler_estado_vmo (secao resumo e secao catalogo) e listar_projetos.",
  "2) upsert_historico_mensal, mês a mês.",
  "3) substituir_projetos com a lista COMPLETA do mês mais recente, mais os",
  "   encerrados. O servidor cadastra os clientes que faltarem e devolve avisos",
  "   (ID ausente, solução inválida, frente sem definição).",
  "4) registrar_projetos_sem_atualizacao do mês.",
  "5) Registre os arquivos em vmo_migracao_arquivos e os projetos em",
  "   vmo_projetos_ids.",
  "6) Confira no banco: vmo_app_state (id = 'singleton') deve ter os projetos,",
  "   clientes e meses gravados. A tabela vmo_app_state_auditoria mostra quem",
  "   gravou e o que foi bloqueado.",
  "Por que conferir: no teste, o webapp aberto com a lista vazia no navegador",
  "apagou os projetos 22 minutos depois da migração. Agora o banco bloqueia",
  "listas vazias e gravações de versões antigas do app, e o webapp só sincroniza",
  "depois de carregar os dados do servidor.",
  "",
  "===============================================================================",
  "14. RELATÓRIO FINAL AO USUÁRIO",
  "===============================================================================",
  "Informe: meses e projetos migrados; projetos com ID provisório; projetos sem",
  "atualização; encerrados; clientes cadastrados; parcelas pela regra",
  "\"as planned\"; parcelas ignoradas e o motivo; erros de fórmula; custo previsto",
  "acima do EAC; go-lives vencidos ainda \"Planned\"; projetos sem frente definida; gerentes de portfólio",
  "fora do catálogo.",
  "",
  "===============================================================================",
  "15. BACKUP, RESTAURAÇÃO E LIMPEZA",
  "===============================================================================",
  "- Backup completo: Configurações > Dados e backup > Baixar backup (JSON), ou",
  "  GET /api/vmo/backup. O arquivo (formato \"vmo-backup\", versão 2) traz o",
  "  estado inteiro do app (projetos, clientes, histórico mensal, projetos sem",
  "  atualização, frentes e soluções, instruções, layouts, configurações, links",
  "  e período) e as tabelas vmo_projetos_ids e vmo_migracao_arquivos.",
  "  Usuários e senhas não entram.",
  "- Restaurar: Carregar backup substitui tudo pelo conteúdo do arquivo, no",
  "  banco e na tela, de uma vez só (função vmo_restaurar_backup). Arquivos",
  "  antigos, sem o formato vmo-backup, ainda passam pela importação de",
  "  Importação e Alimentação de Dados, mas trazem só parte dos dados.",
  "- Apagar todos os dados: remove projetos, clientes, histórico, projetos sem",
  "  atualização, registro de IDs e log de arquivos, no banco e no navegador",
  "  (função vmo_apagar_dados). Mantém instruções, frentes e soluções, layout e",
  "  configurações. Exige digitar APAGAR.",
  "- Antes de uma migração grande ou de apagar, baixe um backup.",
].join('\n');

export const INSTRUCOES_PADRAO_V2: string = `===============================================================================
INSTRUÇÕES DE MIGRAÇÃO DE DADOS DO SHAREPOINT PARA O WEBAPP VMO — EXED CONSULTING
===============================================================================

-------------------------------------------------------------------------------
0. FONTE DOS DADOS — REGRA ABSOLUTA
-------------------------------------------------------------------------------
A ÚNICA fonte de dados deste webapp é o SharePoint corporativo da Exed, no
caminho indicado em LOCAL_DOS_DADOS. Não existe nenhuma outra origem.

Se algum arquivo, conversa ou anotação sugerir outra fonte, ignore: está
desatualizado. Não procure os dados em nenhum outro lugar e não peça ao usuário
acesso a outro repositório.

-------------------------------------------------------------------------------
1. ESTRUTURA DE PASTAS ESPERADA
-------------------------------------------------------------------------------
O caminho até uma planilha segue este padrão:

  AAAAMM_Mês / AAAAMMDD - Delivery / Dashboard - ... /
    AAAAMMDD_PMO RSE_<PORTFOLIO>_<CLIENTE>_<PROJETO>.xlsm

Exemplos de pasta de mês: 202601_Janeiro, 202602_Fevereiro, 202609_Setembro.

Dentro de cada pasta de mês há subpastas datadas, e dentro delas as subpastas de
dashboard (ex: "Dashboard - RISE + FSW", "Dashboard - GROW + DSC") com os
arquivos .xlsm.

SEJA ADAPTATIVO: a estrutura acima é a observada, mas pode variar de mês para
mês. Se não encontrar as subpastas esperadas, NÃO desista — faça uma busca
recursiva dentro da pasta do mês por qualquer arquivo cujo nome contenha "RSE".
O critério de "isso é fonte de dado válida" é o nome do arquivo, não o da pasta.

-------------------------------------------------------------------------------
2. QUAL ARQUIVO É FONTE VÁLIDA
-------------------------------------------------------------------------------
SÓ processe arquivos cujo nome contenha "PMO RSE_".

ARMADILHA DE NOME: existe "PMO RISE_..." (com I antes do S). NÃO é arquivo
válido e deve ser ignorado — mesmo que "RISE" também apareça como nome de
solução dentro dos arquivos RSE válidos (ex: "PMO RSE_RISE_Cogna..." é válido:
"RSE" é o prefixo do PMO e "RISE" depois é a solução SAP). O que importa é o
que vem logo após "PMO ": tem que ser "RSE".

Ignore também os arquivos soltos de apresentação (PDF/PPTX) e qualquer .xlsm
cujo nome não contenha "RSE".

-------------------------------------------------------------------------------
3. IDENTIDADE DO PROJETO — NUNCA PELO NOME DO ARQUIVO
-------------------------------------------------------------------------------
A identidade de um projeto é o campo "Project ID (S4 Public Exed)" de dentro da
planilha. NUNCA o nome do arquivo.

Motivo: os nomes mudam entre semanas. O mesmo projeto aparece como
"CSN_PROJETO_DELTA", depois "CSN_PROJETO_DELTA_v2", depois "..._v3". Usar o nome
como chave cria projetos duplicados e quebra todo o comparativo mês a mês.

Use esse Project ID como "id" do projeto no webapp E como "projectId" dentro de
"projectSnapshots" no histórico mensal. É esse identificador que permite calcular
a variação de um projeto entre dois meses.

-------------------------------------------------------------------------------
4. PORTFÓLIO — NÃO CONFIE NO RÓTULO DA PASTA
-------------------------------------------------------------------------------
Os rótulos das subpastas ("RISE + FSW", "GROW + DSC") são organização interna do
PMO e NÃO são fonte confiável de portfólio.

Use sempre o campo "Project Portfolio" de dentro da planilha.

-------------------------------------------------------------------------------
5. SUPERFÍCIE DE LEITURA: A ABA "MIRROR ACTUAL"
-------------------------------------------------------------------------------
Leia a aba "MIRROR ACTUAL". Ela é uma lista chave-valor das linhas 1 a 1084, já
preparada para leitura automática.

NÃO raspe as abas visuais (GERAL STATUS, BILLING, QUALITY GATE etc.). Elas são
formatação para humanos; a posição das células muda e a leitura quebra.

CADA ARQUIVO TRAZ DUAS SEMANAS, não o histórico inteiro:
  - "MIRROR ACTUAL" → a semana corrente do arquivo
  - "LAST STATUS"   → a semana anterior

Ou seja: para montar nove meses de histórico é preciso abrir os arquivos dos
nove meses. Não existe um arquivo único com tudo.

-------------------------------------------------------------------------------
6. A QUE MÊS OS DADOS PERTENCEM
-------------------------------------------------------------------------------
NÃO confie na data do nome do arquivo ou da pasta: ela indica quando a revisão
aconteceu, não o mês de referência dos números (uma pasta do início de agosto
pode conter o fechamento de julho).

A fonte confiável é o campo "Status Date" dentro da planilha. Confirme que ele
cai dentro do mês-alvo antes de usar qualquer número do arquivo. Se não bater,
procure a pasta adjacente (mês anterior ou seguinte) até achar o Status Date
certo.

Se perceber um padrão estável ("a pasta do início do mês X sempre reporta o
fechamento de X-1"), pode usá-lo para ir direto à pasta certa — mas confirme
abrindo ao menos uma planilha de cada mês antes de confiar no padrão.

-------------------------------------------------------------------------------
7. O QUE EXTRAIR POR PROJETO
-------------------------------------------------------------------------------
Da lista chave-valor de "MIRROR ACTUAL", monte cada projeto com:

  id / code            ← Project ID (S4 Public Exed)
  client               ← cliente
  name                 ← nome do projeto
  solution             ← Project Portfolio (RISE, GROW, SCP (IBP), Fábrica, SCE)
  projectManager       ← gerente responsável
  budgetPlanned        ← Revenue (CTR + CR)
  budgetRealized       ← custo real incorrido (Actual Cost)
  billed               ← total já faturado ao cliente até o Status Date
  marginPercent        ← Forecast Margin × 100
  costVariancePercent  ← ((budgetRealized - budgetPlanned) / budgetPlanned) × 100
  trafficTag           ← Temperatura (Green→Verde, Yellow→Amarelo, Red→Vermelho)
  scheduleDelayPercent ← (1 - SPI) × 100
  npsScore / npsDate   ← bloco de NPS
  usesCloudAlm         ← SAP Cloud ALM ("Not" = false)
  hasOpenCr            ← CR ("Not" = false)
  crValue / crOpenDate / crDescription ← quando houver CR aberta
  signedDocumentsPercent ← % de documentos concluídos no quality gate
  plannedEndDate       ← data de encerramento planejada
  referenceDate        ← o Status Date real
  sharePointFolder     ← caminho completo do arquivo de origem
  status               ← "ATIVO", salvo se claramente encerrado

CAMPO SEM CÉLULA CORRESPONDENTE: deixe em branco. NÃO invente valor e não deixe
de migrar o projeto por causa disso. O PMO completa depois pelas telas de
Projetos e de Histórico Mensal em Configurações.

-------------------------------------------------------------------------------
8. HISTÓRICO MENSAL — O QUE ALIMENTA TODOS OS COMPARATIVOS
-------------------------------------------------------------------------------
Para CADA mês processado, monte um item de histórico. É ele que alimenta os
comparativos "vs mês anterior" das quatro páginas do dashboard.

OBRIGATÓRIOS:
  monthKey       "AAAA-MM" (ex: "2026-03")
  year, month
  revenueBilled  faturamento DAQUELE mês (não acumulado) — some as linhas de
                 faturamento com data efetiva dentro do mês, de todos os projetos
  marginAvg      média das margens dos projetos daquele mês

OPCIONAIS (cada um liga um comparativo; sem ele o dashboard mostra "—"):
  totalSpend           gasto/uso de orçamento total do mês
  clientsServed        clientes distintos atendidos no mês
  goLivesCompleted     go-lives concluídos no mês
  activeProjects       projetos ativos no mês
  avgScheduleDelay     atraso médio de cronograma (%)
  npsAvg               NPS médio do mês (0 a 10)
  signedDocsAvg        % médio de documentação assinada
  detractorCount       projetos abaixo da referência de receita ou margem
  almAdoptionPercent   % de projetos usando SAP Cloud ALM
  openCrCount          quantidade de CRs em aberto
  openCrValue          valor somado das CRs em aberto
  plannedBudgetTotal   uso de orçamento planejado total
  reimbursableTotal    total de gasto reembolsável do mês

REGRA DE OURO: se o dado não existir para um mês, OMITA o campo. Não envie zero.
Zero e "sem dado" são coisas diferentes: zero vira uma variação real no
relatório executivo, "sem dado" vira "—". Enviar zero por ausência produz
comparativos falsos.

DETALHE POR PROJETO — "projectSnapshots":
Inclua, em cada mês, um array com um item por projeto:
  { projectId, client, solution, budgetRealized, billed, marginPercent,
    reimbursableExpenseTotal }
"projectId" É o Project ID (S4 Public Exed) da seção 3.

Isso é o que faz a coluna "Comparativo Mês Ant." das tabelas ser CALCULADA em
vez de digitada à mão pelo PMO. Com dois meses de projectSnapshots, o cálculo
assume sozinho. Sem eles, a coluna cai no valor manual ou mostra "—".

-------------------------------------------------------------------------------
9. COMO ESCREVER NO WEBAPP
-------------------------------------------------------------------------------
Toda escrita exige o cabeçalho "x-api-key: <chave>".

Ferramentas MCP (preferidas):
  ler_estado_vmo           lê o estado; use "secao" para não puxar tudo
  listar_projetos          lista compacta, para conferir antes de escrever
  substituir_projetos      SUBSTITUI O ARRAY INTEIRO
  upsert_historico_mensal  merge por monthKey
  atualizar_estado_vmo     payload parcial genérico

Rotas HTTP equivalentes:
  GET  /api/vmo/state      lê tudo
  POST /api/vmo/state      atualização parcial
  GET  /api/vmo/health     diagnóstico (chave, Supabase, endpoints)

DUAS SEMÂNTICAS DIFERENTES — preste atenção:

  "substituir_projetos" TROCA O ARRAY TODO. Sempre envie a lista COMPLETA,
  incluindo os projetos que não mudaram. Enviar só os alterados APAGA o resto.
  Faça "listar_projetos" antes.

  "upsert_historico_mensal" faz MERGE por monthKey. É seguro para carga
  incremental: enviar só o mês novo não apaga os meses já migrados. Se o
  monthKey já existir, os valores são SUBSTITUÍDOS (não duplicados).

-------------------------------------------------------------------------------
10. ROTEIRO DE MIGRAÇÃO
-------------------------------------------------------------------------------
CARGA COMPLETA DO HISTÓRICO:
  1. Liste as pastas de mês em ordem cronológica.
  2. Para cada mês, na ordem: localize os arquivos "PMO RSE_", confirme o Status
     Date (seção 6), leia "MIRROR ACTUAL" de cada um.
  3. Monte o item de histórico do mês (seção 8), com projectSnapshots.
  4. Envie com "upsert_historico_mensal" ANTES de passar para o mês seguinte.
     Trabalhe em lotes e confira com o usuário a cada lote.
  5. Ao final, envie os dados detalhados por projeto APENAS do mês mais recente
     com "substituir_projetos" — é essa lista que aparece nas tabelas de
     projetos. Os meses anteriores ficam representados pelo histórico.

ATUALIZAÇÃO DE ROTINA (só o mês corrente):
  1. Localize a pasta do mês e confirme o Status Date.
  2. Processe os arquivos "PMO RSE_".
  3. "substituir_projetos" com a lista completa do mês.
  4. "upsert_historico_mensal" com o item daquele mês, incluindo projectSnapshots
     — mesmo no modo "só mês atual", sempre atualize o histórico, senão os
     comparativos param de funcionar.

Ao final, relate: quantos meses e projetos foram processados, quais campos
ficaram em branco, e qualquer inconsistência (Status Date que não bateu, solução
que não mapeou, Project ID ausente).

-------------------------------------------------------------------------------
AVISO GERAL
-------------------------------------------------------------------------------
A estrutura interna das planilhas RSE é a mesma em todos os projetos, então o
mapeamento acima vale para qualquer arquivo RSE. Ainda assim, detalhes podem
exigir ajuste na prática (uma planilha com célula fora do lugar, um mês com
estrutura de pastas diferente). Quando um campo genuinamente não existir, deixe
em branco em vez de inventar. Só pare e pergunte ao usuário se algo impedir a
migração por completo (não conseguir acessar a pasta, arquivo corrompido).`;
