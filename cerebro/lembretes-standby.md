# Lembretes — STANDBY (desativado em 2026-05-04)

⚠️ **A tool `criar_lembrete` está temporariamente desativada.** O bot orienta o usuário a criar tarefa no Notion como alternativa.

## Por que foi desativado

Bug crônico de hallucination + rate limit. Linha do tempo do dia 04/05/2026 (gastei umas 5h tentando consertar):

1. **Bug 19** — Sonnet copiava do histórico Redis suas próprias respostas antigas dizendo "ferramenta indisponível" e repetia sem nem chamar a tool. Fix: scrub no `redisHistory` em [Monta_Prompt.js:5-30](../v3_dump/Monta_Prompt.js#L5).
2. **Bug 21** — Mesmo com scrub, Sonnet copiava o padrão "Lembrete criado" dos turnos passados e respondia texto plano com `stop_reason: end_turn` e ZERO `tool_use`. Tentei `tool_choice` forçado + detector de hallucination — mas:
3. **Bug 22 (decisivo)** — Os 5 fixes que apliquei via SQLite ficaram inertes por horas. Eu patchava `workflow_entity.nodes` mas o n8n 2.x executa `workflow_history.nodes` referenciado por `activeVersionId`. Procedimento de deploy correto agora:
   ```python
   # patchar AMBAS as tabelas
   cur.execute("UPDATE workflow_entity SET nodes=?, updatedAt=?, active=0 WHERE id=?", (...))
   cur.execute("UPDATE workflow_history SET nodes=?, updatedAt=? WHERE versionId=?", (...))
   # depois reativa
   cur.execute("UPDATE workflow_entity SET active=1 WHERE id=?", ...)
   ```
4. **Bug 23** — `Parse_Resposta.js` tinha caminho legacy `|||NOTION|||` que criava tarefa via texto, bypassando o agent loop. Removido.
5. **Quando finalmente o `tool_choice` rodou** — hit `429 Rate Limit` (org limit 30k input tokens/min do plano atual da Anthropic). O detector de hallucination re-iterava com sysprompt de 22k chars, multiplicando custo. Insustentável no plano atual.

## Estado atual (standby)

- Tool removida do array `TOOLS` em [agent_loop_code.js:124](../v3_dump/agent_loop_code.js#L124) (não vai pro git — tem API keys, fica no VPS)
- Handler `if (name === 'criar_lembrete')` removido do switch
- Lógica `forceLembrete` / `tool_choice` / `hallucinaLembrete` removida do agent loop
- Sysprompt linha 159+: instrução pra responder "Lembretes em manutenção. Quer que eu anote no Notion?"
- Endpoint `/api/lembretes` no dashboard segue funcionando (não foi mexido) — só não tem mais consumidor
- Cron de envio de `mensagens_agendadas` segue funcionando — útil pras cobranças automáticas (`tarefas/cobrar`) que continuam ativas

## Como reativar quando voltar a esse problema

Quando tiver tempo de redesenhar. Plano sugerido:

1. **Aumentar quota Anthropic** ou **migrar pro Claude Haiku** pra `criar_lembrete` (haiku tem rate limit muito maior e não precisa do Sonnet pra essa tarefa simples).
2. **Reduzir sysprompt** — 22k chars é absurdo pra cada chamada. Mover POPs/Colaboradores/Histórico pra ferramentas de busca em vez de injetar tudo.
3. **Fluxo de 2 estágios:**
   - Stage 1: classifier mini (Haiku) decide se a mensagem é "lembrete pessoal" → roteia direto pro endpoint `/api/lembretes` com extract_data, sem passar pelo agent loop principal.
   - Stage 2: agent loop normal só pros casos complexos.
4. **Restaurar do git:** os blocos removidos estão na história. Procurar commits `27d0ada`, `7bf77f9`, `6e5c58a`, `de81d42` em `cerebro-evolutivo/auditoria-bugs-corrigidos.md` (Bugs 19/21/22/23) — todo o código tá descrito lá.

## Arquivos tocados nessa fase

| Arquivo | O que mudou |
|---|---|
| `v3_dump/agent_loop_code.js` (VPS only) | Removido tool `criar_lembrete` + handler + lógica `tool_choice` |
| `v3_dump/sysprompt_v3.txt` | Bloco da tool 7 substituído por instrução de standby |
| `v3_dump/Monta_Prompt.js` | Mantido scrub do `redisHistory` (defesa contra contaminação genérica) |
| `v3_dump/Parse_Resposta.js` | Mantido — caminho legacy `|||NOTION|||` removido (era bug separado) |

## Endpoint que ficou órfão

`POST /api/lembretes` no dashboard — testado e funciona via `curl`. Não tem mais quem chame, mas tá lá pra reativação.

## Tabela `mensagens_agendadas`

Continua sendo usada pelo cron `15 8 * * 1-6` (`tarefas/cobrar`). Não desativar nem dropar — só os lembretes do bot deixaram de inserir nela.
