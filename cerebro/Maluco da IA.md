# Maluco da IA

> Hub central da documentação. Clique nos [[wikilinks]] para navegar.

**Assistente de IA interno para equipes da Zazz Internet** — provedor de fibra óptica em Lunardelli-PR.

Bot de WhatsApp com IA que atende os colaboradores da Zazz no grupo da equipe, responde dúvidas sobre procedimentos, cria tarefas no Notion, gera relatórios e aprende novas regras em tempo real.

---

## Mapa de Notas

### Visão Geral
- [[Objetivo]] — por que o projeto existe
- [[Funcionalidades]] — tudo que o bot faz hoje
- [[Autor]] — quem desenvolveu

### Arquitetura
- [[Stack Tecnologica]] — N8N, Claude, Groq, Postgres, Redis, Notion, Next.js
- [[Infraestrutura]] — VPS Hostinger, URLs, portas
- [[Banco de Dados]] — tabelas PostgreSQL + chaves Redis
- [[Workflow N8N]] — orquestração do bot
- [[System Prompt]] — manual de instruções injetado em toda resposta

### Conteúdo (o que o bot sabe)
- [[POPs]] — procedimentos cadastrados (LEIA SEMPRE + relevância semântica)
- [[Regras de Treinamento]] — aprende novas regras via WhatsApp (`aprenda:`)
- [[Colaboradores]] — equipe da Zazz e funções
- [[Clientes]] — base de clientes resumida
- [[Chamados]] — XLSX importado pra contexto diário

### Fluxos específicos
- [[Fluxo de Audio]] — transcrição via Groq Whisper
- [[Fluxo de Imagem]] — Claude Vision, single e multi-imagem
- [[Error Trigger]] — captura global de erros
- [[Skills]] — comandos com `/`
- [[Solicitacoes Programadas]] — agendamento automático
- [[Bom Dia]] — saudação automática 7:30 AM seg-sáb
- [[Relatorios]] — diário/semanal/mensal por comando

### Integrações
- [[Notion]] — cria tarefas + lê status

### Interface & Operação
- [[Dashboard]] — painel admin Next.js
- [[Chat Dashboard]] — conversa com o bot direto pelo navegador
- [[Autenticacao]] — JWT + roles (admin/colaborador)
- [[Deploy]] — como subir mudanças
- [[Filiais]] — multi-tenant (preparado, não ativo)

### Otimizações
- [[Prompt Caching]] — 75% de economia no custo da API reusando contexto estável
- [[Custos]] — preços, comparações, projeção mensal

---

## Resumo em 3 frases

1. Colaborador manda `@Maluco como faço X?` no grupo WhatsApp → bot consulta [[Banco de Dados|POPs cadastrados]] e responde com procedimento certo.
2. Bot também transcreve áudio ([[Fluxo de Audio|Groq Whisper]]), analisa imagens ([[Fluxo de Imagem|Claude Vision]]) e cria tarefas no Notion quando pedem.
3. Admin gerencia tudo pela [[Dashboard]] web — POPs, regras, colaboradores, agendamentos, histórico, erros.
