# Como Funciona a Importação de Chamados (XLSX → Redis → Bot)

## Visão Geral do Fluxo

```
Planilha XLSX → Browser (parse local) → API /api/chamados → Redis → N8N lê → Claude responde
```

O processo tem **3 etapas principais**:
1. O navegador lê a planilha XLSX localmente (sem enviar o arquivo pro servidor)
2. Os dados parseados são enviados como JSON para a API do dashboard
3. A API processa, formata para a IA entender, e salva no Redis com validade de 24h

---

## Etapa 1: Frontend — Leitura da Planilha no Navegador

**Arquivo:** `dashboard/app/chamados/page.jsx`

Quando o admin arrasta ou seleciona um arquivo `.xlsx`, o navegador faz todo o trabalho pesado de ler a planilha — o arquivo **nunca é enviado para o servidor**.

### 1.1 Upload do arquivo

```jsx
// O input file fica escondido, o click é delegado pela div de drag-and-drop
<input
  ref={fileRef}
  type="file"
  accept=".xlsx,.xls"
  className="hidden"
  onChange={e => handleFile(e.target.files?.[0])}
/>
```

O usuário pode:
- **Clicar** na área de upload (dispara o `<input>` escondido)
- **Arrastar** o arquivo (eventos `onDragOver`, `onDragLeave`, `onDrop`)

### 1.2 Parse do XLSX no navegador

```jsx
async function parseXLSX(file) {
  // A biblioteca xlsx é importada DINAMICAMENTE (só carrega quando precisa)
  const XLSX = await import('xlsx')

  // Lê o arquivo como ArrayBuffer (bytes puros)
  const buffer = await file.arrayBuffer()

  // Converte os bytes para um workbook (objeto que representa a planilha)
  const wb = XLSX.read(buffer, { type: 'array' })

  // Pega a PRIMEIRA aba da planilha
  const sheet = wb.Sheets[wb.SheetNames[0]]

  // Converte para array de arrays: [[header1, header2, ...], [val1, val2, ...], ...]
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  // Primeira linha = cabeçalhos, resto = dados
  const headers = jsonData[0].map(h => String(h || '').trim())
  const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== ''))

  return { headers, rows, totalRows: rows.length }
}
```

**O que acontece aqui:**
- A lib `xlsx` (SheetJS) é carregada sob demanda (`dynamic import`)
- O arquivo é lido como bytes no navegador (não vai pro servidor)
- A planilha é convertida para um array de arrays
- Linha 0 = cabeçalhos (`["Numer", "Protocolo", "Pric", "Data Ab", ...]`)
- Linhas 1+ = dados (`["1234", "2024001", "Alta", "25/03/2026", ...]`)
- Linhas vazias são filtradas

### 1.3 Preview antes de enviar

Após o parse, o usuário vê uma tabela com as primeiras 10 linhas e pode:
- **Cancelar** (descarta tudo)
- **Enviar para o Bot** (chama a API)

### 1.4 Envio para a API

```jsx
async function enviarParaBot() {
  const r = await fetch('/api/chamados', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      headers: preview.headers,    // ["Numer", "Protocolo", "Pric", ...]
      chamados: preview.rows,      // [[val1, val2, ...], [val1, val2, ...], ...]
    }),
  })
}
```

**O que é enviado:** JSON com dois campos:
- `headers`: array de strings com os nomes das colunas
- `chamados`: array de arrays com os valores de cada linha

---

## Etapa 2: API — Processamento e Mapeamento de Colunas

**Arquivo:** `dashboard/app/api/chamados/route.js`

### 2.1 Mapeamento de colunas da planilha

A planilha vem com nomes de colunas do sistema IXC/SGP que variam (abreviados, com acento, etc). A API mapeia para nomes padronizados:

```javascript
const COLUMN_MAP = {
  'numer': 'numero',
  'numero': 'numero',
  'protocolo': 'protocolo',
  'pric': 'prioridade',
  'prioridade': 'prioridade',
  'data ab': 'data_abertura',
  'data abertura': 'data_abertura',
  'hora ab': 'hora_abertura',
  'agendamento': 'agendamento',
  'cod. cliente/mercado': 'cod_cliente',
  'cliente': 'cliente',
  'cidade': 'cidade',
  'bairro': 'bairro',
  'endereco': 'endereco',
  'tipo': 'tipo',
  'topico': 'topico',
  'situacao os': 'situacao',
  // ... mais mapeamentos
}
```

### 2.2 Normalização dos cabeçalhos

```javascript
function normalizeHeader(h) {
  return (h || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/\s+/g, ' ')                               // normaliza espaços
}
```

Exemplo: `"Situação OS"` → `"situacao os"` → mapeado para `"situacao"`

### 2.3 Conversão de rows para objetos

A API recebe arrays e converte para objetos com campos limpos:

```
ANTES (array):  ["1234", "2024001", "Alta", "25/03/2026", "Lunardelli", "Centro", "Instalação"]
HEADERS:        ["Numer", "Protocolo", "Pric", "Data Ab",   "Cidade",     "Bairro", "Tipo"]

DEPOIS (objeto):
{
  numero: "1234",
  protocolo: "2024001",
  prioridade: "Alta",
  data_abertura: "25/03/2026",
  cidade: "Lunardelli",
  bairro: "Centro",
  tipo: "Instalação"
}
```

### 2.4 Geração do Resumo Estatístico

```javascript
function buildSummary(chamados) {
  // Conta chamados por cidade, tipo, situação e bairro
  const porCidade = {}
  const porTipo = {}
  const porSituacao = {}
  const porBairro = {}

  for (const c of chamados) {
    porCidade[c.cidade] = (porCidade[c.cidade] || 0) + 1
    // ... mesma lógica para tipo, situacao, bairro
  }

  // Gera texto resumo
  return `Total: 33 chamados
Por cidade: Lunardelli (30), Paiçandu (1), Na fila (1), Em execução (1)
Por tipo: Técnico (33)
Por situacao: Não informado (30), Em execução (1), Na fila (1)
Por bairro (top 10): Centro (28), Primavera (1), Vila R... (1)`
}
```

### 2.5 Geração do Contexto para a IA

Esta é a parte mais importante — transforma os chamados em um formato compacto que a IA consegue ler:

```javascript
function buildAIContext(chamados, importadoEm) {
  const resumo = buildSummary(chamados)

  // Formato compacto: 1 linha por chamado (máximo 300)
  const linhas = chamados.slice(0, 300).map(c => {
    const parts = [
      c.numero ? `#${c.numero}` : '',                    // #1234
      c.cliente ? `${c.cliente} (${c.cod_cliente})` : '', // João Silva (5678)
      [c.cidade, c.bairro].filter(Boolean).join(', '),    // Lunardelli, Centro
      [c.tipo, c.topico].filter(Boolean).join(' - '),     // Técnico - Sem Conexão
      c.situacao || '',                                    // Em execução
      c.data_abertura ? `Aberto: ${c.data_abertura}` : '',
      c.agendamento ? `Agendado: ${c.agendamento}` : '',
      c.endereco ? `End: ${c.endereco}` : '',
    ].filter(Boolean)
    return parts.join(' | ')
  })

  // Monta o texto final
  return `CHAMADOS ABERTOS (importados em ${importadoEm}):
${resumo}

Detalhes dos chamados:
#1234 | João Silva (5678) | Lunardelli, Centro | Técnico - Sem Conexão | Em execução | Aberto: 25/03/2026
#1235 | Maria Santos (9012) | Lunardelli, Primavera | Técnico - Lentidão | Na fila | Aberto: 24/03/2026
... (1 linha por chamado, máximo 300)`
}
```

---

## Etapa 3: Armazenamento no Redis

**Arquivo:** `dashboard/lib/redis.js`

### 3.1 Conexão com o Redis

```javascript
import Redis from 'ioredis'

let redis = null  // Singleton - reutiliza a mesma conexão

export function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL  // ex: redis://user:senha@host:6379
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,  // só conecta quando necessário
    })
  }
  return redis
}
```

### 3.2 O que é salvo no Redis

```javascript
const REDIS_KEY = 'chamados:data'
const TTL = 86400  // 24 horas em segundos

const payload = {
  importado_em: "25/03/2026, 17:22:58",
  total: 33,
  resumo: "Total: 33 chamados\nPor cidade: Lunardelli (30)...",
  ai_context: "CHAMADOS ABERTOS (importados em 25/03/2026):\n...(texto completo para a IA)",
  chamados: [
    { numero: "1234", cliente: "João", cidade: "Lunardelli", ... },
    { numero: "1235", cliente: "Maria", cidade: "Lunardelli", ... },
    // ... todos os 33 chamados como objetos
  ]
}

// Salva como string JSON com TTL de 24h
await redis.set(REDIS_KEY, JSON.stringify(payload), 'EX', TTL)
```

**Estrutura da chave no Redis:**

```
Chave:   chamados:data
Tipo:    String (JSON)
TTL:     86400 segundos (24 horas)
Valor:   {"importado_em":"...", "total":33, "resumo":"...", "ai_context":"...", "chamados":[...]}
```

Após 24 horas, o Redis **apaga automaticamente** a chave (TTL expira).

---

## Etapa 4: Como o Bot Usa os Dados

**Arquivo:** `workflow.json` — Node "Busca Chamados Redis" + "Monta Prompt"

### 4.1 Leitura do Redis pelo N8N

O node "Busca Chamados Redis" faz um GET na chave `chamados:data`:
- Se a chave existe → retorna o JSON completo
- Se expirou (passou 24h) → retorna vazio

### 4.2 Inclusão no System Prompt

No "Monta Prompt", o código lê o valor do Redis e injeta no system prompt do Claude:

```javascript
let chamadosContext = '';
try {
  const cv = $('Busca Chamados Redis').first().json?.propertyName;
  if (cv) {
    const chamadosData = JSON.parse(cv);
    if (chamadosData.ai_context) {
      chamadosContext = '\n\n⚠️ CHAMADOS DO SISTEMA (DADOS REAIS):\n' + chamadosData.ai_context;
    }
  }
} catch(e) {}

// chamadosContext é adicionado ao system prompt enviado ao Claude
systemContent = rulesPrompt + chamadosContext + '\n' + systemContent;
```

### 4.3 Como a IA vê os dados

O Claude recebe no system prompt algo assim:

```
⚠️ CHAMADOS DO SISTEMA (DADOS REAIS - USE ESTES DADOS para responder sobre
chamados, ordens de servico, OS, atendimentos. NAO diga que precisa acessar
routerbox ou outro sistema. Voce JA TEM os dados abaixo):

CHAMADOS ABERTOS (importados em 25/03/2026, 17:22:58):
Total: 33 chamados
Por cidade: Lunardelli (30), Paiçandu (1)...
Por tipo: Técnico (33)
Por bairro (top 10): Centro (28), Primavera (1)...

Detalhes dos chamados:
#1234 | João Silva (5678) | Lunardelli, Centro | Técnico - Sem Conexão | Aberto: 25/03/2026
#1235 | Maria Santos (9012) | Lunardelli, Primavera | Técnico - Lentidão | Aberto: 24/03/2026
...
```

Agora quando alguém pergunta "quantos chamados abertos tem?" ou "tem chamado no bairro Centro?", o Claude tem os dados e responde diretamente.

---

## Diagrama Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN (Browser)                             │
│                                                                     │
│  1. Arrasta planilha .xlsx                                          │
│  2. Lib xlsx parseia no browser (não envia arquivo)                 │
│  3. Mostra preview (10 primeiras linhas)                            │
│  4. Admin clica "Enviar para o Bot"                                 │
│  5. Envia JSON: { headers: [...], chamados: [[...], [...]] }        │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ POST /api/chamados
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API (Next.js - Railway)                         │
│                                                                     │
│  1. Recebe JSON com headers + rows                                  │
│  2. Mapeia colunas: "Numer" → "numero", "Pric" → "prioridade"      │
│  3. Converte arrays para objetos limpos                             │
│  4. Gera resumo estatístico (por cidade, tipo, bairro)              │
│  5. Gera ai_context (formato compacto, 1 linha por chamado)         │
│  6. Salva tudo no Redis com TTL de 24h                              │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ redis.set('chamados:data', JSON, 'EX', 86400)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     REDIS (CloudFy)                                 │
│                                                                     │
│  Chave: chamados:data                                               │
│  Valor: { importado_em, total, resumo, ai_context, chamados[] }     │
│  TTL: 24 horas (expira automaticamente)                             │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ redis.get('chamados:data')
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     N8N WORKFLOW (CloudFy)                           │
│                                                                     │
│  1. Recebe mensagem do WhatsApp (Webhook)                           │
│  2. Node "Busca Chamados Redis" → GET chamados:data                 │
│  3. Node "Monta Prompt" → injeta ai_context no system prompt        │
│  4. Node "Claude API" → envia prompt com dados dos chamados         │
│  5. Claude responde usando os dados reais                           │
│  6. Resposta enviada de volta ao WhatsApp                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Pontos Importantes

- **O arquivo XLSX nunca sai do navegador** — só os dados parseados são enviados como JSON
- **Redis, não Postgres** — chamados ficam no Redis (temporário, 24h) e não no Postgres (permanente)
- **Máximo 300 chamados** no contexto da IA — se tiver mais, mostra os 300 primeiros
- **O bot precisa do mesmo Redis** — o dashboard (Railway) e o N8N (CloudFy) devem apontar para o mesmo servidor Redis
- **Expiração automática** — após 24h o Redis apaga a chave e o bot para de ter acesso aos chamados
