# Workflow N8N — Estrutura e Padrões

ID do workflow principal: `DiInHUnddtFACSmj`

## Fluxo principal de mensagem

```
Webhook Evolution API
  → Verifica Menção
  → É Relatório? (IF node)
  → Formata Transcrição (só áudio)
  → Formata Imagem (só imagem)
  → Extrai Dados Mensagem
  → Busca System Prompt
  → Busca Colaboradores
  → Busca POPs
  → Busca Histórico 10
  → Busca Histórico Redis
  → Busca Chamados Redis
  → Busca Clientes
  → Busca Regras
  → Busca Skills
  → Busca Tarefas Notion
  → Busca Evolutivo        ← novo (abr/2026)
  → Busca Grupo Atual      ← novo (abr/2026)
  → Busca Memoria Contexto ← novo (abr/2026)
  → Monta Prompt
  → Claude API
  → Formata Resposta
  → Evolution API (envia WhatsApp)
```

## Nodes críticos

Todos esses precisam de `executeOnce: true`:
- Busca POPs, Busca System Prompt, Busca Colaboradores
- Busca Histórico 10, Busca Histórico Redis, Busca Chamados Redis
- Busca Clientes, Busca Regras, Busca Evolutivo

**Busca Regras** também precisa `alwaysOutputData: true`.
**Busca Evolutivo** também precisa `alwaysOutputData: true`.

**Busca Grupo Atual** — NÃO usa `executeOnce`. Precisa de `alwaysOutputData: true`.
- Query: `SELECT nome, descricao FROM grupos_whatsapp WHERE chat_id = '{{ $('Verifica Mencao').first().json.chatId }}' LIMIT 1`
- Se o chatId não está na tabela (grupo não cadastrado), retorna vazio e o bot não exibe contexto de grupo.
- O `monta_prompt.js` injeta `[Contexto: Você está no grupo "Nome" (descrição).]` no início do system prompt.

## Editar workflow

Scripts Python `fix_*.py` no projeto:
- GET workflow via API → editar nodes[]/connections → PUT → deactivate → activate
- PUT aceita só: `{name, nodes, connections, settings, staticData}`
- Settings aceita só: `{executionOrder, saveManualExecutions, callerPolicy, errorWorkflow, timezone, saveDataSuccessExecution, saveDataErrorExecution, saveExecutionProgress}`
- `tags` é read-only — nunca incluir no PUT

## Bugs corrigidos (abr/2026)

**"É Relatório?" crashava em mensagens de texto** porque referenciava `$('Formata Transcrição')` que só executa em mensagens de áudio. Fix: usar `isExecuted` como guarda:

```js
={{ $('Verifica Menção').first().json?.isReport || ($('Formata Transcrição').isExecuted ? $('Formata Transcrição').first().json?.isReport : false) || false }}
```

**Criação de tarefa no Notion falhava com data vazia** — `{"date": {}}` é rejeitado pela API. Fix no `buildNotionBody` (nó Parse Resposta):
- Data/Entrega sem valor → default = hoje no fuso America/Sao_Paulo
- Descrição vazia → usa campo `obs` como fallback
- Fone vazio → campo omitido (spread condicional)

**Bot ignorava mensagens citadas (reply)** — ao responder uma mensagem no grupo, o bot recebia só o texto novo, sem o contexto do que estava sendo citado. Fix no nó `Verifica Menção`: extrai `contextInfo.quotedMessage` da Evolution API e prepend ao `textMessage`:

```js
const textMessage = (quotedText && rawText)
  ? `[Respondendo à mensagem: "${quotedText}" (de @${quotedParticipant})]\n\n${rawText}`
  : rawText;
```

Suporta: `conversation`, `extendedTextMessage.text`, `imageMessage.caption`, `videoMessage.caption`.

**Bot não entendia @menções encadeadas** — quando Russo marcou @Victor e depois pediu "pode mandar o chamado", o bot tratou como dois eventos separados. Fix no system prompt: seção "MENÇÕES E DELEGAÇÃO" com padrões de delegação por @menção e instrução de ler mensagens em sequência do mesmo remetente como contexto contínuo.

**Imagem no grupo sem menção ao bot — descrição não salva** — o pipeline de imagem já usava Claude Vision (nó `Descreve Imagem`) mas `dbMensagem` gravava só `"🖼️ [imagem]"` sem o conteúdo. Fix no nó `Formata Imagem`: inclui `| Conteúdo: <descrição>` no campo salvo no banco. Assim relatórios e contexto futuro têm a informação da imagem.

## Busca Memoria Contexto (abr/2026)

Nó HTTP Request inserido entre `Busca Grupo Atual` e `Monta Prompt`:
- `GET https://dashboard.srv1537041.hstgr.cloud/api/memoria/contexto`
- Header: `x-token: MALUCO_POPS_2026`
- Query params: `chatId`, `texto`, `incluirOntem=true`
- `continueOnFail: true` — não trava o bot se memória falhar
- Retorna `bloco_contexto` injetado no `dynamic` antes do histórico Redis

**Padrão para nós HTTP GET no N8N v4.2:** não especificar `method` nem `authentication` — GET e none são padrão. Incluir esses campos causa 405 em alguns endpoints.

## Bug crítico — SplitInBatches v3 (abr/2026)

No nó `splitInBatches` v3, **os outputs são invertidos** em relação ao que parece intuitivo:
- **Output 0 = "done"** (vazio quando o loop termina — usar para continuar fluxo após processar tudo)
- **Output 1 = "loop"** (cada item individual — conectar ao processamento do batch)

Workflow `5qTcBwOdBeoU1l7i` (memoria-dia) tinha `Por Chat [out0] -> Busca Mensagens Hoje`, o que fazia o loop nunca executar (saía direto pelo "done"). Resultado: workflow completava em 15ms com status=success mas zero linhas em `bot_memoria_dia`. Fix: mover destino de `out0` para `out1`.

## Postgres node v2.5 — interpolação de query

Para queries com chat_id ou outros valores dinâmicos, **usar `{{ $json.campo }}` direto no SQL**, NÃO template literal `=\`...${...}...\``. O backtick com `=` causa `Syntax error at line 1 near "\`"` no Postgres porque o N8N envia o SQL com os backticks literais.

```sql
-- correto (Busca Mensagens Hoje)
SELECT chat_id, remetente, mensagem, data_hora FROM mensagens
WHERE chat_id = '{{ $json.chat_id }}'
AND data_hora >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
ORDER BY data_hora ASC LIMIT 200
```

## Workflow de alertas Notion (Urf233bK6RqoSlQs)

Roda a cada 5 minutos. Fluxo OK:
```
Schedule → Busca Ok Notion → Busca Visto Redis → Filtra e Decide
        → Tem Novas? → Busca Grupos OK → Envia WhatsApp Notif → Salva Visto Redis
```

Fluxo Entrega:
```
Schedule → Busca Tarefas Vencendo → Busca Visto Entrega → Filtra Entrega
        → Tem Entrega? → Busca Grupos Entrega → Envia Alerta Entrega → Salva Visto Entrega
```

`Busca Grupos OK` e `Busca Grupos Entrega` — nós Postgres que leem `grupos_whatsapp WHERE alertas_notion_ok/entrega = true`.

**Envia WhatsApp Notif:** `jsonBody = {{ JSON.stringify({ number: $json.chat_id, text: $('Filtra e Decide').first().json.msg }) }}`
**Envia Alerta Entrega:** `jsonBody = {{ JSON.stringify({ number: $json.chat_id, text: $('Filtra Entrega').first().json.msg }) }}`

## System Prompt placeholders

`{{DATA}}` `{{ANO}}` `{{TODAY}}` `{{COLABORADORES}}` `{{CLIENTES}}` `{{POPS}}` `{{EVOLUTIVO}}` `{{HISTORICO}}` `{{REGRAS}}`

Deploy do system prompt: script `update_system_prompt_db.py` — usa `docker exec psql` direto no banco.

**Bug corrigido (abr/2026) — Filtra e Decide / Filtra Entrega early exit:**
Ambos os nós tinham `if (!grupoNotif) return [{ temNovas: false }]` que lia `grupo_notificacao_ok/entrega` da `dashboard_config`. Se a chave estivesse vazia, o fluxo terminava antes de chegar em `Busca Grupos OK/Entrega`. Fix: remover esse gate — os nós agora apenas detectam tarefas novas; os grupos são resolvidos pelos nós Postgres específicos.

## Remetente canônico — múltiplos números por colaborador (abr/2026)

Tabela `colaboradores_numeros (id, colaborador_id, numero, apelido)` mapeia múltiplos JIDs/celulares ao mesmo `dashboard_colaboradores`. Resolve o caso em que a mesma pessoa aparece com pushNames diferentes por aparelho ("Fran", "Franquelin Zazz", etc) — o bot ficava confuso em relatórios e tarefas.

**No Extrai Dados Mensagem:** extrai `senderNumber` do `eData.key.participant` (em grupo) ou `remoteJid` (em DM), só dígitos.

**Nos nós Salva (mensagens, transcrição, imagem):** o INSERT usa subquery COALESCE pra gravar o nome canônico:
```sql
remetente = COALESCE(
  (SELECT c.nome FROM dashboard_colaboradores c
   JOIN colaboradores_numeros cn ON cn.colaborador_id = c.id
   WHERE cn.numero = '${senderNumber}' AND c.ativo = true LIMIT 1),
  '${pushName}'
)
```

UI: aba `/treinamento` → Colaboradores. Cada card lista os números cadastrados (com apelido opcional) + input inline pra adicionar/remover. Migração automática do `telefone_whatsapp` antigo no primeiro carregamento.

## Monta Prompt — cache split

O system prompt é dividido em duas partes pelo marcador `__CACHE_SPLIT__`:
- Parte estável (antes): vai com `cache_control: ephemeral` → prompt cache do Claude
- Parte dinâmica (após): histórico, regras, skill context — não cacheada

O placeholder `{{HISTORICO}}` é substituído por `__CACHE_SPLIT__` para marcar o ponto de divisão.
