# Skills — Sistema de Comandos do Bot

Skills são atalhos de linguagem natural que o bot reconhece e executa. Cada skill tem um nome (começando com `/`) e um `prompt_base` que é injetado como instrução ao Claude quando o comando é detectado na mensagem.

**Status:** em produção. 6 skills ativas em 03/05/2026.

---

## Skills ativas (produção)

| Nome | Descrição |
|---|---|
| `/ajuda` | Lista todos os POPs e oferece ajuda ao usuário |
| `/relatorio` | Faz um relatório estruturado do que for pedido |
| `/chamados` | Lista chamados em aberto da última planilha importada |
| `/conversa` | Análise de conversas de vendas de internet |
| `/pendencias` | Analisa mensagens do dia e lista casos sem confirmação de resolução |
| `/olateste` | Teste (diz olá 10x) |

---

## Como funciona

O N8N busca skills ativas via `GET /api/skills/n8n` (token `x-token`) antes de montar o prompt. Se a mensagem começa com o nome da skill, o `prompt_base` é injetado no contexto.

O `prompt_base` pode usar `{PARAMETROS}` para capturar o que o usuário digitou após o nome da skill. Ex: `/relatorio das mensagens de hoje` → `{PARAMETROS}` = `das mensagens de hoje`.

---

## Schema — `dashboard_skills`

```sql
dashboard_skills (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(50) UNIQUE NOT NULL,   -- começa com '/', ex: '/relatorio'
  descricao TEXT,
  prompt_base TEXT NOT NULL,          -- instrução injetada ao Claude
  parametros_opcionais JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP
)
```

---

## APIs

| Rota | Auth | Função |
|---|---|---|
| `GET /api/skills` | admin session | lista todas (admin) |
| `POST /api/skills` | admin session | cria nova skill |
| `PUT /api/skills/[id]` | admin session | edita skill |
| `DELETE /api/skills/[id]` | admin session | exclui skill |
| `GET /api/skills/ativas` | session (qualquer) | lista ativas (para UI) |
| `GET /api/skills/n8n` | x-token | lista nome+prompt_base das ativas (para N8N) |

---

## UI — `/treinamento` aba "Skills"

CRUD completo de skills. Campo `parametros_opcionais` é JSON (array de strings descrevendo parâmetros esperados). Nome é normalizado: sempre minúsculo e começa com `/`.

---

## Prompt do relatório — configurável separadamente

O template de estrutura do `/relatorio` fica em `dashboard_config` com chave `relatorio_prompt` e é editável via `GET/PUT/DELETE /api/relatorio-prompt`. Tem um DEFAULT_PROMPT hardcoded como fallback.

**Importante:** o prompt do relatório usa placeholders `{PERIODO}` e `{DATA}` — não confundir com o system prompt do bot que usa `{{HOJE}}` etc.

---

## Pegadinhas

- Nome da skill deve começar com `/` — o código normaliza automaticamente no POST.
- `ON CONFLICT nome` retorna 409 — não deixa criar skill duplicada.
- Skills inativas (`ativo=false`) não aparecem no endpoint `/api/skills/n8n` — o N8N não as vê.
