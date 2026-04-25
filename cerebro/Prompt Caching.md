# Prompt Caching

← volta para [[Maluco da IA]] | implementação em [[Workflow N8N]]

Otimização de custo nativa da Anthropic — a API guarda em cache blocos de texto estáveis, e cobra **10% do preço** quando reusa o cache em chamadas seguintes.

## Por que implementamos

O bot envia ~15-18k tokens de contexto em toda chamada (POPs + CLIENTES + COLABORADORES + template). 90% disso não muda entre uma mensagem e outra. Pagar preço cheio por esse bloco toda vez era desperdício.

## Como funciona no bot

O nó `Monta Prompt` separa o `system` em 2 content blocks antes de entregar pro `Claude API`:

1. **Bloco estável** — marcado com `cache_control: {"type": "ephemeral"}`:
   - Template renderizado com POPs, CLIENTES, COLABORADORES, DATA
   - `chamadosContext` (estável por 24h — Redis TTL)
   - `tarefasContext` (Notion, estável por 10min — ver [[Workflow N8N]])

2. **Bloco dinâmico** (sem cache):
   - `historicoSection` — últimas 10 mensagens do grupo
   - `rulesPrompt` — regras de treinamento (pode mudar a qualquer momento)
   - `skillContext` — prompt da skill ativada (varia por mensagem)

A divisão usa o marker `__CACHE_SPLIT__` no lugar do `{{HISTORICO}}` durante a renderização do template. No return, o código dá `split` no marker e monta o array de blocks.

## TTL e janela de cache

- **Default (ephemeral 5min)** — 1ª chamada grava (custa 1.25x do input), próximas 5 min leem do cache (10% do preço)
- **1 hora (disponível)** — pagando 2x pra gravar, cache vive 1h. Não usamos (conversas do bot raramente ficam ativas por tanto tempo)

## Como conferir se tá funcionando

No retorno do nó `Claude API`, o campo `usage` traz:

```json
{
  "input_tokens": 2814,              // parte dinâmica
  "cache_creation_input_tokens": 16807,   // gravado no cache
  "cache_read_input_tokens": 0,      // lido do cache (0 = primeira chamada)
  "cache_creation": {
    "ephemeral_5m_input_tokens": 16807
  },
  "output_tokens": 37
}
```

- `cache_creation_input_tokens > 0` → gravou cache (1ª da janela)
- `cache_read_input_tokens > 0` → hit! leu do cache (2ª+ na janela)
- Ambos zero → não tá funcionando, investigar

## Economia real

Numa "oi" simples do bot:

| Modo | Input tokens | Custo Haiku 4.5 |
|------|--------------|-----------------|
| **Sem cache** | 19.6k × $1/MTok | ~$0.020 |
| **Cache creation** (1ª msg) | 2.8k × $1 + 16.8k × $1.25 | ~$0.024 |
| **Cache hit** (2ª+ em 5 min) | 2.8k × $1 + 16.8k × $0.10 | **~$0.005** |

**Redução de ~75%** por mensagem em cache hit. Em 20 msgs/dia, derruba a conta de ~$7 pra ~$2–3/mês.

## Fallback

Se o branch sem template for usado (DB sem `system_prompt`), o `system` volta a ser string simples — não há cache mas tudo funciona. Ver código em `Monta Prompt` dentro do `workflow_v2.json`.
