# Changelog — Maluco da IA (Zazz Internet)

Documento de referência com tudo que mudou no sistema, dashboard e comportamento do bot.
Última atualização: 2026-04-29.

---

## Índice

1. [O que mudou — Bot](#1-o-que-mudou--bot)
2. [O que mudou — Dashboard](#2-o-que-mudou--dashboard)
3. [O que mudou — N8N / Workflow](#3-o-que-mudou--n8n--workflow)
4. [O que mudou — Infraestrutura](#4-o-que-mudou--infraestrutura)
5. [O que ainda NÃO está ativo](#5-o-que-ainda-não-está-ativo)
6. [Pendências e próximos passos](#6-pendências-e-próximos-passos)

---

## 1. O que mudou — Bot

### Contexto de conversa

| Antes | Depois |
|---|---|
| Histórico de 4h no Redis | Histórico de **12h** — cobre o turno inteiro de trabalho |
| Bot não lembrava do início do dia à tarde | Agora lembra conversas da manhã até o fim do expediente |
| Sem memória entre dias | **Camadas 2 e 3** acumulam resumos e fatos (ver seção Infraestrutura) |

### Contexto de grupo (mensagens sem @mencionar o bot)

| Antes | Depois |
|---|---|
| Só sabia do que ele mesmo participou | Lê as últimas 10 mensagens do grupo (de qualquer pessoa) via Postgres |
| Se mencionado sem texto, o fluxo travava e ele não respondia | Agora usa a **mensagem citada** (reply) como contexto e responde mesmo sem texto adicional |
| Reply em uma mensagem + @bot: bot ignorava o que estava sendo respondido | Bot vê o texto da mensagem citada e responde com esse contexto |

### Formatação das respostas

| Antes | Depois |
|---|---|
| Usava `##`, `###` em relatórios e respostas | **Proibido** — POP "LEIA SEMPRE" é injetado em toda resposta |
| Às vezes confundia quem enviou com quem foi citado no texto | Regra explícita: remetente = campo `[HH:MM] Remetente:` do histórico, nunca nomes dentro do texto |
| Relatório com seções inventadas (Notion, N8N, etc.) | Relatório com estrutura fixa: Concluídos / Pendentes / Resumo / Destaques |

### Comportamento em privado (DM)

| Antes | Depois |
|---|---|
| DMs chegavam mas o bot parava no node `Busca Grupo Atual` (sem resultado = fluxo morto) | Query com `UNION ALL SELECT '', '' LIMIT 1` garante 1 linha sempre — fluxo continua |
| Bot não respondia no privado | Deve responder (aguardando confirmação de teste) |

### Chat da Dashboard

| Antes | Depois |
|---|---|
| Bot processava a mensagem mas a resposta ia para o vazio | Output 1 do node `É Chat Dashboard?` conectado ao `Salva Conversa` — resposta aparece no chat |

---

## 2. O que mudou — Dashboard

### Nova aba: Grupos

- **Cadastrar grupos WhatsApp** com nome, chat_id (JID), descrição
- Toggles por grupo: **Alerta Entrega** e **Alerta OK** (Notion)
- Bom Dia removido (substituído por Solicitações Programadas)
- **Seed automático** na primeira abertura: Nego's Internet, Nego's Sub, Migra e Instalação, Diário
- Ícones substituíram os emojis inline

### Nova aba: Memória *(nova — 2026-04-29)*

Três subabas:

**Resumos Diários**
- Lista todos os resumos gerados por chat por dia
- Expandir: vê resumo, pendentes, resolvidos, decisões, quem participou
- Botão "Extrair Agora" dispara o workflow N8N manualmente

**Fatos Aprendidos**
- Tabela de tudo que o bot aprendeu sobre clientes, colaboradores, regiões, equipamentos
- Filtro por tipo e busca livre
- Editar texto do fato, ajustar peso (1–10), desativar sem deletar
- "Validar" marca o fato como revisado por humano
- Botão "Extrair Fatos" dispara o workflow de análise profunda

**Por Cliente**
- Busca pelo nome do cliente e vê o histórico de fatos que o bot conhece sobre ele

### Aba Solicitações — multi-grupo

| Antes | Depois |
|---|---|
| Solicitação programada para 1 grupo fixo | Selecionar **vários grupos** na criação/edição |
| Botão "Executar Agora" não fazia nada | **Corrigido** — envia uma requisição por grupo configurado |
| `chat_id` VARCHAR(100) | `chat_id TEXT` — suporta múltiplos JIDs separados por vírgula |

---

## 3. O que mudou — N8N / Workflow

### Workflow principal `DiInHUnddtFACSmj`

| Node | Mudança |
|---|---|
| `Filter1` | Já filtrava `fromMe === false` — confirmado e mantido |
| `Busca Grupo Atual` | Query com `UNION ALL SELECT '', '' LIMIT 1` — não trava quando grupo não está cadastrado; nome do nó referenciado corrigido (tinha erro de acento) |
| `Verifica Menção` | Agora extrai `quotedText` (mensagem citada em replies) e inclui no retorno |
| `Monta Prompt` | Usa `quotedText` quando `textMessage` está vazio; POP scoring usa `textMessage \|\| quotedText`; `userMsg` como fallback em vez de travar |
| `Salva Histórico Redis` | TTL: 14400s → **43200s** (4h → 12h) |
| `É Chat Dashboard?` [output 1] | Conectado ao `Salva Conversa` (antes ia para o vazio — chat dashboard não funcionava) |
| `Monta Prompt Relatório` | Estrutura fixa com seções predefinidas; `##` e `###` explicitamente proibidos; referências a N8N/Notion/infraestrutura bloqueadas |

### Dois novos workflows criados e ativos

| Workflow | ID | Trigger | Função |
|---|---|---|---|
| Bot Memoria Dia | `5qTcBwOdBeoU1l7i` | A cada 30 min | Lê mensagens do dia por grupo → Claude Haiku → upsert em `bot_memoria_dia` |
| Bot Memoria Longa | `tPUy8FowXH8v0skk` | Todo dia às 03:00 | Lê resumos dos últimos 7 dias → Claude Haiku → fuzzy match → upsert em `bot_memoria_longa` |

---

## 4. O que mudou — Infraestrutura

### Banco de dados — novas tabelas

**`grupos_whatsapp`**
```
nome, chat_id (JID único), descricao, ativo
alertas_notion_entrega, alertas_notion_ok
```
Usada para: enviar alertas Notion para os grupos corretos, injetar nome do grupo no contexto do bot.

**`dashboard_solicitacoes_programadas`**
- Campo `chat_id` expandido para `TEXT` (suporta múltiplos JIDs separados por vírgula)

**`bot_memoria_dia`** *(nova)*
```
chat_id, data (DATE), resumo, total_mensagens
solicitacoes_abertas, solicitacoes_resolvidas, decisoes, pessoas_ativas (JSONB)
UNIQUE(chat_id, data)
```

**`bot_memoria_longa`** *(nova)*
```
entidade_tipo (cliente|colaborador|regiao|equipamento|empresa)
entidade_id, fato, categoria, peso (1-10), ocorrencias
ativo, validado_por
UNIQUE(entidade_tipo, entidade_id, fato)
```

### Banco de dados — novas entradas

**`regras`** — 2 regras adicionadas:
1. Proibição de `##`, `###`, `====`, `----` em qualquer resposta
2. Identificar remetente sempre pelo campo `[HH:MM] Remetente:` do histórico, nunca pelo nome citado dentro do texto

**`dashboard_pops`** — 1 POP adicionado:
- `"LEIA SEMPRE: Formatação e Remetente"` com `prioridade = 'sempre'`
- Injetado em **todas** as respostas (antes de qualquer outra coisa)

### Redis

- Key `conv:{chatId}`: TTL de 4h → **12h**
- Key `chamados:data`: mantido em 24h (sem mudança)

### Variáveis de ambiente (VPS `/opt/zazz/dashboard/.env`)

Adicionadas:
```env
MEMORIA_ENABLED=true
N8N_MEMORIA_DIA_WF_ID=5qTcBwOdBeoU1l7i
N8N_MEMORIA_LONGA_WF_ID=tPUy8FowXH8v0skk
```

---

## 5. O que ainda NÃO está ativo

### Memória não está sendo usada pelo bot nas respostas

O sistema de memória está **coletando e armazenando dados**, mas o bot ainda **não lê esse contexto** ao responder. Para isso funcionar, é necessário adicionar manualmente no workflow `DiInHUnddtFACSmj`:

1. Node **HTTP Request** `Busca Memoria Contexto` antes de `Monta Prompt`:
   ```
   GET https://dashboard.srv1537041.hstgr.cloud/api/memoria/contexto
   Header: x-token: <N8N_POPS_TOKEN>
   Params: chatId, texto, incluirOntem=true
   continueOnFail: true  ← obrigatório
   ```

2. No Code node `Monta Prompt`, injetar o campo `bloco_contexto` retornado.

Instruções detalhadas em [`docs/n8n-memoria.md`](docs/n8n-memoria.md).

### Chat Dashboard e privado — não testados após correção

As correções foram aplicadas mas não foram confirmadas pelo usuário:
- DM (privado) com o bot
- Chat embutido no Dashboard (`/admin` → Chat)

---

## 6. Pendências e próximos passos

| Prioridade | Item | Esforço |
|---|---|---|
| Alta | Conectar memória ao Monta Prompt (HTTP Request + injeção) | Pequeno — script Python |
| Alta | Testar DM privado com o bot e confirmar que responde | Teste manual |
| Alta | Testar chat da Dashboard e confirmar respostas aparecem | Teste manual |
| Média | Preencher `chat_id` dos grupos Nego's Sub / Migra e Instalação / Diário na aba Grupos | Manual no dashboard |
| Média | Após 2-3 dias de dados na `bot_memoria_dia`, verificar se resumos estão bons | Revisão na aba Memória |
| Baixa | Ajustar `peso` e desativar fatos incorretos conforme aparecem | Contínuo via dashboard |
| Baixa | Revisar custo mensal dos workflows de memória (estimativa: < US$0.20/mês) | — |

---

## Arquivos criados neste ciclo de desenvolvimento

```
Scripts Python (raiz do projeto):
  create_memoria_tables.py          Cria tabelas de memória via N8N temp workflow
  create_workflow_memoria_dia.py    Cria e ativa workflow de resumo diário
  create_workflow_memoria_longa.py  Cria e ativa workflow de fatos longos
  fix_redis_ttl.py                  Ajusta TTL Redis 4h → 12h
  fix_contexto_grupo.py             Quoted text + Monta Prompt melhorias
  fix_regras_formatacao.py          Insere regras de ## e remetente no banco
  fix_busca_grupo_atual.py          Corrige node Busca Grupo Atual (typo + UNION ALL)
  fix_relatorio_prompt.py           Estrutura fixa para relatórios

Dashboard (novas rotas):
  app/api/memoria/contexto/route.js
  app/api/memoria/resumos/route.js
  app/api/memoria/entidade/[tipo]/[id]/route.js
  app/api/memoria/fato/[id]/route.js
  app/api/memoria/extrair-dia/route.js
  app/api/memoria/extrair-longa/route.js
  app/api/grupos/route.js
  app/api/grupos/[id]/route.js
  app/api/solicitacoes/executar/route.js  (corrigido multi-grupo)

Dashboard (UI):
  components/MemoriaTab.jsx           Nova aba de memória
  app/admin/page.jsx                  Aba Memória + aba Grupos + multi-grupo em Solicitações

Documentação:
  docs/n8n-memoria.md               Instruções de integração da memória no N8N
  cerebro/memoria-sistema.md        Nota Obsidian indexada pelo bot
  CHANGELOG.md                      Este arquivo
```
