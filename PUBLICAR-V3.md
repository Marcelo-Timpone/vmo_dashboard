# Versão 3 do VMO: o que mudou e como publicar

## Antes de tudo
O banco (Supabase) já está atualizado com os dados de agosto e setembro, o manual v3 e as proteções.
Publique estes arquivos **antes de abrir o app**. A versão que está no ar não consegue mais gravar projetos, clientes, histórico, catálogo nem instruções (o banco ignora essas partes) e pode travar no Detalhamento Financeiro por causa da Ignite, que está sem margem.

## Como publicar
1. Extraia este pacote. As pastas (`api`, `lib`, `src`, `supabase`) têm a mesma estrutura do repositório.
2. No GitHub do app, use **Add file > Upload files** e arraste as pastas, substituindo os arquivos atuais.
3. Aguarde a Vercel publicar (1 a 2 minutos).
4. Abra o app. Se ele já estiver aberto em alguma aba, recarregue a página.

## O que conferir depois de publicar
- As páginas mostram 17 projetos (16 ativos e o Votorantim encerrado).
- O filtro lateral tem dois grupos, **Frentes** e **Soluções**, que se combinam.
- Pontos de Atenção mostra o quadro **Projetos sem atualização do GP**, com o OMNI Fly SAP.
- Em Configurações > Gestão de projetos SAP aparecem o quadro **Frentes e soluções** e as colunas Frente e Solução na lista.
- No conector do Claude, `ler_estado_vmo` aceita a seção `catalogo`.

## O que mudou

### Proteção dos dados (causa da perda em 15/09)
- O app só sincroniza depois de carregar os dados do servidor.
- Cada gravação do app leva a data da versão carregada. Se o servidor mudou depois disso, a gravação é recusada e a tela recarrega.
- Lista vazia só apaga dados com confirmação (botão Zerar).
- Falha ao gravar no Supabase aparece como erro, sem falso "sucesso".
- As instruções exibidas em Configurações vêm do servidor, não do navegador.
- No banco, um gatilho bloqueia listas vazias e gravações de versões antigas, e uma tabela de auditoria registra cada gravação.

### Frente × solução
- São 6 soluções (RISE, GROW, SCE, SCP, FSW, DSC) e 5 frentes (RISE, GROW, IBP, SUPPLY CHAIN, FÁBRICA), com chaves fixas.
- Em Configurações > Gestão de projetos SAP > **Frentes e soluções** você renomeia soluções e frentes, define o responsável (gerente de portfólio) e marca as soluções de cada frente.
- Na lista de projetos, frente e solução são editáveis em cada linha.
- Sem frente informada, o app usa a do responsável.
- Os filtros laterais funcionam por frente e por solução, combinados.
- Valores antigos ("SCP (IBP)", "Fábrica") são convertidos automaticamente.

### Cadastro e migração
- O cadastro do projeto tem os campos **Project ID (S4)**, **Gerente de portfólio** e **Frente**. A lista mostra o alerta "Sem Project ID S4".
- Clientes citados em projetos são cadastrados automaticamente.
- Pontos de Atenção tem o quadro **Projetos sem atualização do GP**.
- O manual de migração v3 está em `MANUAL-MIGRACAO-V3.md` e também gravado no app.
- O conector MCP ganhou a ferramenta `registrar_projetos_sem_atualizacao`, as seções `catalogo` e `instrucoes` e passou a devolver avisos e bloqueios.

### Financeiro
- Orçado = custo planejado (EAC). Realizado = custo previsto (ETC) + despesas não reembolsáveis.
- A receita contratada tem campo próprio e é usada no Detalhamento Financeiro.
- Margem ausente aparece como "—" e fica fora das médias (antes a tela travava).

## Arquivos do pacote
Novos (5):
- `MANUAL-MIGRACAO-V3.md`
- `PUBLICAR-V3.md`
- `lib/instrucoesPadrao.ts`
- `src/context/CatalogoContext.tsx`
- `src/utils/portfolio.ts`

Alterados (23):
- `COMO-MIGRAR.md`
- `CONECTOR-MCP.md`
- `api/vmo/claude-context.ts`
- `api/vmo/projects.ts`
- `api/vmo/state.ts`
- `lib/apiAuth.ts`
- `lib/mcpServer.ts`
- `lib/vmoState.ts`
- `src/App.tsx`
- `src/components/AttentionPointsDashboard.tsx`
- `src/components/ClientsConfigSection.tsx`
- `src/components/ConfigurationView.tsx`
- `src/components/DashboardView.tsx`
- `src/components/DetailedFinancialDashboard.tsx`
- `src/components/EmptyPagePlaceholder.tsx`
- `src/components/GeneralInfoDashboard.tsx`
- `src/components/LateralControls.tsx`
- `src/components/OnePageDashboard.tsx`
- `src/data/initialData.ts`
- `src/services/apiService.ts`
- `src/types.ts`
- `src/utils/exportUtils.ts`
- `supabase/schema-vmo.sql`
