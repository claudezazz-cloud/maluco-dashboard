# Tool Choice Forçado — anti-alucinação

Quando uma mensagem do usuário tem intenção clara que exige uma tool específica, o agent loop FORÇA a chamada via `tool_choice: { type: 'tool', name: X }` na 1ª iteração.

Sem isso, Haiku 4.5 às vezes ignora a regra do system prompt e responde de memória/inventando.

## Padrões implementados (mai/2026)

### 1. `LEMBRETE_INTENT` → força `criar_lembrete`

**Status: ⚠️ STANDBY** — tool desativada, regex mantido por consistência

Regex: `/\b(me\s+lembr|me\s+avis|lembra\s+eu|lembrete|agend[ae]\s+(?:um\s+)?lembret|criar?\s+(?:um\s+)?lembret|fa[çc]a\s+(?:um\s+)?lembret)/i`

Histórico (Bug 19/21, mai/2026): Sonnet alucinava "Lembrete criado" em texto sem chamar a tool, copiando padrão de turnos antigos no histórico. tool_choice eliminou isso.

### 2. `CHAMADOS_INTENT` → força `buscar_chamados`

**Status: ATIVO**

Regex: `/(?:^|\s)\/(?:chamados?|relatorio|relat[óo]rio)\b|chamados?\s+em\s+aberto|chamados?\s+(?:de\s+)?hoje|fila\s+de\s+chamados?|resumo\s+(?:do\s+)?dia/i`

Cobre:
- `/chamados em aberto hoje`
- `/relatorio das mensagens...`
- `chamados em aberto`
- `chamados de hoje` / `chamados hoje`
- `fila de chamados`
- `resumo do dia` / `resumo dia`

Histórico mai/2026: depois que chamados saíram do system prompt e foram pra tool, Haiku 4.5 começou a inventar "não tenho chamados carregados" mesmo com Redis populado. tool_choice forçado obriga ele a buscar antes de responder.

## Como funciona no código

`v3_dump/agent_loop_code.js`, função do agent loop:

```js
const userTxt = lastUserText(messages);
const forceLembrete = LEMBRETE_INTENT.test(userTxt);
const forceChamados = CHAMADOS_INTENT.test(userTxt);
let forcedAlready = false;
let forcedChamadosAlready = false;

for (let i = 0; i < MAX_ITER; i++) {
  const body = { ...baseBody, messages };
  if (forceLembrete && !forcedAlready && i === 0) {
    body.tool_choice = { type: 'tool', name: 'criar_lembrete' };
    forcedAlready = true;
  }
  else if (forceChamados && !forcedChamadosAlready && i === 0) {
    body.tool_choice = { type: 'tool', name: 'buscar_chamados' };
    forcedChamadosAlready = true;
  }
  const resp = await callClaude(body);
  // ...
}
```

**Regra:** força só na 1ª iteração (`i === 0`). Depois disso a tool já foi chamada, próximas iterações são livres pro modelo decidir.

## Quando adicionar mais

**Bom candidato a tool_choice forçado:**
- Mensagem tem padrão claro que exige info externa
- Sem a tool, modelo provavelmente vai alucinar
- Bug observado em produção (não só hipotético)

**Não vale a pena:**
- Caso geral / dúvida genérica (deixa o modelo decidir)
- Quando múltiplas tools fariam sentido (ex: "como tá X" pode ser cliente, chamado ou tarefa — força só uma e perde as outras)

### 3. `CRIAR_NOTION_INTENT` → força `criar_tarefa_notion`

**Status: ATIVO** (implementado 07/05/2026)

Regex: `/(?:\bmarc[ao]\b|\banot[ao]\b|\bregistr[ao]\b)[^.!?]*\bnotion\b|\b(?:abr[eo]|cri[ao])\b[^.!?]*\b(?:tarefa|chamado)\b/i`

Exclusão: `/\bcomo\s+(?:ok|resolvid|conclu)\b/i` — evita conflito com resolver_tarefa_notion

Cobre:
- "Marcar no Notion" / "Marcar no Notion a mensagem acima"
- "Anota no Notion" / "Registra no Notion"
- "Abre uma tarefa" / "Abre chamado"
- "Cria tarefa" / "Cria um chamado no Notion"

Não dispara para:
- "Marcar como Ok" / "Marcar como resolvido" (exclusão RESOLVER_EXCL)
- Mensagens que não têm verbo de criação + notion/tarefa

Histórico (07/05/2026): Haiku alucinava "já está registrada no Notion" sem chamar nenhuma tool (exec 59447: `tools called = []`). A tarefa "Cobrar assinatura - Amanda Caroline" nunca foi criada. tool_choice forçado elimina a alucinação.

## Próximos candidatos sugeridos (TODO)

### `BUSCAR_POP_INTENT` → força `buscar_pop`

Quando: msg pergunta sobre processo/procedimento.

Regex sugerido (NÃO testado):
```js
/\b(como\s+(?:fa[çc]o|fazer|funciona|proceder)|qual\s+(?:o\s+)?(?:processo|procedimento|fluxo|pop)|passo\s+a\s+passo|me\s+ensina|posso\s+(?:fazer|resolver))/i
```

Cuidado: pop precisa de argumento `titulo`. O tool_choice força a CHAMADA mas o modelo escolhe qual POP buscar. Se ele errar o título, retorna POP errado e fala bobagem.

Solução melhor: pre-injetar primeiro `listar_pops()` (tool nova) → bot sabe os títulos exatos → depois `buscar_pop`. Mas isso é complexidade extra.

### `BUSCAR_CLIENTE_INTENT` → força `buscar_cliente`

Quando: msg cita nome/código de cliente que precisa identificação.

Cuidado: cliente é mencionado em muitas situações (criar tarefa, conferir cadastro, registrar problema). Força demais pode causar `buscar_cliente` excessivo. Provavelmente NÃO vale a pena forçar — deixa o modelo decidir.

## Limitações do tool_choice

1. **Só funciona em modelos da Anthropic** — se trocar pra Gemini/GPT, o formato é diferente.
2. **Custa tokens** — mesmo forçado, o modelo recebe a definição de TODAS as tools (TOOLS array). Cache ajuda.
3. **Pode "confundir" o modelo** — se ele já chamou a tool num turno anterior, forçar de novo pode resultar em chamada duplicada (mitigado pelo `forcedAlready` flag — só na 1ª iter).
4. **Não substitui prompt rules** — system prompt ainda deve ter regras claras pra cobrir casos que o regex não pega.

## Testar mudanças

```bash
# Testa que /chamados força buscar_chamados
TS=$(date +%s) && curl -s -X POST 'https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp' \
  -H 'Content-Type: application/json' \
  -d "{\"event\":\"messages.upsert\",\"data\":{\"key\":{\"remoteJid\":\"554391663335@s.whatsapp.net\",\"fromMe\":false,\"id\":\"TEST_$TS\"},\"message\":{\"conversation\":\"/chamados em aberto\"},\"messageTimestamp\":$TS,\"pushName\":\"Franquelin\"}}"

# Verifica resposta
ssh root@195.200.7.239 "docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c 'SELECT id, LEFT(resposta, 200) FROM bot_conversas ORDER BY id DESC LIMIT 1'"
```

Resposta esperada: dados reais de chamados (ex: "Total de chamados: 36, ..."). Se vier "não tenho chamados carregados" → o tool_choice falhou OU o regex não casou.

---

**Ver também:** [[Chamados]] · [[Relatorios]] · [[Notion]] · [[Workflow N8N]] · [[agent-loop-tool-use]] · [[bugs-abertos]]
