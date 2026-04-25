# Objetivo

← volta para [[Maluco da IA]]

## Por que o projeto existe

Centralizar o **conhecimento operacional da Zazz Internet** em um único lugar acessível a todos os colaboradores, sem precisar procurar em documentos espalhados ou perguntar para o gestor.

Antes do [[Maluco da IA]], procedimentos ficavam em drives, cadernos, cabeça de gente. Agora tudo vira POP cadastrado na [[Dashboard]] e fica disponível por uma pergunta no WhatsApp.

## O que o projeto resolve

- **Descentralização do conhecimento** → qualquer colaborador pergunta e recebe o procedimento certo
- **Perda de contexto** → histórico de conversa mantido no Redis (ver [[Banco de Dados]])
- **Retrabalho** → criação automática de tarefas no Notion
- **Relatórios manuais** → o bot gera resumos diários/semanais/mensais do grupo
- **Ensino dinâmico** → regras de comportamento podem ser ensinadas ao vivo via WhatsApp ("Claude aprenda: sempre pergunte o telefone")

## Escopo

Dois componentes principais:

1. **Bot de WhatsApp** → orquestrado pelo [[Workflow N8N]], recebe mensagens via Evolution API e responde usando [[Stack Tecnologica|Claude Haiku 4.5]]
2. **Dashboard web** → admin gerencia tudo (ver [[Dashboard]])

Veja [[Funcionalidades]] pra lista completa do que o bot faz.
