# Bugs Abertos / TODO

Lista viva de problemas conhecidos e pendentes. Marque com data quando resolver.


---

## 🟡 Cache prompt do Anthropic não está hitando (mai/2026)

**Sintoma:** mesmo com `cache_control: {type: 'ephemeral'}` no bloco estável e o conteúdo idêntico entre requests consecutivos (~24k chars), a resposta da Anthropic só traz `input_tokens` e `output_tokens` — sem `cache_read_input_tokens` nem `cache_creation_input_tokens`.

**Confirmado:**
- Block 0 entre exec 55023 e 55059 é IDENTICAL (verificado via diff)
- Anthropic deveria estar criando/lendo o cache
- Tokens permanecem ~6-9k em vez de cair pra ~1-2k em hits subsequentes

**Possíveis causas:**
- `anthropic-version: 2023-06-01` no header pode estar causando comportamento legacy. Tentar atualizar para `2024-10-22` ou adicionar `anthropic-beta: prompt-caching-2024-07-31`.
- Tools enviadas no request também precisam ter `cache_control` para não invalidar contexto?
- Bug de serialização — talvez `cache_control` não esteja chegando como dict mas como string.

**Impacto:** mesmo sem cache hitando, tokens estão em 6-9k (vs 30k antes). Já dentro do alvo do usuário (10k). Otimização ainda possível mas não bloqueante.

---

## 🟢 Bom dia rodando 2x + sem chamados (06/05/2026)

**Resolvido em 25/05/2026**:
- ✅ UI: movido hora de "Bom dia + Resumo dos Chamados" de 07:00 → 08:30 no BD
- ✅ Código: UPDATE atômico em `/api/solicitacoes/processar` implementado usando `FOR UPDATE SKIP LOCKED` e `RETURNING *`
- ✅ Race conditions mitigadas.

---

## 🟢 Resolvidos recentemente

- ✅ **Tokens 30k+ pra "oi"** (resolvido mai/2026): workflow_history não estava sendo atualizado. Fix: `deploy_workflow.py` atualiza `workflow_entity` + `workflow_history` com mesmo versionId. Ver [deploy-workflow.md](deploy-workflow.md).
- ✅ **`pops_usados` vazio no dashboard** (resolvido mai/2026): bug em `Monta_Prompt.js:262` (`const popsUsados = ''`). Fix: `popsUsados = todosOsPops.map(p => p.titulo).join(', ')`.
- ✅ **Modelo `sonnet` mesmo com SQLite tendo `haiku`** (resolvido mai/2026): mesma raiz do bug do workflow_history.
- ✅ **Bot inventando "não tenho chamados" em `/chamados`** (resolvido mai/2026): Haiku 4.5 não chamava `buscar_chamados`. Fix: `tool_choice: {type: 'tool', name: 'buscar_chamados'}` forçado quando msg tem `/chamados`, `/relatorio` ou variantes. Ver [tool-choice-forcado.md](tool-choice-forcado.md).
- ✅ **Auto-resolver tarefa em mensagem de criação** (resolvido 06/05/2026): nó `Detecta Resolvido` matchava "pronto" em "Avisar quando tiver pronto" e marcava tarefa similar como Ok no Notion. Fix: regex restrito + exclusão `CRIA_TAREFA_RE` para templates de pedido. Ver [detecta-resolvido.md](detecta-resolvido.md).
- ✅ **`fix_*.py` poluindo raiz** (resolvido 06/05/2026): 19 scripts one-shot movidos para `archive/fix_scripts_2026_q2/` via `git mv`. Histórico preservado no git.
- ✅ **TypeError "content[0].text" no Parse Resposta** (resolvido 13/05/2026): quando `CRIAR_NOTION_INTENT` forçava `criar_tarefa_notion` via `tool_choice`, o agent_loop podia retornar `content: []` (array vazio). O guard `!finalContent` não detecta array vazio (`![] === false`). Fix duplo: (1) agent_loop — guard melhorado para `!finalContent || finalContent.length === 0 || !find(text block)`; (2) Parse Resposta — busca o primeiro bloco de texto com `.find(b => b.type === 'text')` em vez de assumir `content[0]`.
- ✅ **Bot encurtando respostas de POP** (resolvido 06/05/2026): Haiku chamava `buscar_pop` mas resumia o conteúdo com "RESUMO RÁPIDO". Fix duplo: (1) sysprompt — exceção anti-resumo na seção TOM + regras "TRANSCREVA TODOS os passos" na seção POPs; (2) `agent_loop_code.js` — prefixo "INSTRUCAO OBRIGATORIA" injetado no tool_result de `buscar_pop`. Tokens output: 428 → 1.547; chars resposta: 899 → 3.588; todas as etapas e checklists presentes.

---

**Ver também:** [[Workflow N8N]] · [[Chamados]] · [[Solicitacoes Programadas]] · [[Notion]] · [[deploy-workflow]] · [[tool-choice-forcado]] · [[detecta-resolvido]]
