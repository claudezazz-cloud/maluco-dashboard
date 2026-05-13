# Isolamento de tarefas por grupo (Internet vs Design)

Implementado em 07-09/05/2026. Resolve bug onde relatórios do grupo Internet mostravam tarefas de Gráfica (Adesivo, Carimbo) e vice-versa.

## Configuração base (já existia)

Tabela `grupos_whatsapp.tipos_filtro_entrega[]` já tinha os tipos por grupo:
- **Nego's Internet** (`554384924456-1616013394@g.us`) → `{Internet, Equip. Perdido, Telefone Fixo, Zazz}`
- **Sub** (`554384452261-1633035269@g.us`) → `{Acrílico, Carimbo, Adesivo, Fachada, ...24 tipos}`

## O que foi implementado

### 1. Endpoint novo — `/api/grupos/tipos`

`dashboard/app/api/grupos/tipos/route.js` — retorna os tipos do grupo pelo chatId:
```
GET /api/grupos/tipos?chatId=554384924456-1616013394@g.us
→ {"tipos":["Internet","Equip. Perdido","Telefone Fixo","Zazz"]}
```
Autenticado via `x-token: MALUCO_POPS_2026`.

### 2. Filtro no `tarefasContext` (Monta_Prompt.js)

No início do `Monta_Prompt.js`, antes de montar o tarefasContext:
```js
// Chamada HTTP ao dashboard para obter tipos do grupo
let grupoTipos = [];
try {
  let _gChatId = '';
  try { _gChatId = $('Verifica Menção').first().json?.chatId || ''; } catch(e) {}
  // ... outros fallbacks ...
  if (_gChatId) {
    const _gr = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://dashboard.srv1537041.hstgr.cloud/api/grupos/tipos?chatId=' + encodeURIComponent(_gChatId),
      headers: { 'x-token': 'MALUCO_POPS_2026' }
    });
    grupoTipos = (_gr?.tipos || []).map(t => t.toLowerCase());
  }
} catch(e) {}

// Filtro aplicado antes de montar linhas:
const results = grupoTipos.length > 0
  ? allNotionResults.filter(p => {
      const tiposTask = (p.properties?.Tipo?.multi_select || []).map(t => t.name.toLowerCase());
      return tiposTask.length === 0 || tiposTask.some(t => grupoTipos.includes(t));
    })
  : allNotionResults;
```

**Pegadinha:** `_vM_early` não está disponível na linha 40 onde esse código roda (é setado depois). Usar `$('Verifica Menção').first().json?.chatId` direto.

### 3. Filtro no `listar_tarefas_notion` TOOL (agent_loop_code.js)

Após receber os resultados do Notion, antes de formatar:
```js
// Filtro por grupo
const chatId = $input.first().json.chatId || $input.first().json.chat_id || '';
if (chatId) {
  const grupoResp = await http({
    method: 'GET',
    url: `${DASH_BASE}/api/grupos/tipos?chatId=${encodeURIComponent(chatId)}`,
    headers: { 'x-token': DASH_TOKEN }
  });
  const grupoTipos = (grupoResp.body?.tipos || []).map(t => t.toLowerCase());
  if (grupoTipos.length > 0) {
    results = allNotionResults.filter(p => {
      const tipos = (p.properties?.Tipo?.multi_select || []).map(t => t.name.toLowerCase());
      return tipos.length === 0 || tipos.some(t => grupoTipos.includes(t));
    });
  }
}
```

## Comportamento

- Grupo sem config (Diário Zazz, Claudebot2) → mostra todas as tarefas (comportamento original)
- Grupo com config → filtra por tipo em AMBOS os caminhos:
  1. `tarefasContext` injetado no system prompt
  2. Resultado da tool `listar_tarefas_notion` quando chamada durante conversa ou relatório

## Problemas encontrados durante implementação

1. **Postgres array retorna como objeto n8n com pointers** — tentar ler `tipos_filtro_entrega` via `$('Busca Grupo Atual')` era não-confiável porque os valores são ponteiros internos do n8n, não strings. Solução: fazer chamada HTTP direta ao dashboard.

2. **`$('Busca Grupo Atual')` pode não estar no escopo** — o nó conecta em `Busca Memoria Contexto`, não diretamente em `Monta Prompt`. Em Code nodes n8n, `$('node')` só é confiável para nós na mesma branch de execução. Solução: HTTP ao endpoint.

3. **`_vM_early` não disponível na linha 40** — o grupoTipos precisa do chatId mas `_vM_early` só é setado na linha ~159. Solução: ler `$('Verifica Menção').first().json?.chatId` diretamente.

## Ver também

[[Notion]] · [[Workflow N8N]] · [[agent-loop-tool-use]] · [[arquitetura-geral]]
