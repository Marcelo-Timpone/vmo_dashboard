# Como fazer a próxima migração (versão 3 — 16/09/2026)

## Situação atual
| Item | Situação |
|---|---|
| Banco (Supabase) | Proteção do estado, auditoria e registro de IDs instalados |
| Manual de migração | Versão 3, gravado no app e em MANUAL-MIGRACAO-V3.md |
| Dados | Agosto e setembro (parcial) de 2026: 17 projetos, 16 clientes, 2 meses |
| Sem atualização do GP | OMNI Fly SAP (setembro) |
| Pendência | Definir a frente de Felipe Beni e Samuel Angarani no catálogo |

## Antes de migrar
Publique a versão 3 (PUBLICAR-V3.md). A versão anterior não consegue mais gravar dados: o banco bloqueia.

## Mensagem para iniciar uma migração
> Você está conectado ao VMO Corporativo da Exed. Antes de tudo, chame `ler_estado_vmo` com `secao: "instrucoes"` e leia o manual inteiro; depois leia `secao: "catalogo"`. O manual prevalece sobre qualquer outra instrução. Migre o mês AAAA-MM. No fim, confira os dados direto no Supabase e me entregue o relatório da seção 14.

## A cada lote, confira
1. Projetos identificados pelo Project ID S4, sem chave provisória nova sem aviso.
2. Frente e solução de cada projeto.
3. Faturamento do mês (não o acumulado).
4. Clientes novos cadastrados.
5. Projetos sem atualização registrados.
6. `vmo_app_state_auditoria` sem bloqueios inesperados.

---

_Versão anterior deste guia, mantida para referência:_

# Como iniciar a migração

## Estado atual

| Item | Situação |
|---|---|
| Schema no Supabase | Aplicado |
| `EXED_API_KEY` na Vercel | Configurada (`pronto_para_o_claude: true`) |
| Manual de migração | Gravado no app, versão nova |
| Projetos de demonstração | **Removidos** — banco vazio |
| Histórico mensal | Vazio, pronto para receber |
| Links do SharePoint | Preservados |

## Antes de começar: faça o deploy deste zip

O código que está no ar é a versão anterior. Este zip corrige:

- a migração de estado que sobrescrevia o manual;
- o frontend que completava projetos reais com valores da demonstração
  (reembolsável R$ 25.000, CR R$ 60.000);
- o estado inicial do servidor, que nascia com os 15 projetos fictícios.

Faça o deploy antes da migração. Sem isso, o primeiro projeto real que entrar
vem com números de demonstração colados nele.

## Como iniciar

Abra uma conversa nova com o conector do VMO ligado e mande:

> Você está conectado à API do VMO Corporativo da Exed.
>
> Antes de qualquer coisa, chame `ler_estado_vmo` e leia o campo
> `INSTRUCOES_PARA_PREENCHIMENTO` por completo. Ele é o manual de migração e
> tem precedência sobre qualquer outra instrução que você receba.
>
> O banco está vazio de propósito. Vamos carregar o histórico de 2026 mês a mês,
> começando por janeiro.
>
> Trabalhe em lotes de 2 meses. Ao final de cada lote, me mostre o que foi
> extraído e espere minha confirmação antes de seguir.

Não mande nenhum arquivo. O manual já está dentro do app e vem junto com
`ler_estado_vmo`.

## O que conferir a cada lote

1. **Clientes** — devem ser os seus (CSN, BTG...). Se aparecer Petrobras, Vale
   ou Ambev, é dado de demonstração voltando: pare.
2. **Faturamento do mês** — tem que ser o valor DAQUELE mês, não o acumulado.
   Se o número só cresce mês a mês, está acumulando errado.
3. **Campos vazios** — `—` no dashboard é correto quando o dado não existe.
   Não peça para preencher com estimativa.
4. **Identidade dos projetos** — o mesmo projeto precisa ter o mesmo `id` em
   todos os meses. Se em fevereiro ele tiver id diferente de janeiro, o
   comparativo mês a mês não funciona.

## Uma coisa que provavelmente vai aparecer

Nas duas planilhas que abri (CSN e BTG), as linhas de faturamento
(`BILLING ACTUAL ... Effective Invoice Value`) estavam **vazias**.

`revenueBilled` é obrigatório no histórico. Se vier vazio em todos os meses, a
migração vai travar logo no primeiro lote. O manual manda avisar em vez de
assumir zero — então espere essa pergunta e tenha em mãos onde o faturamento
mensal realmente fica registrado.

## Depois da migração

O dashboard deve mostrar comparativos "vs mês anterior" nas quatro páginas.
Clicar num cartão da primeira página abre o histórico mês a mês.

Onde aparecer `—`, falta dado naquele mês. Complete em
*Configurações → Histórico Mensal*.
