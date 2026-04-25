# Workflow N8N

← volta para [[Maluco da IA]] | arquivo: `workflow_v2.json` (~50 nós)

O coração do bot — roda no [[Infraestrutura|N8N self-hosted]].

## Fluxo principal (mensagem de texto)

```
Webhook (Evolution API)
  → Extrai Dados Mensagem (messageId, remetente, chatId, tipo, contexto de citação)
  → Salva no Postgres (tabela mensagens, ver [[Banco de Dados]])
  → Filter1 (ignora mensagens do próprio bot)
  → Verifica Menção (detecta @Claude + skills /)
     ├── É Treinamento? → Salva Regra → Confirma
     ├── É Relatório?  → Monta Prompt Relatório → Claude → Envia
     └── É Menu?       → Formata Menu → Envia (sem Claude)
  → Busca POPs / System Prompt / Colaboradores / Regras
  → Busca Histórico Redis / Chamados / Clientes
  → Monta Prompt
  → Claude API
  → Parse Resposta
     ├── É Chat Dashboard? → [false] Envia WhatsApp / [true] skip
     ├── Salva Histórico Redis
     ├── Salva Conversa (Postgres)
     ├── É Erro? → Salva Erro
     ├── Tem Notion? → Explode Notions → Cria no Notion (CREATE — N tarefas em paralelo)
     └── Tem Ok?     → Explode Oks     → Marca Ok no Notion (PATCH status=Ok)
```

Ver [[Notion]] para detalhes dos markers `|||NOTION|||` (criar) e `|||NOTION_OK|||` (atualizar).

## Fluxos especializados

- **Áudio** → ver [[Fluxo de Audio]]
- **Imagem** → ver [[Fluxo de Imagem]]
- **Erros globais** → ver [[Error Trigger]]
- **Agendamento** → ver [[Solicitacoes Programadas]]

## Nós com configurações obrigatórias

Precisam `executeOnce: true`:
- Busca POPs, Busca System Prompt, Busca Colaboradores
- Busca Histórico 10, Busca Histórico Redis
- Busca Chamados Redis, Busca Clientes, Busca Regras

**Busca Regras** também precisa `alwaysOutputData: true` — senão o fluxo trava quando a tabela está vazia.

## Node "Monta Prompt"

É um bloco de código grande que:
1. Lê todas as saídas dos nós "Busca X"
2. Calcula relevância semântica dos POPs (score de palavras)
3. Separa POPs por prioridade (`sempre` / `importante` / `relevante`)
4. Monta o `systemContent` com placeholders substituídos (`{{DATA}}`, `{{POPS}}`, etc)
5. Retorna `claudeBody` pronto pra enviar à Anthropic

## Prompt Caching

O nó `Monta Prompt` separa o `system` em 2 content blocks antes de passar pro `Claude API`:

1. **Bloco estável** (marcado com `cache_control: {"type": "ephemeral"}`) — template renderizado com POPs, CLIENTES, COLABORADORES, DATA, chamadosContext, tarefasContext. Mudam em horas.
2. **Bloco dinâmico** (sem cache) — `historicoSection` + `rulesPrompt` + `skillContext`. Mudam a cada mensagem.

A divisão usa o marker `__CACHE_SPLIT__` no lugar do `{{HISTORICO}}` durante a renderização do template, e o código dá split no final.

**Efeito**: 1ª chamada grava cache (1.25x preço do input estável). Chamadas seguintes nos 5 min seguintes leem do cache (**10x mais baratas**). Para conferir no retorno do Claude API, ver campos `usage.cache_creation_input_tokens` e `usage.cache_read_input_tokens`.

**Fallback**: se o branch sem template for usado (DB sem `system_prompt`), `system` volta a ser string simples — não há cache mas tudo funciona.

## Gate "É Chat Dashboard?"

IF entre `Parse Resposta` e `Envia WhatsApp`. Quando `chatId.startsWith('dashboard-')` (mensagens vindas do `/chat` da [[Dashboard]]), pula `Envia WhatsApp` — caso contrário, a Evolution API ficava 120s pendurada tentando enviar pra um chatId que não existe no WhatsApp. Os outros ramos (Salva Conversa, Salva Histórico Redis) seguem normal. `Envia WhatsApp` também tem `timeout: 15000` como defesa.

## Deploy do workflow

Ver [[Deploy]] seção "Workflow N8N". Geralmente via scripts Python (`fix_*.py`) que batem na API do N8N — PUT workflow + deactivate + activate (para invalidar cache de código).
