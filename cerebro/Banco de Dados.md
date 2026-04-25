# Banco de Dados

← volta para [[Maluco da IA]] | infra em [[Infraestrutura]]

Duas camadas: **PostgreSQL** (persistente) + **Redis** (efêmero/rápido).

## Tabelas PostgreSQL

### Operacional (mensagens e respostas)
- **`mensagens`** → todas as mensagens do grupo WhatsApp. Inclui `tipo_atendimento` (`solicitacao` / `resolucao` / `NULL`) detectado automaticamente
- **`bot_conversas`** → interações bot (pergunta + resposta + tokens + POPs usados)
- **`bot_erros`** → log de erros, populado pelo [[Error Trigger]]

### Conhecimento do bot
- **`dashboard_pops`** → POPs (procedimentos). Campo `prioridade`:
  - `sempre` → injetado em toda resposta
  - `importante` → sempre envia conteúdo completo
  - `relevante` → top 5 por score de palavras-chave
- **`regras`** → regras de comportamento ensinadas via WhatsApp ou [[Dashboard]]
- **`dashboard_config`** → chave/valor, guarda o `system_prompt` editável
- **`dashboard_colaboradores`** → time da empresa (nome, cargo, funções)
- **`dashboard_clientes`** → base de clientes importada via XLSX

### Multi-filial e usuários
- **`dashboard_filiais`** → filiais (cada uma pode ter seu próprio workflow N8N)
- **`dashboard_filiais_config`** → chave/valor por filial (tokens, URLs)
- **`dashboard_usuarios`** → login da [[Dashboard]]. Roles: `admin` ou `colaborador`

### Extensões recentes
- **`dashboard_skills`** → comandos com `/` (ver [[Skills]])
- **`dashboard_solicitacoes_programadas`** → agendamentos (ver [[Solicitacoes Programadas]])

## Redis

| Chave | Conteúdo | TTL |
|-------|---------|-----|
| `conv:{chatId}` | Histórico JSON (role/content, últimas 20 msgs) | Sem TTL |
| `chamados:data` | Chamados XLSX + `ai_context` | 24h |
| `clientes:data` | Clientes XLSX | 24h |
| `config:bom_dia_grupo` | ID do grupo para bom dia | Sem TTL |

## Como o bot lê

Cada mensagem passa por vários nós "Busca X" no [[Workflow N8N]] que puxam essas tabelas/chaves e injetam no prompt do Claude no nó **Monta Prompt**.
