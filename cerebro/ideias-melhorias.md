# Ideias de Melhoria — Maluco da IA

Oportunidades identificadas em 03/05/2026. Nenhuma implementada ainda.

---

## Contexto e Memória

- **Histórico Redis curto:** limite atual de 8 mensagens perde contexto em conversas longas. Aumentar para 12-15 ou injetar um resumo da sessão atual junto com o histórico.
- **Fatos sem ranking:** `bot_memoria_longa` injeta tudo ou nada. Implementar ranking por relevância (últimos acessados + peso maior = prioridade) para reduzir tokens e aumentar precisão.

---

## Confiabilidade do Agent Loop

- **Hallucination em erro de tool:** quando uma tool falha, o bot inventa resposta em vez de reportar. Adicionar ao prompt: *"se uma tool retornar erro, informe o usuário claramente — nunca invente uma resposta"*.
- **Tool calls excessivos:** bot às vezes lista tarefas, cria, lista de novo desnecessariamente. Impor limite de 5 tool calls por turno no `agent_loop_code.js`.

---

## Qualidade das Respostas

- **Emojis e verbosidade:** respostas longas demais para perguntas simples. Adicionar instrução de tom: *"para perguntas simples, responda em até 3 linhas sem emojis desnecessários"*.
- **Cliente sem código:** quando não sabe o código do cliente, deveria perguntar antes de criar tarefa. Hoje às vezes inventa o campo.

---

## Proatividade Inteligente

- **Detecção de padrão de risco:** cliente com 3+ registros de "sem internet" nos últimos 30 dias na `bot_memoria_longa` → bot sugere visita técnica proativa ao invés de só registrar.
- **Score de risco nos relatórios:** relatórios automáticos de 11:40 e 17:20 poderiam incluir score por cliente: `dias_parado × gravidade_tipo` — prioriza quem cobrar primeiro.

---

## Observabilidade

- **Sem métricas de agent loop:** não existe dashboard de quantas tools foram chamadas, quais falharam, tempo médio de resposta por tool. Dificulta saber se o bot está melhorando.
- **Erros silenciosos:** muita coisa falha sem registrar em `bot_erros` (ex: tabela inexistente causou semanas de criar_lembrete quebrado sem ninguém saber). Adicionar try/catch com INSERT em `bot_erros` em todas as tools do agent_loop_code.js.

---

## Impacto Rápido (2 linhas no prompt, resultado imediato)

1. Tom direto: *"para perguntas simples, responda em até 3 linhas"*
2. Honestidade em erros: *"se uma tool retornar erro, informe claramente — nunca invente"*

---

## Otimização de Arquitetura N8N

- **Exaustão de Conexões Postgres:** Cada mensagem nova no N8N aciona 6 nós do banco de dados separadamente (`Busca Regras`, `Busca POPs`, etc.), drenando o pool de conexões do PostgreSQL. Melhoria: criar uma rota interna no Dashboard em Next.js que retorna Regras, POPs e Colaboradores num único JSON (que ficará em cache na memória da VPS) para ser consumido via HTTP Request no N8N, poupando assim o Postgres e acelerando as chamadas.
