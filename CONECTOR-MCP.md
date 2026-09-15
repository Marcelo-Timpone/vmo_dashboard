# Correção do conector do Claude

## O que estava errado

O conector foi cadastrado apontando para `https://vmodashboard.vercel.app/api/vmo/state`.

Esse endereço é uma **API REST**: responde `{ sucesso: true, dados: {...} }`.
Um conector do Claude espera um **servidor MCP**, que é outra coisa — JSON-RPC 2.0
com três métodos obrigatórios:

| Método | Para quê |
|---|---|
| `initialize` | apresenta o servidor e negocia a versão do protocolo |
| `tools/list` | lista as ferramentas disponíveis |
| `tools/call` | executa uma ferramenta |

Como `/api/vmo/state` não implementa nenhum deles, o conector aparece como
"conectado" e **com zero ferramentas** — que é exatamente o sintoma. Não era
problema de chave: a chave estava certa, só não havia protocolo do outro lado.

## O que foi adicionado

| Arquivo | Situação |
|---|---|
| `lib/mcpServer.ts` | **novo** — implementa o protocolo MCP e as ferramentas |
| `api/mcp.ts` | **novo** — Serverless Function da Vercel em `/api/mcp` |
| `server.ts` | **alterado** — mesma rota no Express do `npm run dev` |

Nada foi removido. `/api/vmo/state` continua funcionando exatamente como antes —
o MCP é um canal novo, em paralelo, usando a mesma lógica de `lib/vmoState.ts`
e a mesma API key de `lib/apiAuth.ts`.

Duas observações sobre a alteração no `server.ts`:

- A rota `/api/mcp` foi registrada **antes** do middleware de CORS genérico.
  O handshake do MCP manda um preflight com cabeçalhos próprios
  (`Mcp-Session-Id`, `MCP-Protocol-Version`) que o CORS genérico não declara;
  se o `OPTIONS` fosse capturado lá em cima, a conexão falharia.
- O `express.json()` foi aplicado na própria rota, já que ela vem antes do
  `app.use(express.json(...))` global.

## Como cadastrar no Claude

1. Faça o deploy (`git push`, ou `vercel --prod`).
2. Confirme que o endpoint respondeu:

   ```bash
   curl -X POST "https://vmodashboard.vercel.app/api/mcp?apiKey=SUA_CHAVE" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

   Deve voltar um JSON com as cinco ferramentas. Se voltar 401, a chave está
   errada. Se voltar HTML, a rota não subiu.

3. No Claude: **Configurações → Conectores → Adicionar conector personalizado**.
   - Remova o conector antigo que aponta para `/api/vmo/state`.
   - URL: `https://vmodashboard.vercel.app/api/mcp?apiKey=SUA_CHAVE`

   A chave vai na query string porque a tela de conector personalizado não tem
   campo para cabeçalho customizado. `x-api-key` e `Authorization: Bearer`
   continuam aceitos para outros clientes.

4. Abra uma conversa nova. As ferramentas só aparecem em sessões iniciadas
   depois do cadastro.

## Ferramentas expostas

| Ferramenta | O que faz |
|---|---|
| `ler_estado_vmo` | Lê o estado. Aceita `secao`: `resumo`, `projetos`, `clientes`, `historico_mensal`, `configuracao`, `tudo` |
| `listar_projetos` | Lista compacta (id, código, nome, cliente, solução, status, margem). Filtro opcional por `status` |
| `substituir_projetos` | Troca o array inteiro de projetos — **sem merge** |
| `upsert_historico_mensal` | Merge por `monthKey`, seguro para atualização incremental |
| `atualizar_estado_vmo` | Payload genérico, mesma semântica do `POST /api/vmo/state` |

## Atenção com `substituir_projetos`

`applyIncomingUpdates` faz `state.projects = incomingProjects` — substituição
total, não merge. Isso vale tanto para o REST quanto para o MCP. Qualquer
escrita precisa mandar a **lista completa**, senão os projetos omitidos somem.

O histórico mensal é o oposto: faz upsert por `monthKey` e preserva o que já
existia. Por isso as duas ferramentas são separadas, com nomes que deixam a
diferença explícita.

## Segurança — o que mudou

A chave de produção **não está mais no código**. Antes, `lib/apiAuth.ts` trazia
`CORPORATE_DEFAULT_API_KEY = 'exed_claude_vmo_live_sec_key_2026'` escrita em
texto, e `src/services/apiService.ts` repetia a mesma chave no bundle servido ao
navegador. Na prática, a credencial era pública em dois lugares.

Agora:

- A chave vem só de `process.env.EXED_API_KEY`. **Sem ela, a API recusa toda
  escrita e todo acesso externo** — falha fechada.
- O frontend não tem mais chave embutida. O PMO cola a chave em
  *Configurações > API do Claude* e ela fica no `localStorage` daquele navegador.
- O erro 401 não devolve mais a chave esperada no corpo da resposta.
- A comparação da chave é em tempo constante.

> **Se a chave antiga (`exed_claude_vmo_live_sec_key_2026`) já esteve num
> repositório ou deploy público, trate-a como comprometida e gere uma nova.**

### Dívida conhecida

`isAuthorized` ainda libera `GET` de mesma origem sem chave, checando o
cabeçalho `referer`. Esse cabeçalho é controlado pelo cliente e pode ser
forjado, então na prática os dados financeiros são legíveis sem autenticação.
Foi mantido para não quebrar o carregamento do dashboard. A correção é usar a
sessão JWT que já existe em `lib/auth.ts` e então remover a exceção.

## Passo a passo para deixar funcionando

1. **Gerar a chave**

   ```bash
   openssl rand -hex 32
   ```

2. **Configurar na Vercel** — *Settings > Environment Variables*, para
   Production, Preview e Development:

   | Variável | Valor |
   |---|---|
   | `EXED_API_KEY` | a chave gerada no passo 1 |
   | `SUPABASE_URL` | URL do projeto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | *Project Settings > API > service_role* |
   | `AUTH_JWT_SECRET` | outro `openssl rand -hex 32` |

   `SUPABASE_SERVICE_ROLE_KEY` nunca leva o prefixo `VITE_` — esse prefixo
   publicaria a chave no bundle do navegador.

3. **Redeploy.** Variáveis de ambiente só entram em vigor num build novo.

4. **Conferir tudo de uma vez** — a rota de diagnóstico é pública de propósito:

   ```bash
   curl https://<seu-deploy>.vercel.app/api/vmo/health
   ```

   Procure por:

   ```json
   {
     "pronto_para_o_claude": true,
     "autenticacao": { "chave_configurada": true },
     "persistencia": { "supabase_configurado": true, "supabase_acessivel": true }
   }
   ```

   Se vier `false`, o campo `proximos_passos` diz exatamente o que falta.
   `supabase_acessivel` faz uma leitura real da tabela `vmo_app_state` — é como
   se confirma que o `schema-vmo.sql` foi aplicado no projeto certo, e não só
   que as variáveis existem.

5. **Testar a autenticação:**

   ```bash
   # deve retornar 401
   curl -i https://<seu-deploy>.vercel.app/api/mcp -X POST -d '{}'

   # deve retornar 200
   curl -i https://<seu-deploy>.vercel.app/api/mcp \
     -H "x-api-key: <sua-chave>" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

6. **Cadastrar o conector no Claude** apontando para:

   ```
   https://<seu-deploy>.vercel.app/api/mcp?apiKey=<sua-chave>
   ```

7. **Colar a chave no webapp**, em *Configurações > API do Claude*. Sem isso, o
   PMO consegue ver o dashboard mas não consegue salvar alterações pela tela
   (erro 401).
