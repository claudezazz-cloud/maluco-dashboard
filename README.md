# Maluco da IA 👽🍀

Assistente de IA interno para equipes da **Zazz Internet**.

## Sobre o projeto

Bot de WhatsApp com IA (Claude Haiku) integrado ao N8N, Evolution API e dashboard web para gerenciamento. O bot responde colaboradores no WhatsApp com base em POPs (Procedimentos Operacionais Padrao), regras de comportamento e historico de conversa.

## Funcionalidades

### Bot WhatsApp
- Responde mensagens de texto e audio (transcricao via Whisper)
- Busca semantica de POPs — carrega apenas os procedimentos relevantes ao assunto da conversa
- Historico de conversa via Redis — mantem contexto entre mensagens
- Cria tarefas no Notion automaticamente
- Aprende novas regras via WhatsApp ("Claude aprenda: ...")
- Relatorios diarios, semanais e mensais do grupo
- Bom dia automatico nos dias uteis
- Tratamento de erros com log automatico na dashboard

### Dashboard Web
- **Visao Geral**: status dos bots, mensagens do dia, erros
- **Treinamento**: gerenciar regras de comportamento da IA
- **POPs**: procedimentos operacionais consultados pelo bot
- **System Prompt**: instrucoes base do assistente
- **Conversas**: historico completo de interacoes do bot com busca, paginacao e detalhes (tokens, POPs utilizados)
- **Erros**: log de erros dos nos do N8N com detalhes (nome do no, mensagem de erro, mensagem do usuario)
- **Admin**: gerenciar filiais, colaboradores e configuracoes

## Stack

| Componente | Tecnologia |
|-----------|-----------|
| Automacao | N8N (Cloud) |
| WhatsApp | Evolution API v2 |
| IA | Claude Haiku 4.5 (Anthropic) |
| Transcricao | OpenAI Whisper |
| Banco de dados | PostgreSQL (CloudFy) |
| Cache/Historico | Redis (CloudFy) |
| Tarefas | Notion API |
| Dashboard | Next.js 14 + Tailwind CSS |
| Deploy Dashboard | Railway (auto-deploy via GitHub) |

## Arquitetura do Workflow

```
WhatsApp (Webhook)
  -> Extrai Dados Mensagem
  -> Detecta Audio? -> Whisper (transcricao)
  -> E Treinamento? -> Salva Regra
  -> E Relatorio? -> Monta Prompt Relatorio
  -> Verifica Mencao
     -> Busca POPs (busca semantica)
     -> Busca System Prompt
     -> Busca Colaboradores
     -> Busca Historico Redis
     -> Monta Prompt (com historico + POPs relevantes)
     -> Claude API
     -> Parse Resposta
        -> Envia WhatsApp
        -> Salva Historico Redis
        -> Salva Conversa (PostgreSQL)
        -> E Erro? -> Salva Erro (PostgreSQL)
        -> Tem Notion? -> Cria no Notion
```

## Dashboard

Acesse: https://maluco-dashboard-production.up.railway.app

## Desenvolvimento por

**Franquelin Baldoria de Almeida**
- Instagram: [@Frank_almeida5](https://instagram.com/Frank_almeida5)
- WhatsApp: (43) 99166-3335
