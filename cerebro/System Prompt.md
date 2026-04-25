# System Prompt

← volta para [[Maluco da IA]] | renderizado em [[Workflow N8N]] | cacheado via [[Prompt Caching]]

O **system prompt** é o "manual de instruções" que define a personalidade, regras e contexto que o bot injeta em toda resposta. Editável pela [[Dashboard]].

## Onde fica

Tabela `dashboard_config`, linha com `chave = 'system_prompt'`, campo `valor` = texto com placeholders.

Editor: [[Dashboard]] em `/system-prompt` (admin only).

## Placeholders

O nó `Monta Prompt` substitui cada placeholder por valor dinâmico:

| Placeholder | Conteúdo |
|-------------|----------|
| `{{DATA}}` | Data por extenso ("segunda-feira, 21/04/2026") |
| `{{ANO}}` | Ano atual ("2026") |
| `{{TODAY}}` | ISO date ("2026-04-21") |
| `{{COLABORADORES}}` | Lista de [[Colaboradores]] com cargo/funções |
| `{{CLIENTES}}` | Base de [[Clientes]] resumida |
| `{{POPS}}` | [[POPs]] selecionados por relevância |
| `{{HISTORICO}}` | Últimas 10 msgs do grupo (no bloco dinâmico do cache) |
| `{{REGRAS}}` | [[Regras de Treinamento]] ativas |

## Estrutura típica

```
Você é o Maluco da IA 👽🍀, assistente interno da Zazz Internet...

DATA ATUAL: {{DATA}} ({{TODAY}})

FORMATAÇÃO OBRIGATÓRIA:
- Negrito: *texto* (um asterisco)
- PROIBIDO: ** ## ###

{{COLABORADORES}}
{{CLIENTES}}
{{POPS}}

REGRAS ADICIONAIS:
{{REGRAS}}

{{HISTORICO}}
```

## Limite de 50k chars

Se o template em `dashboard_config.valor` passar de 50.000 chars, o nó `Monta Prompt` trunca. Na prática o template normal fica em ~2-5k chars — o que infla são os POPs substituídos.

## Reset pro default

Se gravar `__RESET_TO_DEFAULT__` como valor, o nó usa um template hardcoded com as formatações básicas. Útil pra debug.

## Boas práticas

- **Seja específico em regras de formatação** — Haiku falha em formatação sem instrução explícita (ver [[Custos|trade-off Haiku vs Sonnet]])
- **Não duplique regras** — se algo já está em POP, não repetir no system prompt
- **Mude com parcimônia** — cada mudança invalida o cache (ver [[Prompt Caching]])
