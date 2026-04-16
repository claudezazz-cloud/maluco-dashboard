# Guia de Estudo — Maluco da IA

Este guia foi feito sob medida para voce estudar as tecnologias do seu proprio projeto.
Cada topico tem: o que e, como funciona no seu projeto, o que pesquisar, e exercicios praticos.

---

## NIVEL 1 — FUNDAMENTOS (comece por aqui)

---

### 1.1 Como a internet funciona (HTTP, APIs, Webhooks)

#### O que e
Toda vez que voce abre um site ou o bot responde uma mensagem, isso acontece via **HTTP** — um protocolo de comunicacao entre computadores. O navegador (ou o N8N) faz um **request** (pedido) e o servidor devolve um **response** (resposta).

#### Tipos de request que seu projeto usa
| Metodo | Significado | Exemplo no seu projeto |
|--------|------------|----------------------|
| **GET** | "Me da essa informacao" | Dashboard busca lista de POPs: `GET /api/pops` |
| **POST** | "Salva/processa isso" | N8N envia mensagem pro Claude: `POST https://api.anthropic.com/v1/messages` |
| **PUT** | "Atualiza isso" | Dashboard edita system prompt: `PUT /api/system-prompt` |
| **DELETE** | "Apaga isso" | Dashboard limpa erros antigos: `DELETE /api/erros` |

#### O que e uma API
API (Application Programming Interface) e um "contrato" entre dois sistemas. Quando o N8N chama `https://api.anthropic.com/v1/messages`, ele esta dizendo:
- "Eu vou te mandar um JSON com model, system e messages"
- "Voce me devolve um JSON com a resposta do Claude"

Cada API tem sua **documentacao** explicando o que mandar e o que receber.

#### O que e um Webhook
Webhook e o inverso de uma API normal. Em vez de VOCE pedir informacao, voce diz: "quando acontecer algo, ME AVISA nessa URL".

No seu projeto, o webhook funciona assim:
1. Voce configurou na Evolution API: "quando chegar mensagem no WhatsApp, manda para `https://seu-n8n.app/webhook/whatsapp`"
2. Quando alguem manda "oi" no grupo, a Evolution API faz um POST para essa URL
3. O N8N recebe e inicia o workflow

#### O que pesquisar
- "HTTP request response explained" (YouTube)
- "What is a REST API" (YouTube)
- "Webhook vs API difference" (YouTube)
- "HTTP status codes" — 200 (ok), 401 (nao autorizado), 500 (erro no servidor)
- "What is JSON" — o formato que todas as suas APIs usam

#### Exercicio pratico
1. Abra o navegador e acesse: `https://maluco-dashboard-production.up.railway.app/api/auth/me`
2. Voce vai ver `{"error":"..."}` — isso e uma resposta JSON de uma API que voce construiu!
3. No N8N, abra o no "Claude API" e veja: o URL, os headers, o body — tudo isso e um request HTTP

---

### 1.2 O que e JSON

#### O que e
JSON (JavaScript Object Notation) e o formato universal para trocar dados entre sistemas. E basicamente um texto organizado em chaves e valores.

#### Exemplo real do seu projeto
Quando o N8N manda uma mensagem para o Claude, o body e assim:
```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 2048,
  "system": "Voce e o assistente da Zazz Internet...",
  "messages": [
    {"role": "user", "content": "como faco uma nova venda?"}
  ]
}
```

E o Claude responde:
```json
{
  "content": [
    {"type": "text", "text": "Para fazer uma nova venda, siga estes passos..."}
  ],
  "usage": {
    "input_tokens": 2000,
    "output_tokens": 350
  }
}
```

#### Conceitos importantes
- **Objeto** `{}` — conjunto de chave:valor. Ex: `{"nome": "Franquelin", "cargo": "admin"}`
- **Array** `[]` — lista de itens. Ex: `["POP 1", "POP 2", "POP 3"]`
- **Aninhamento** — objetos dentro de objetos. Ex: `{"usage": {"input_tokens": 2000}}`
- Para acessar: `response.usage.input_tokens` → 2000

#### O que pesquisar
- "JSON explained for beginners" (YouTube)
- "JSON vs XML" (para entender por que JSON venceu)
- Site: jsonformatter.org — cole JSON para visualizar formatado

---

### 1.3 Variaveis de ambiente (Environment Variables)

#### O que e
Sao valores secretos ou configuraveis que ficam FORA do codigo. Em vez de escrever a senha do banco direto no codigo (perigoso!), voce coloca numa variavel de ambiente.

#### No seu projeto (Railway)
Voce configurou estas variaveis no Railway:
| Variavel | O que faz |
|----------|-----------|
| `PG_URL` | Endereco completo do PostgreSQL (usuario, senha, host, porta, banco) |
| `JWT_SECRET` | Chave secreta para gerar tokens de login da dashboard |
| `N8N_URL` | Endereco do seu N8N Cloud |
| `N8N_API_KEY` | Chave para a dashboard consultar o N8N |

#### Como o codigo usa
No arquivo `lib/db.js` do seu projeto:
```javascript
const pool = new Pool({
  connectionString: process.env.PG_URL,  // <-- le a variavel de ambiente
})
```
O `process.env.PG_URL` pega o valor que voce configurou no Railway. O codigo NUNCA ve a senha real.

#### Por que isso importa
- Se voce colocar a senha direto no codigo e fizer push pro GitHub, **qualquer pessoa** pode ver
- Foi exatamente o que aconteceu com a chave da Anthropic — o GitHub detectou e bloqueou
- Variaveis de ambiente ficam APENAS no servidor (Railway), nunca no repositorio

#### O que pesquisar
- "Environment variables explained" (YouTube)
- "Why you should never hardcode passwords"
- "dotenv nodejs" — biblioteca para usar .env em desenvolvimento local
- No Railway: Settings > Variables — veja como suas variaveis estao configuradas

---

## NIVEL 2 — BANCO DE DADOS

---

### 2.1 O que e um banco de dados relacional (PostgreSQL)

#### O que e
Um banco de dados relacional organiza informacoes em **tabelas** (como planilhas do Excel). Cada tabela tem **colunas** (campos) e **linhas** (registros). O PostgreSQL (ou "Postgres") e um dos mais usados no mundo.

#### Analogia
Pense no PostgreSQL como um **Excel turbinado**:
- Cada **tabela** e uma aba da planilha
- Cada **coluna** e um cabecalho (Nome, Email, Cargo)
- Cada **linha** e um registro (Franquelin, frank@email.com, Admin)
- A diferenca: o Postgres guarda milhoes de linhas, e rapido, e seguro, e varios sistemas podem acessar ao mesmo tempo

#### Tabelas do seu projeto
Voce tem **8 tabelas** no PostgreSQL. Aqui estao as principais:

```
mensagens              → Todas as mensagens do grupo WhatsApp
dashboard_pops         → Procedimentos operacionais da empresa
regras                 → Regras de comportamento do bot
dashboard_config       → Configuracoes (system prompt)
dashboard_colaboradores → Colaboradores da equipe
dashboard_filiais      → Filiais da empresa
bot_conversas          → Historico de interacoes do bot
bot_erros              → Log de erros
```

#### Como uma tabela e criada
No seu arquivo `app/api/pops/route.js`:
```sql
CREATE TABLE IF NOT EXISTS dashboard_pops (
  id SERIAL PRIMARY KEY,          -- numero automatico, unico
  titulo VARCHAR(255) NOT NULL,   -- texto de ate 255 caracteres, obrigatorio
  categoria VARCHAR(255),         -- texto opcional
  conteudo TEXT NOT NULL,          -- texto longo, obrigatorio
  ativo BOOLEAN DEFAULT true,     -- verdadeiro/falso, padrao = true
  criado_em TIMESTAMP DEFAULT NOW(),     -- data/hora, padrao = agora
  atualizado_em TIMESTAMP DEFAULT NOW()  -- data/hora, padrao = agora
)
```

**Traduzindo cada parte:**
- `SERIAL PRIMARY KEY` → numero que aumenta sozinho (1, 2, 3...) e identifica cada linha de forma unica
- `VARCHAR(255)` → texto com limite de 255 caracteres
- `TEXT` → texto sem limite de tamanho
- `NOT NULL` → campo obrigatorio (nao pode ficar vazio)
- `DEFAULT true` → se nao informar, assume "true"
- `DEFAULT NOW()` → se nao informar, usa a data/hora atual

#### O que pesquisar
- "SQL tutorial for beginners" (YouTube — recomendo o canal "Programming with Mosh")
- "PostgreSQL data types" — VARCHAR, TEXT, INTEGER, BOOLEAN, TIMESTAMP, SERIAL
- "Primary key explained"
- "SQL CREATE TABLE tutorial"
- Site interativo: sqlbolt.com — exercicios de SQL no navegador (excelente!)

---

### 2.2 SQL — A linguagem do banco de dados

#### O que e
SQL (Structured Query Language) e a linguagem que voce usa para "conversar" com o banco. Existem 4 operacoes basicas (CRUD):

#### CREATE (inserir dados)
Quando o N8N salva uma conversa:
```sql
INSERT INTO bot_conversas (chat_id, remetente, mensagem, resposta, tokens_input, tokens_output)
VALUES ('5543991663335@s.whatsapp.net', 'Franquelin', 'oi', 'Opa, tudo certo!', 2000, 150)
```
Isso cria uma nova linha na tabela `bot_conversas`.

#### READ (ler dados)
Quando a dashboard mostra as conversas:
```sql
SELECT * FROM bot_conversas ORDER BY criado_em DESC LIMIT 30
```
Traduzindo: "Me da TODAS as colunas da tabela bot_conversas, ordenadas da mais recente para a mais antiga, limitado a 30 resultados."

Outros exemplos do seu projeto:
```sql
-- Busca POPs ativos
SELECT titulo, categoria, conteudo FROM dashboard_pops WHERE ativo = true

-- Conta mensagens de hoje
SELECT COUNT(*) as total FROM mensagens
WHERE DATE(data_hora) = CURRENT_DATE

-- Busca com filtro de texto (a busca da dashboard)
SELECT * FROM bot_conversas
WHERE mensagem ILIKE '%nova venda%' OR resposta ILIKE '%nova venda%'
```

**Palavras-chave importantes:**
- `SELECT` — quais colunas quero
- `FROM` — de qual tabela
- `WHERE` — filtro (so me da linhas que atendem esta condicao)
- `ORDER BY` — ordenacao (ASC = crescente, DESC = decrescente)
- `LIMIT` — quantidade maxima de resultados
- `ILIKE` — busca de texto sem diferenciar maiusculo/minusculo
- `COUNT(*)` — conta quantas linhas existem

#### UPDATE (atualizar dados)
Quando voce edita um POP na dashboard:
```sql
UPDATE dashboard_pops
SET titulo = 'Novo titulo', conteudo = 'Novo conteudo', atualizado_em = NOW()
WHERE id = 5
```

#### DELETE (apagar dados)
Quando a dashboard limpa erros antigos:
```sql
DELETE FROM bot_erros WHERE criado_em < NOW() - INTERVAL '7 days'
```
Traduzindo: "Apaga todos os erros criados ha mais de 7 dias."

#### O que pesquisar
- sqlbolt.com — FACA TODOS os exercicios (sao curtos e praticos)
- "SQL SELECT WHERE ORDER BY tutorial"
- "SQL INSERT UPDATE DELETE tutorial"
- "SQL ILIKE vs LIKE PostgreSQL"
- "SQL JOIN explained" — quando voce precisar cruzar dados de 2 tabelas

#### Exercicio pratico
Se voce tiver acesso ao PostgreSQL (via pgAdmin, DBeaver, ou o terminal do CloudFy):
```sql
-- Veja quantas conversas o bot ja teve
SELECT COUNT(*) FROM bot_conversas;

-- Veja os 5 ultimos erros
SELECT * FROM bot_erros ORDER BY criado_em DESC LIMIT 5;

-- Veja quais POPs existem
SELECT id, titulo, categoria, ativo FROM dashboard_pops;
```

---

### 2.3 Full-Text Search (busca semantica do PostgreSQL)

#### O que e
E o recurso que voce usa para o bot encontrar POPs relevantes. Em vez de buscar palavra exata (`LIKE '%venda%'`), o full-text search entende portugues — ele sabe que "vendas" e "venda" sao a mesma coisa, ignora palavras irrelevantes como "de", "para", "uma", etc.

#### Como funciona no seu projeto
Quando alguem pergunta "como funciona o processo de nova venda?", a query faz:

```sql
SELECT titulo, categoria,
  CASE WHEN to_tsvector('portuguese', titulo || ' ' || LEFT(conteudo,1000))
            @@ plainto_tsquery('portuguese', 'como funciona processo nova venda')
    THEN conteudo   -- inclui conteudo completo (POP relevante)
    ELSE ''         -- nao inclui conteudo (POP irrelevante)
  END as conteudo
FROM dashboard_pops WHERE ativo = true
ORDER BY ts_rank(...) DESC
```

**Decompondo:**
1. `to_tsvector('portuguese', texto)` — transforma o texto em "vetor de busca", removendo acentos, conjugacoes, etc.
   - "Processo e fluxograma de uma nova venda" → `'fluxogram':2 'nov':5 'process':1 'vend':6`
2. `plainto_tsquery('portuguese', 'nova venda')` — transforma a busca do usuario
   - "nova venda" → `'nov' & 'vend'`
3. `@@` — operador de match. Retorna `true` se o vetor contem os termos da busca
4. `ts_rank()` — da uma nota de 0 a 1 de quao relevante e o resultado

#### O que pesquisar
- "PostgreSQL full text search tutorial"
- "to_tsvector plainto_tsquery explained"
- "PostgreSQL text search vs LIKE performance"
- Documentacao oficial: postgresql.org/docs/current/textsearch.html

---

### 2.4 Redis — Banco de dados em memoria

#### O que e
Redis e um banco de dados que guarda tudo na **memoria RAM** (nao no disco). Isso o torna extremamente rapido (microsegundos), mas os dados podem se perder se o servidor reiniciar.

#### Diferenca entre Redis e PostgreSQL
| | PostgreSQL | Redis |
|-|-----------|-------|
| Onde guarda | Disco (HD/SSD) | Memoria RAM |
| Velocidade | Rapido | Ultra rapido |
| Estrutura | Tabelas com colunas | Chave → Valor (como dicionario) |
| Dados persistem | Sim, para sempre | Pode perder ao reiniciar* |
| Melhor para | Dados permanentes (conversas, POPs, usuarios) | Dados temporarios (cache, sessoes, historico recente) |

*O Redis PODE ser configurado para salvar no disco tambem, mas o uso principal e como cache.

#### Como voce usa no projeto
O Redis guarda o historico de conversa do bot:

```
Chave: "history:5543991663335@s.whatsapp.net"
Valor: [
  {"role": "user", "content": "oi"},
  {"role": "assistant", "content": "Opa, tudo certo!"},
  {"role": "user", "content": "como faco uma nova venda?"},
  {"role": "assistant", "content": "Para fazer uma nova venda..."}
]
```

**Por que Redis e nao PostgreSQL para isso?**
- O historico muda a CADA mensagem (leitura + escrita constante)
- So precisamos das ultimas 8 interacoes (dados temporarios)
- Redis e muito mais rapido para esse tipo de operacao
- Se o historico se perder, nao e grave — o bot so perde o contexto recente

#### O que pesquisar
- "Redis explained in 100 seconds" (YouTube — Fireship)
- "Redis vs PostgreSQL when to use"
- "Redis data types" — String, List, Hash, Set
- "Redis key-value store tutorial"

---

## NIVEL 3 — DESENVOLVIMENTO WEB

---

### 3.1 JavaScript basico

#### O que e
JavaScript e a linguagem de programacao que roda tanto no **navegador** (frontend da dashboard) quanto no **servidor** (API routes, N8N Code nodes). Todo o seu projeto usa JavaScript.

#### Conceitos que aparecem no seu projeto

**Variaveis (let, const)**
```javascript
const chatId = '5543991663335@s.whatsapp.net'  // valor fixo, nao muda
let mensagem = 'oi'                             // valor que pode mudar
```

**Arrays (listas)**
```javascript
const pops = ['Nova Venda', 'Cobranca', 'Troca de Titularidade']
pops.length           // 3
pops[0]               // 'Nova Venda' (comeca do zero!)
pops.map(p => p.toUpperCase())  // ['NOVA VENDA', 'COBRANCA', ...]
pops.filter(p => p.includes('Venda'))  // ['Nova Venda']
```

**Objetos**
```javascript
const usuario = {
  nome: 'Franquelin',
  role: 'admin',
  email: 'frank@zazz.com'
}
usuario.nome       // 'Franquelin'
usuario.role       // 'admin'
```

**async/await (operacoes assincronas)**
Quando o codigo precisa esperar algo (buscar dados do banco, chamar uma API):
```javascript
// Isso aparece em TODA a sua dashboard:
async function fetchPops() {
  const r = await fetch('/api/pops')  // espera a resposta da API
  if (r.ok) {
    const dados = await r.json()      // espera converter para JSON
    setPops(dados)                     // atualiza a tela
  }
}
```
O `await` diz: "espera isso terminar antes de continuar". Sem ele, o codigo continuaria sem ter os dados.

**try/catch (tratamento de erros)**
```javascript
try {
  const resultado = await fetch('/api/pops')
  // se der certo, continua aqui
} catch (erro) {
  // se der errado, cai aqui
  console.log('Deu ruim:', erro.message)
}
```

#### O que pesquisar
- "JavaScript tutorial for beginners" (YouTube — recomendo "JavaScript Mastery")
- "JavaScript arrays map filter reduce"
- "async await JavaScript explained"
- "JavaScript try catch"
- "JavaScript destructuring" — o `const { nome, cargo } = await req.json()` que aparece no seu codigo
- Site interativo: javascript.info — tutorial completo e gratuito

---

### 3.2 React e Next.js (a dashboard)

#### O que e React
React e uma biblioteca para construir interfaces (telas). A ideia central: voce cria **componentes** (pecas de lego) e monta a tela juntando eles.

#### Componentes no seu projeto
```
Navbar          → barra de navegacao (aparece em todas as paginas)
StatusCard      → card de status de cada filial
ExecutionList   → lista de execucoes do N8N
ConversaCard    → card de cada conversa (expandivel)
TokenBadge      → badge que mostra quantidade de tokens
PopsBadges      → badges dos POPs usados
```

#### Como um componente funciona
Do seu arquivo `components/Navbar.jsx`:
```jsx
export default function Navbar({ user }) {      // recebe dados do "pai"
  return (
    <nav className="bg-[#1a1a24]">              {/* HTML com classes CSS */}
      <span>{user?.nome || user?.email}</span>   {/* mostra dados dinamicos */}
      {user?.role === 'admin' && (               {/* so mostra se for admin */}
        <Link href="/pops">POPs</Link>
      )}
    </nav>
  )
}
```

**Conceitos-chave:**
- `{ user }` — **props**: dados que o componente recebe
- `{user?.nome}` — **renderizacao dinamica**: mostra o valor da variavel
- `{user?.role === 'admin' && (...)}` — **renderizacao condicional**: so mostra se for admin
- `?.` — **optional chaining**: se user for null, nao da erro

#### O que e Next.js
Next.js e um framework que adiciona superpoderes ao React:
- **App Router** — cada pasta em `app/` vira uma pagina automaticamente
  - `app/dashboard/page.jsx` → URL `/dashboard`
  - `app/pops/page.jsx` → URL `/pops`
  - `app/conversas/page.jsx` → URL `/conversas`
- **API Routes** — cada pasta em `app/api/` vira um endpoint de API
  - `app/api/pops/route.js` → API `/api/pops` (GET, POST)
  - `app/api/erros/route.js` → API `/api/erros` (GET, POST, DELETE)
- **Server-Side Rendering** — paginas carregam mais rapido
- **Deploy facil** — Railway detecta Next.js automaticamente

#### useState e useEffect (os dois hooks mais importantes)

**useState** — cria uma variavel que, quando muda, atualiza a tela automaticamente:
```javascript
const [pops, setPops] = useState([])     // pops comeca como array vazio
// Quando voce faz setPops(novosDados), a tela re-renderiza mostrando os novos dados
```

**useEffect** — executa codigo quando a pagina carrega ou quando algo muda:
```javascript
useEffect(() => {
  // Isso roda quando a pagina carrega
  fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d))
}, [])  // [] = roda apenas 1 vez

useEffect(() => {
  // Isso roda toda vez que "page" ou "busca" mudam
  fetchConversas()
}, [page, busca])  // [page, busca] = roda quando esses valores mudam
```

#### O que pesquisar
- "React tutorial for beginners 2025" (YouTube)
- "React useState useEffect explained"
- "Next.js App Router tutorial"
- "Next.js API routes tutorial"
- "React props explained"
- "React conditional rendering"
- Site: react.dev — tutorial oficial interativo (excelente!)
- Site: nextjs.org/learn — curso oficial do Next.js (gratuito)

---

### 3.3 Tailwind CSS (o visual da dashboard)

#### O que e
Tailwind e um framework CSS onde voce estiliza direto no HTML usando classes utilitarias. Em vez de criar um arquivo CSS separado, voce aplica classes diretamente.

#### Exemplos do seu projeto
```jsx
<div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
```
Traduzindo cada classe:
- `bg-[#1a1a24]` → cor de fundo customizada (hex)
- `rounded-xl` → bordas arredondadas (extra large)
- `border` → borda de 1px
- `border-gray-800` → cor da borda (cinza escuro)
- `p-5` → padding (espacamento interno) de 1.25rem

#### Classes mais usadas no seu projeto
| Classe | O que faz |
|--------|-----------|
| `flex` | Elementos lado a lado |
| `grid grid-cols-3` | Grade de 3 colunas |
| `gap-4` | Espaco entre elementos |
| `text-white` | Texto branco |
| `text-sm` | Texto pequeno |
| `text-gray-400` | Texto cinza claro |
| `px-4 py-2` | Padding horizontal 4, vertical 2 |
| `mb-4` | Margem inferior |
| `hover:bg-gray-700` | Cor de fundo ao passar o mouse |
| `transition` | Animacao suave nas mudancas |
| `animate-pulse` | Animacao de "carregando" |
| `truncate` | Corta texto longo com "..." |

#### O que pesquisar
- "Tailwind CSS crash course" (YouTube)
- Site: tailwindcss.com/docs — documentacao com exemplos visuais
- "Tailwind CSS cheat sheet" — imagem com todas as classes

---

## NIVEL 4 — INTEGRACAO E AUTOMACAO

---

### 4.1 N8N — Como o workflow funciona

#### O que e
N8N e uma ferramenta de automacao visual. Voce conecta "nos" (blocos) que executam acoes: receber webhook, consultar banco, chamar API, processar dados, etc.

#### Tipos de nos no seu projeto
| Tipo | O que faz | Exemplo |
|------|-----------|---------|
| **Webhook** | Recebe requests externos | Evolution API manda mensagem do WhatsApp |
| **Code** | Executa JavaScript | Monta Prompt, Parse Resposta, Extrai Dados |
| **Postgres** | Executa SQL no banco | Busca POPs, Salva Conversa, Busca Regras |
| **Redis** | Le/escreve no Redis | Busca/Salva Historico |
| **HTTP Request** | Chama APIs externas | Claude API, Evolution API, Notion API, OpenAI |
| **IF** | Decisao condicional | Tem Notion? E Relatorio? E Treinamento? |
| **Filter** | Filtra dados | E Erro? Filter1 |
| **Schedule Trigger** | Executa em horario | Bom Dia (seg-sab 7:30) |

#### Como os nos se comunicam
Cada no passa dados para o proximo no formato JSON. Para acessar dados de nos anteriores:
```javascript
// Dados do no anterior (conectado diretamente)
$input.first().json.mensagem

// Dados de um no especifico (por nome)
$('Busca POPs').all()           // todos os resultados
$('Verifica Mencao').first().json.textMessage   // primeiro resultado, campo textMessage
```

#### O que pesquisar
- "n8n tutorial for beginners" (YouTube)
- "n8n expressions explained"
- "n8n code node JavaScript"
- Documentacao: docs.n8n.io
- Comunidade: community.n8n.io (tire duvidas la)

---

### 4.2 Autenticacao (JWT)

#### O que e
JWT (JSON Web Token) e como um "cracha digital". Quando voce faz login na dashboard:

1. Voce envia email + senha
2. O servidor verifica no banco se a senha esta correta
3. Se estiver, cria um **token** (string longa codificada) com seus dados
4. O token e salvo no cookie do navegador
5. Toda vez que voce acessa uma pagina, o navegador envia o token
6. O servidor verifica se o token e valido

#### No seu projeto (`lib/auth.js`)
```javascript
// Criar token (no login)
jwt.sign({ id: 1, email: 'frank@zazz.com', role: 'admin' }, SECRET, { expiresIn: '7d' })
// Resultado: "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZW1haWwiOi..."

// Verificar token (em cada request)
jwt.verify(token, SECRET)
// Se valido, retorna: { id: 1, email: 'frank@zazz.com', role: 'admin' }
// Se invalido/expirado: retorna null
```

#### Senha com hash (`bcryptjs`)
A senha NUNCA e salva como texto puro no banco. O `bcryptjs` transforma:
- "minha_senha_123" → "$2a$10$xKz7Qj.../kG5e3..."
- E impossivel reverter o hash para descobrir a senha original
- Para verificar, o bcrypt compara o hash da senha digitada com o hash salvo

#### O que pesquisar
- "JWT explained in 5 minutes" (YouTube)
- "How bcrypt works"
- "Cookie vs localStorage for auth tokens"
- "JWT vs session authentication"

---

### 4.3 APIs externas que voce usa

#### Anthropic (Claude API)
- **Documentacao**: docs.anthropic.com
- **O que estudar**: como funciona o parametro `system` (instrucoes do bot), `messages` (historico), `max_tokens` (limite de resposta), `usage` (tokens consumidos)
- **Modelos**: Haiku (rapido/barato), Sonnet (equilibrado), Opus (mais inteligente/caro)
- **Precificacao**: voce paga por tokens (input + output). Haiku: $0.25/1M input, $1.25/1M output

#### Evolution API (WhatsApp)
- **O que e**: ponte entre seu codigo e o WhatsApp. Gerencia a sessao do WhatsApp Web
- **Endpoints que voce usa**:
  - `POST /message/sendText/{instancia}` — envia mensagem
  - `POST /chat/getBase64FromMediaMessage/{instancia}` — baixa audio/imagem
- **O que estudar**: documentacao da Evolution API, como funciona instancia, como configurar webhook

#### OpenAI Whisper (transcricao de audio)
- **O que faz**: recebe arquivo de audio, devolve texto transcrito
- **Endpoint**: `POST https://api.openai.com/v1/audio/transcriptions`
- **O que estudar**: "OpenAI Whisper API tutorial"

#### Notion API
- **O que faz**: cria paginas (tarefas) automaticamente no Notion
- **Endpoint**: `POST https://api.notion.com/v1/pages`
- **O que estudar**: "Notion API create page tutorial", como funciona integration token

---

## NIVEL 5 — INFRAESTRUTURA E DEPLOY

---

### 5.1 Git e GitHub

#### O que e
Git e um sistema de controle de versao — ele guarda o historico completo de todas as mudancas do seu codigo. GitHub e onde o repositorio fica hospedado na nuvem.

#### Comandos que voce mais usa
```bash
git status              # ver o que mudou
git add arquivo.js      # preparar arquivo para commit
git commit -m "mensagem" # salvar snapshot das mudancas
git push origin main    # enviar para o GitHub
git pull origin main    # baixar mudancas do GitHub
git log --oneline -5    # ver ultimos 5 commits
```

#### Fluxo no seu projeto
1. Voce edita arquivos da dashboard localmente
2. `git add` + `git commit` → salva as mudancas
3. `git push` → envia pro GitHub
4. Railway detecta o push → faz deploy automatico
5. Dashboard atualizada em producao

#### O que pesquisar
- "Git tutorial for beginners" (YouTube — recomendo "The Net Ninja")
- "Git commit push pull explained"
- "Git branches explained" (para quando o projeto crescer)
- "GitHub Pages vs Railway vs Vercel" (opcoes de deploy)
- Site interativo: learngitbranching.js.org — aprenda Git visualmente

---

### 5.2 Railway (deploy)

#### O que e
Railway e uma plataforma de hospedagem que detecta automaticamente o tipo do seu projeto (Next.js) e faz o deploy. E como um "Heroku simplificado".

#### Como funciona no seu projeto
1. Railway esta conectado ao GitHub (`claudezazz-cloud/maluco-dashboard`)
2. Quando voce faz push na branch `main`, o Railway:
   - Baixa o codigo novo
   - Roda `npm install` (instala dependencias)
   - Roda `npm run build` (compila o Next.js)
   - Inicia com `npm run start`
3. O site fica disponivel em `maluco-dashboard-production.up.railway.app`

#### O que pesquisar
- "Railway deploy Next.js tutorial"
- "How Railway auto deploy works"
- Painel do Railway: veja os logs de deploy para entender o processo

---

### 5.3 CloudFy (servidores)

#### O que e
CloudFy (cloudfy.host) e o provedor onde estao hospedados seu PostgreSQL, Redis e Evolution API. Eles te deram acesso a:
- **PostgreSQL** — banco de dados principal
- **Redis** (`lanlunar-redis.cloudfy.live:6476`) — cache/historico
- **Evolution API** (`lanlunar-evolution.cloudfy.live`) — WhatsApp

#### O que pesquisar
- "How hosting providers work"
- "What is a VPS" (Virtual Private Server)
- "PostgreSQL remote connection setup"

---

## ROTEIRO DE ESTUDO SUGERIDO

### Semana 1-2: Fundamentos
- [ ] Assistir videos sobre HTTP, APIs e JSON
- [ ] Fazer todos os exercicios do sqlbolt.com
- [ ] Praticar queries SQL no seu proprio banco (SELECT, INSERT, UPDATE)
- [ ] Entender o que sao variaveis de ambiente

### Semana 3-4: JavaScript
- [ ] Fazer tutorial basico de JavaScript (javascript.info)
- [ ] Entender arrays, objetos, async/await, try/catch
- [ ] Ler os nos "Code" do N8N e tentar entender linha por linha

### Semana 5-6: React e Next.js
- [ ] Fazer o tutorial oficial do React (react.dev)
- [ ] Fazer o curso do Next.js (nextjs.org/learn)
- [ ] Abrir os arquivos da sua dashboard e identificar: componentes, props, useState, useEffect

### Semana 7-8: Integracao
- [ ] Ler a documentacao da API do Claude (docs.anthropic.com)
- [ ] Entender como funciona JWT e autenticacao
- [ ] Estudar o fluxo completo do N8N (do webhook ate a resposta)

### Continuo
- [ ] Praticar Git no dia a dia
- [ ] Ler codigo de outros projetos no GitHub
- [ ] Participar da comunidade N8N (community.n8n.io)

---

## DICA DE OURO

A melhor forma de aprender e **mexer no seu proprio projeto**. Voce ja tem um sistema funcionando — cada vez que precisar mudar algo, voce vai aprender na pratica. Nao precisa fazer um curso inteiro de SQL antes de abrir o banco — abra o banco, rode um SELECT, veja o que acontece.

Quando travar em algo, pesquise especificamente o que precisa. "Como fazer WHERE com duas condicoes no PostgreSQL" e muito mais util do que assistir 10 horas de curso generico.

---

*Guia criado em 25/03/2026 para o projeto Maluco da IA — Zazz Internet*
