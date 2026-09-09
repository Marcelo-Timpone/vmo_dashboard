# VMO Corporativo - Diretrizes, Registro de Ajustes & Requisitos dos Contêineres

Este documento consolida as diretrizes técnicas, histórico oficial de ajustes e a matriz completa de requisitos de dados necessária para a alimentação e geração de cada contêiner dos dashboards do VMO Corporativo (Exed Consulting).

---

## Parte 1: Diretrizes & Registro de Ajustes do Sistema VMO

### 1. Credenciais & Autenticação de Acesso
- **Usuários Homologados:**
  - `PMO@exedconsulting.com` (Acesso Gestão / Perfil PMO completo com abas de configuração)
  - `demonstrativo@exedconsulting.com` (Acesso Apresentação / Dashboard executivo)
- **Interface Limpa:** Remoção de termos redundantes como *"Autenticação Corporativa"*, mantendo uma tela de entrada direta e de alta fidelidade visual.

### 2. Seletor de Temas & Estilo Visual (Sem Glow)
- **Opções de Tema:**
  - **Neon:** Interface escura com realces ciano e verde sutis.
  - **Dark Sólido:** Interface escura corporativa com cores 100% sólidas e sem efeito glow/brilho difuso.
  - **Branco Limpo:** Fundo claro (#FFFFFF) com cores sólidas e alto contraste para ambientes bem iluminados e impressões.
- **Botões e Filtros:** Cores sólidas, sem reflexos luminosos excessivos em todos os temas.

### 3. Mecânica de Rolagem e Navegação Entre Páginas
- **Rolagem Natural:** O scroll do mouse/trackpad percorre naturalmente o conteúdo da página ativa.
- **Transição de Página por Scroll Duplo no Limite:** Ao atingir o final (ou o topo) da página, a troca de tela só ocorre se o usuário der 2 rolagens consecutivas no limite.
- **Aviso Discreto:** Exibição de aviso limpo sem animação e sem glow (*"Role mais uma vez para avançar para a próxima página"* ou *"Role mais uma vez para recuar para a página anterior"*).
- **Atalhos de Teclado:** Teclas `ArrowRight` e `ArrowLeft` alternam diretamente de página.

### 4. Gráfico de Meta de Margem
- **Posicionamento de Porcentagens:** Quando a margem do projeto está abaixo da média geral, a porcentagem é exibida *dentro da barra*; quando acima, é exibida *acima da barra*.
- **Camadas SVG:** A linha base da meta contratual fica atrás de todas as barras e rótulos textuais, impedindo sobreposição e colisão de texto.
- **Cabeçalho Limpo:** O badge indicativo da meta contratual fica no cabeçalho do card, mantendo o gráfico despoluído.

### 5. Gráfico de Meta de Receita (Curva Burnup Anual)
- **Renderização Estática:** Animações contínuas de pulsação e crescimento removidas para proporcionar renderização estática, limpa e corporativa.
- **Comparativo:** Comparativo entre Meta Anual Planejada e Faturado com indicador percentual estável e projeção acumulada mensal.

### 6. Gráfico Média de Aderência
- **Design do Arco:** Preenchimento suave do arco com escala ajustável (padrão de 94.0% a 100.0%) sem ponteiro mecânico ou glow.
- **Nomenclatura Direta:** Rótulo simplificado para apenas **"Aderência"**.

### 7. Documentação Registrada ao PMO & Assinada
- **Status das Assinaturas:** Lista todos os projetos da base com seus percentuais reais de assinatura e status de auditoria PMO.
- **Aviso de Legado:** Projetos que não possuem histórico migrado exibem a nota parametrizada pelo PMO.

### 8. Projetos com Atrasos Registrados
- **Monitoramento de Cronograma:** Alimentado com a base completa de projetos contendo cliente, frente de implantação e percentual de desvio cronológico.
- **Diferenciação Visual:** Diferenciação entre desvio moderado (amarelo) e crítico (vermelho) com base nos limites definidos pelo PMO.

### 9. Uso de SAP Cloud ALM & Avaliações CSAT / NPS
- **Uso de ALM:** Acompanhamento da adoção da ferramenta ALM em todos os projetos com filtro rápido e taxa de cobertura.
- **Pesquisas CSAT / NPS:** Data da realização, nota de satisfação (0 a 10) e categorização (Promotor / Neutro / Detrator).

### 10. Change Requests (CRs) em Aberto
- **Acompanhamento de Escopo:** Exibição de projetos com solicitações de mudança ativas, data de abertura, descrição técnica do escopo e valor financeiro impactado.

### 11. Detalhamento Financeiro (Tabela Geral Analítica)
- **Visão Geral Consolidada:** Página dedicada contendo tabela analítica com 100% dos dados financeiros consolidados: Código, Logo + Cliente, Projeto, Frente SAP, Faturamento Planejado, Faturamento Real, Recursos Planejados, Recursos Reais, Margem de Contribuição e Status QA.

---

## Parte 2: Informações Necessárias para Geração de Cada Contêiner

Abaixo está a especificação técnica detalhada dos campos de entrada, regras de cálculo e fontes de dados de cada um dos contêineres do painel:

| Página | Nº | Contêiner | Campos Obrigatórios | Regra de Cálculo / Negócio | Origem dos Dados |
|---|---|---|---|---|---|
| **One Page** | 1 | Principais Informações | `billed` (R$), `budgetRealized` (R$), `client`, `referenceDate` | Totaliza faturamento e custos. Variação de gastos: se o gasto atual é inferior ao mês anterior, a variação é positiva/economia (verde). | SAP S/4HANA Contábil / Planilha de Faturamento |
| **One Page** | 2 | Meta de Receita (Curva Burnup) | `billed` (R$), `targetAccumulated` (R$), `referenceDate` | Curva S comparando a meta anual acumulada vs o realizado acumulado mensal de Jan a Dez. | Planejamento Financeiro Anual / Histórico de Receita |
| **One Page** | 3 | Meta de Margem (Evolução Mensal) | `marginPercent` (%), `contractMarginTarget` (%) | Gráfico de barras mensal comparado à meta contratual baseline. Posiciona % dentro ou acima da barra conforme a média. | Apuração Mensal de Custos e Faturamento |
| **One Page** | 4 | Top 5 Clientes (Contribuição na Receita) | `client`, `clientLogo`, `billed` (R$) | Ordena os clientes pelo maior faturamento absoluto e calcula a participação percentual (%) na receita total do mês. | Contratos Comerciais / Faturamento Consolidado |
| **Pontos de Atenção** | 1 | Projetos Detratores (Receita & Margem) | `client`, `billed` (R$), `budgetPlanned` (R$), `marginPercent` (%) | Tabela dupla: 1) Clientes com faturado abaixo do orçado (desvio monetário negativo); 2) Projetos com margem inferior à meta contratual. | Relatório de Desvios Orçamentários |
| **Pontos de Atenção** | 2 | Aderência aos Cronogramas & Atrasos | `scheduleDelayPercent` (%), `client`, `solution` | Medidor de arco (escala 94% a 100%) calculando a média de adesão aos prazos. Tabela detalhada de projetos com atraso > 0%. | Cronogramas MS Project / SAP Cloud ALM Tasks |
| **Pontos de Atenção** | 3 | Documentação Registrada ao PMO | `signedDocumentsPercent` (%), `isLegacyDocs`, `client`, `solution` | Lista os projetos e suas porcentagens de documentação homologada. Destaca pendências críticas abaixo da nota de corte. | Repositório SharePoint PMO / Checklist de Auditoria |
| **Informações Gerais** | 1 | Recursos Alocados & Tabela Geral | `plannedEndDate`, `totalResources`, `plannedResources`, `remainingResources` | Quadro de encerramentos próximos e consumo de horas/profissionais alocados em relação à capacidade orçada. | Sistema de Alocação de Recursos (RH/PMO) |
| **Informações Gerais** | 2 | CRs em Aberto | `hasOpenCr`, `crOpenDate`, `crDescription`, `client`, `solution` | Relaciona projetos com ordens de mudança não formalizadas, data de registro e escopo afetado. | Gestão de Mudanças / Jira / ServiceNow |
| **Informações Gerais** | 3 | Uso de SAP Cloud ALM | `usesCloudAlm` (bool), `client`, `solution` | Calcula a taxa de adoção do ALM pelo portfólio e lista a situação de cada projeto. | Portal SAP Cloud ALM Tenant Corporativo |
| **Informações Gerais** | 4 | Avaliações de Satisfação (NPS / CSAT) | `npsScore` (0-10), `npsDate`, `client`, `solution` | Calcula o Net Promoter Score / CSAT médio e classifica os clientes em Promotores, Neutros ou Detratores. | Pesquisas Trimestrais de Qualidade com Clientes |
| **Detalhamento Financeiro** | 1 | Tabela Analítica de Projetos | `code`, `name`, `client`, `clientLogo`, `solution`, `budgetPlanned`, `budgetRealized`, `marginPercent`, `qaStatus` | Matriz executiva completa com todos os indicadores financeiros e operacionais linha por linha, com suporte a ordenação e busca. | Base Consolidada VMO / Base Supabase / Planilhas Importadas |
