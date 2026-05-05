# Stack Tecnológica

← volta para [[Maluco da IA]]

## Tabela de tecnologias

| Componente | Tecnologia | Uso |
|-----------|-----------|-----|
| Automação | **N8N** self-hosted | Orquestra fluxo do bot ([[Workflow N8N]]) + [[Solicitacoes Programadas]] |
| WhatsApp | **Evolution API v2** | Envia/recebe mensagens, hospedada no VPS |
| IA | **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | Texto + Vision nativo ([[Fluxo de Imagem]]) — ver [[Custos]] |
| Transcrição áudio | **Groq Whisper-large-v3** | API compatível OpenAI — [[Fluxo de Audio]] |
| Banco | **PostgreSQL** (Docker) | Persistência — ver [[Banco de Dados]] |
| Cache/Histórico | **Redis** (Docker) | Histórico conversa, chamados, config |
| Tarefas | **Notion API** | Criação automática de tarefas |
| Dashboard | **Next.js 14** + Tailwind + Lucide React | App Router, tema dark — ver [[Dashboard]] |
| Deploy dashboard | **PM2** no VPS | Build Next.js + processo gerenciado |
| Repositório | **GitHub** | `claudezazz-cloud/maluco-dashboard` |

## Por que essas escolhas

- **N8N** → editor visual, trigger de webhook, fácil de iterar (ver [[Deploy]])
- **Claude Haiku 4.5** → velocidade + custo baixo (~US$ 3/mês com cache ativo). Usou Sonnet 4.6 brevemente em abr/2026 mas reverteu para Haiku em mai/2026 por rate limit e custo. Ver [[Custos]]
- **Groq** → substituiu o OpenAI Whisper (mais rápido e free tier generoso)
- **Postgres + Redis** → clássico: Postgres pro que precisa persistir, Redis pro que é efêmero/rápido
- **Next.js 14 App Router** → server components, API routes, deploy simples

## Detalhes de infraestrutura

Ver [[Infraestrutura]] para URLs, portas e acessos.
