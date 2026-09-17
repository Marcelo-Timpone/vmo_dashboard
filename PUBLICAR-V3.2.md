# Versão 3.2 do VMO

O banco já está atualizado (funções de backup, frentes corrigidas e manual). Publique estes arquivos no GitHub, nas mesmas pastas, aguarde a Vercel e recarregue o app.

## Dados e backup (no lugar de "Dados demonstrativos")
Em Configurações > **Dados e backup**:
- **Baixar backup (JSON):** gerado pelo banco, com projetos, clientes, histórico mensal, projetos sem atualização, frentes e soluções, instruções, layouts, configurações, registro de IDs e log de arquivos. Usuários e senhas não entram.
- **Carregar backup:** mostra o que o arquivo traz e, após a confirmação, substitui tudo no banco e na tela de uma vez.
- **Apagar todos os dados:** exige digitar APAGAR. Remove projetos, clientes, histórico, projetos sem atualização, registro de IDs e log, no banco e no navegador. Mantém instruções, frentes e soluções, layout e configurações.

O botão "Baixar JASON Completo" do topo e a área de Importação passam a usar o mesmo backup completo. Arquivos antigos continuam aceitos na importação, mas trazem só parte dos dados.

### O que o JSON antigo não cobria
- Histórico mensal, projetos sem atualização, frentes e soluções e layouts ficavam de fora.
- O download usava a cópia do navegador, não o banco.
- A importação não esvaziava listas nem substituía o histórico.
- O antigo "Zerar" apagava só projetos e clientes.

### Teste feito no banco (desfeito ao final)
Backup, depois apagar tudo, depois restaurar. O estado e as duas tabelas voltaram idênticos, e só o servidor consegue executar essas funções.

## Frentes pelo gerente de portfólio
- RISE: Alexandre Ferreira.
- IBP: Zorday Cavalcanti.
- FÁBRICA: Guto Leite, Felipe Beni e Samuel Angarani.
- GROW e SUPPLY CHAIN: sem responsável.

A frente é definida projeto a projeto pelo nome do gerente. Na lista de projetos, escolher uma frente a **fixa** (as migrações mantêm); a opção "Automática (responsável)" volta para a regra. Ao salvar Frentes e soluções, os projetos automáticos são reclassificados.

## Gráfico de margem (One Page)
- **Em cima:** a meta de margem, quando configurada; sem meta, a média do ano.
- **Embaixo:** a média do mês atual, indicando quando o mês é parcial.
- **Linha tracejada:** sem meta, é a média móvel anual; a legenda muda conforme a configuração.

## O que conferir depois de publicar
- **Configurações > Dados e backup:** baixe um backup e confira o resumo na mensagem (17 projetos, 16 clientes, 2 meses, 20 IDs, 40 arquivos).
- **Lista de projetos:** BTG, CEEC e Alpargatas aparecem na frente FÁBRICA, com a indicação "Pelo responsável".
- **One Page:** a média do ano aparece em cima e a linha tracejada acompanha as barras.

## Arquivos do pacote (14)
- `COMO-MIGRAR.md`
- `CONECTOR-MCP.md`
- `MANUAL-MIGRACAO-V3.md`
- `api/vmo/backup.ts`
- `lib/instrucoesPadrao.ts`
- `lib/mcpServer.ts`
- `lib/vmoState.ts`
- `src/App.tsx`
- `src/components/ConfigurationView.tsx`
- `src/components/OnePageDashboard.tsx`
- `src/services/apiService.ts`
- `src/types.ts`
- `src/utils/portfolio.ts`
- `supabase/schema-vmo.sql`
