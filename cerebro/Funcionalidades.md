# Funcionalidades

← volta para [[Maluco da IA]] | veja também [[Objetivo]]

## Atendimento no WhatsApp

- Responde quando mencionado no grupo (`@Claude`, `@Maluco`)
- Transcreve áudio via **Groq Whisper-large-v3** — detalhes em [[Fluxo de Audio]]
- Analisa imagens via **Claude Vision** — detalhes em [[Fluxo de Imagem]]
- Multi-imagem: até 10 imagens em uma única resposta (1 webhook = 1 resposta)
- Busca semântica de POPs com sistema de prioridade (`sempre` / `importante` / `relevante`) — ver [[Banco de Dados]] tabela `dashboard_pops`
- Mantém histórico de conversa no Redis (últimas 20 msgs por chat)
- Cria tarefas no Notion quando colaborador pede
- Aprende novas regras em tempo real: `Claude aprenda: sempre pergunte o telefone`
- Gera relatórios com base no histórico do grupo (solicitações, resoluções, destaques, pendências)
- Classifica mensagens automaticamente como `solicitacao` / `resolucao` / `NULL`

## Importações na Dashboard

- Chamados via XLSX (dados ficam 24h no Redis — ver [[Banco de Dados]])
- Clientes via XLSX
- Limpeza de histórico Redis sob demanda

## [[Skills]] (comandos com /)

- `/menu` — lista skills ativas (responde direto, sem Claude)
- `/relatorio` — relatório do dia
- Skills customizadas cadastradas na [[Dashboard]]

## [[Solicitacoes Programadas]]

Execução automática de comandos em horários definidos (ex: bom dia às 07:30, relatório às 17:00).

## Tratamento de erros

- Fallback amigável quando a API do Claude falha
- **Error Trigger global** captura qualquer falha do workflow — ver [[Error Trigger]]
- Dashboard mostra erros em `/conversas` (aba Erros) e contador em `/dashboard`

## Registro de conversas

Toda interação vai pra tabela `bot_conversas` com metadados (tokens, POPs usados, chat_id, timestamp). Consulta pela [[Dashboard]].
