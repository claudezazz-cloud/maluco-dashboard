# Chamados

← volta para [[Maluco da IA]] | ver também [[Dashboard]] e [[Banco de Dados]]

Importação de planilhas XLSX do sistema de gestão (IXC, SGP, etc) → o bot passa a responder perguntas sobre os chamados do dia.

## Fluxo

1. Admin ou [[Dashboard|Colaborador]] acessa `/chamados` aba **Chamados**
2. Faz upload de um `.xlsx` exportado do sistema de gestão
3. Dashboard parseia client-side (`XLSX.utils.sheet_to_json`) e manda JSON pra `/api/chamados`
4. Backend:
   - Mapeia colunas (COLUMN_MAP normaliza nomes — ex: "codigo_cliente" → "cod_cliente")
   - Monta `ai_context` (texto resumido pro Claude ler)
   - Calcula `resumo` (contagens por status/prioridade/bairro)
   - Salva no Redis: `SET chamados:data <json> EX 86400` (TTL 24h)

## Como o bot usa

No nó `Monta Prompt`:
```js
const chamadosData = JSON.parse(redisValue);
chamadosContext = '\n\n⚠️ CHAMADOS DO SISTEMA (ATUALIZADOS AGORA - DADOS OFICIAIS):\n'
  + 'REGRAS OBRIGATORIAS SOBRE CHAMADOS:\n'
  + '1. Os numeros no resumo abaixo sao EXATOS e PRE-CALCULADOS. NUNCA reconte.\n'
  + '2. Confie no resumo. NAO diga que precisa acessar outro sistema.\n\n'
  + chamadosData.ai_context.substring(0, 30000);
```

`chamadosContext` entra no **bloco cacheado** (ver [[Prompt Caching]]) porque raramente muda — fica estável pelas 24h do TTL.

## Truque da métrica

A contagem de chamados no `ai_context` é **pré-calculada no backend** (Node.js, determinístico) e injetada como texto. Claude só lê — nunca tenta recontar de novo. Isso evita erro de contagem em planilhas grandes.

## Permissões

Após o último ajuste, colaborador também pode importar/remover chamados (não só admin). A aba **Clientes** continua admin-only — ver [[Clientes]].

## Limpeza

Redis expira em 24h. Admin pode limpar antes pelo botão "Remover" na [[Dashboard]]. Fica limpo também após `FLUSHALL` ou restart do Redis se não configurado com persistência.

## Auto-import via Routerbox (abr/2026)

Como o Routerbox não libera API (alegação dos devs deles: multi-tenancy entre cidades), montamos um **Playwright headless** que faz o trabalho manual: loga, clica em **Botões → Excel**, captura o XLSX, e posta no dashboard. Roda no VPS via cron de hora em hora.

**Localização do código:** `routerbox-auto/scrape.js` na raiz do projeto. Documentação detalhada em `routerbox-auto/README.md`.

**Endpoint dedicado:** `POST /api/chamados/auto-import` — autenticação via header `x-auto-token` (env `CHAMADOS_AUTO_TOKEN`), igual ao padrão do `/api/pops-n8n`. Reutiliza `_processor.js` da pasta de chamados (mesma lógica de mapping/resumo/Redis), então o bot consome do mesmo lugar — zero mudança no [[Workflow N8N]].

**Cron sugerido:**
```
5 * * * * cd /opt/zazz/routerbox-auto && /usr/bin/node scrape.js >> /var/log/routerbox-auto.log 2>&1
```

**Pontos de atenção quando o Routerbox mudar layout:**
- Seletores de login (`input[name="usuario|user|login"]` etc) — script tenta vários
- URL `/routerbox/app_menu/app_menu.php?menu=atendimentos` — hardcoded
- Texto do dropdown "Botões" → "Excel" — locator por texto, ajustar se renomearem

Em erro, screenshot full-page é salvo em `routerbox-auto/screenshots/`. Sempre testar com `DRY_RUN=1` antes.

**Por que este caminho:** caminho A (acessar DB do Routerbox direto) seria ideal mas exigiria credencial do servidor deles, que não temos. Pressionar formalmente o vendor pra liberar API multi-tenant (com tokens scoped por cidade) é caminho longo. Scraping resolve em 1 dia.

## Custo

Zero adicional — Playwright + cron rodam no mesmo VPS Hostinger ([[Infraestrutura]]).
