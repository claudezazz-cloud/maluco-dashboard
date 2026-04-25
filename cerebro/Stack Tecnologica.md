# Stack Tecnológica

← volta para [[Maluco da IA]]

## Tabela de tecnologias

| Componente | Tecnologia | Uso |
|-----------|-----------|-----|
| Automação | **N8N** self-hosted | Orquestra fluxo do bot ([[Workflow N8N]]) + [[Solicitacoes Programadas]] |
| WhatsApp | **Evolution API v2** | Envia/recebe mensagens, hospedada no VPS |
| IA | **Claude Sonnet 4.6** (`claude-sonnet-4-6`) | Texto + Vision nativo ([[Fluxo de Imagem]]) — ver [[Custos]] |
| Transcrição áudio | **Groq Whisper-large-v3** | API compatível OpenAI — [[Fluxo de Audio]] |
| Banco | **PostgreSQL** (Docker) | Persistência — ver [[Banco de Dados]] |
| Cache/Histórico | **Redis** (Docker) | Histórico conversa, chamados, config |
| Tarefas | **Notion API** | Criação automática de tarefas |
| Dashboard | **Next.js 14** + Tailwind + Lucide React | App Router, tema dark — ver [[Dashboard]] |
| Deploy dashboard | **PM2** no VPS | Build Next.js + processo gerenciado |
| Repositório | **GitHub** | `claudezazz-cloud/maluco-dashboard` |

## Por que essas escolhas

- **N8N** → editor visual, trigger de webhook, fácil de iterar (ver [[Deploy]])
- **Claude Sonnet 4.6** → maior qualidade de raciocínio para POPs e relatórios, Vision nativo. Migrou de Haiku 4.5 em abr/2026 — custo passou de ~US$ 3/mês pra ~US$ 9/mês (com cache ativo). Ver [[Custos]]
- **Groq** → substituiu o OpenAI Whisper (mais rápido e free tier generoso)
- **Postgres + Redis** → clássico: Postgres pro que precisa persistir, Redis pro que é efêmero/rápido
- **Next.js 14 App Router** → server components, API routes, deploy simples

## Detalhes de infraestrutura

Ver [[Infraestrutura]] para URLs, portas e acessos.
