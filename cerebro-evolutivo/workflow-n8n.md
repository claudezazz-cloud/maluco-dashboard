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

## System Prompt placeholders

`{{DATA}}` `{{ANO}}` `{{TODAY}}` `{{COLABORADORES}}` `{{CLIENTES}}` `{{POPS}}` `{{EVOLUTIVO}}` `{{HISTORICO}}` `{{REGRAS}}`

Deploy do system prompt: script `update_system_prompt_db.py` — usa `docker exec psql` direto no banco.

## Monta Prompt — cache split

O system prompt é dividido em duas partes pelo marcador `__CACHE_SPLIT__`:
- Parte estável (antes): vai com `cache_control: ephemeral` → prompt cache do Claude
- Parte dinâmica (após): histórico, regras, skill context — não cacheada

O placeholder `{{HISTORICO}}` é substituído por `__CACHE_SPLIT__` para marcar o ponto de divisão.
