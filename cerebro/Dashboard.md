# Dashboard

← volta para [[Maluco da IA]] | stack em [[Stack Tecnologica]]

Painel admin em **Next.js 14** (App Router) + Tailwind + Lucide React.

**URL de produção**: `https://dashboard.srv1537041.hstgr.cloud` (ver [[Infraestrutura]])

## Páginas

| Página | Função | Acesso |
|--------|--------|--------|
| `/login` | Login email + senha | Público |
| `/dashboard` | Métricas (msgs/erros/online), cards por filial, execuções N8N | Admin + Colab |
| `/chamados` | Importar chamados + clientes XLSX (tabs) | Chamados: Admin + Colab. Clientes + limpar histórico: só Admin |
| `/chat` | Chat direto com o bot — texto, até 10 imagens, áudio gravado, [[Skills]] via dropdown | Admin + Colab |
| `/treinamento` | Regras, POPs, Colaboradores, [[Skills]], [[Solicitacoes Programadas]] (5 abas) | Admin |
| `/system-prompt` | Editor do system prompt com placeholders | Admin |
| `/conversas` | Histórico + log de erros ([[Error Trigger]]) | Admin |
| `/admin` | Filiais + Usuários | Admin |

## Chat `/chat`

Detalhes:
- Envio de **texto**, até **10 imagens** e **áudio gravado** (MediaRecorder webm/opus)
- Polling de respostas a cada 2s
- Histórico por usuário logado
- Dropdown com skills ativas (`/api/skills/ativas`)

## Métrica "MENSAGENS HOJE"

A rota `/api/status` conta **respostas do Claude** do dia (cada linha em `bot_conversas` = 1 resposta). Timezone `America/Sao_Paulo`. Cobre as 3 fontes:
1. **WhatsApp** → `chat_id = filial.group_chat_id`
2. **Solicitações Programadas** → mesmas linhas (chat_id alvo é o do grupo)
3. **Dashboard /chat** → `chat_id LIKE 'dashboard-%'` (contado **apenas na 1ª filial** pra não duplicar quando houver múltiplas filiais)

> **Por que `bot_conversas` e não `mensagens`**: a tabela `mensagens` armazena toda mensagem do grupo (mesmo as que o bot ignora — conversas entre humanos). Já `bot_conversas` registra só as interações com resposta do Claude. Pra métrica "uso real do bot", `bot_conversas` é a fonte certa.

A página `/dashboard` soma `mensagensHoje` de todas as filiais → card **MENSAGENS HOJE** no topo.

## Roles

- **Admin** → acesso total
- **Colaborador** → Dashboard + Chat + aba Chamados (importar/remover XLSX). Aba Clientes e botão "Limpar Histórico" continuam só pra admin.

## API Routes (principais)

| Rota | Método | Auth | Função |
|------|--------|------|--------|
| `/api/auth/login` | POST | — | Cookie JWT |
| `/api/pops` | GET/POST | Admin | CRUD POPs |
| `/api/pops-n8n` | GET | Token | Para o [[Workflow N8N]] |
| `/api/chat/send` | POST | JWT | Texto, imagens, áudio via webhook |
| `/api/skills/ativas` | GET | JWT | Dropdown do chat |
| `/api/conversas` | GET/POST | GET=admin, POST=aberto | Listar / N8N salva |
| `/api/erros` | GET/POST/DELETE | — | [[Error Trigger]] |
| `/api/solicitacoes/*` | vários | Admin + Token | [[Solicitacoes Programadas]] |
| `/api/status` | GET | JWT | Status das filiais |
| `/api/executions` | GET | JWT | Execuções N8N |

Lista completa no README.md.

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `PG_URL` | Conexão PostgreSQL (ver [[Banco de Dados]]) |
| `JWT_SECRET` | Assinatura JWT |
| `N8N_URL` | URL da API do N8N |
| `N8N_API_KEY` | Chave da API N8N |
| `N8N_POPS_TOKEN` | Token de `/api/pops-n8n` (default: `MALUCO_POPS_2026`) |
| `REDIS_URL` | Conexão Redis |

## Deploy

Ver [[Deploy]] seção "Dashboard".
