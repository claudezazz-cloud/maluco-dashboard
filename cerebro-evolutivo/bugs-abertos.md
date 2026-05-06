# Bugs Abertos / TODO

Lista viva de problemas conhecidos e pendentes. Marque com data quando resolver.

## 🔴 Bot alucinando respostas de POPs (mai/2026)

**Sintoma:** após o fix de tokens (mai/2026, 30k → 7k), o bot ficou genérico ao falar de POPs. Está alucinando respostas em vez de chamar `buscar_pop` para ler o conteúdo real.

**Causa provável:** Agora o prompt traz só **títulos** dos POPs (não o conteúdo). O bot deveria:
1. Ler a pergunta do usuário
2. Identificar qual POP é relevante (pelo título)
3. Chamar `buscar_pop(titulo)` para obter o conteúdo
4. Responder com base no conteúdo retornado

Mas o bot está respondendo direto sem chamar `buscar_pop`, inventando passos que parecem plausíveis. As regras no system prompt dizem:

> - POPs marcados com ⚠️ são OBRIGATÓRIOS — chame buscar_pop para eles SEMPRE antes de responder.
> - Para outros POPs: chame buscar_pop antes de dar instruções de qualquer processo.
> - NUNCA oriente de memória sem chamar a tool.

Aparentemente Haiku 4.5 não está obedecendo essas regras com força suficiente.

**Possíveis fixes (ordem de simplicidade):**

1. **Reforçar no sysprompt_v3.txt** uma regra mais forte e em CAPS no início do prompt:
   ```
   ⚠️ REGRA ABSOLUTA: ANTES de responder QUALQUER pergunta sobre processos, procedimentos,
   "como faz", "quais os passos", você DEVE chamar buscar_pop. Sem exceção.
   Se não chamou buscar_pop, sua resposta está errada e vai ser rejeitada.
   ```

2. **`tool_choice` forçado** quando detectar intenção de procedimento — similar ao que já fazemos com `criar_lembrete` (LEMBRETE_INTENT). Adicionar PADRAO_INTENT regex.

3. **Pre-injection da tool call** — em casos óbvios (pergunta começa com "como", "qual o processo", "passo a passo", etc), montar o messages com primeiro turn já contendo um tool_use de buscar_pop.

4. **Reverter parcialmente** — manter títulos para POPs que não são "LEIA SEMPRE", mas injetar conteúdo dos LEIA SEMPRE. Custo: ~6k tokens extras só nos LEIA SEMPRE. Tradeoff aceitável se eliminar alucinação.

5. **Fine-tuning do system prompt** com exemplos few-shot mostrando o padrão certo (usuário pergunta → bot chama buscar_pop → responde).

**Métricas para validar fix:**
- `bot_conversas` deve ter `pops_usados` populado MAS também ver no `execution_data` se a tool `buscar_pop` foi chamada. Se chamada, `tools_used` count > 0.
- Comparar respostas do bot antes/depois — devem citar `=== Título do POP ===` ou trechos literais (sinal de leitura via tool).

**Histórico:**
- mai/2026 (commit `c67a543`): movemos POPs para títulos-only + tool. Tokens caíram drasticamente.
- mai/2026: usuário reportou alucinação. Bug aberto aqui.

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

## 🔵 TODO operacional — limpar `fix_*.py` da raiz (mai/2026)

Tem ~20 scripts `fix_*.py` na raiz do projeto que foram one-shot fixes (rodaram, aplicaram, terminaram). Estão poluindo o repo. Documentei todos e o que fizeram em [fix-scripts-historicos.md](fix-scripts-historicos.md).

**Plano:** mover para `archive/fix_scripts_2026_q2/` (preservar histórico via git).

**Impacto:** zero — nenhum desses scripts é usado em runtime.

**Substituto para fixes futuros:** `v3_dump/deploy_workflow.py` (workflow N8N) ou scripts em `dashboard/scripts/` (não na raiz).

---

## 🟢 Resolvidos recentemente

- ✅ **Tokens 30k+ pra "oi"** (resolvido mai/2026): workflow_history não estava sendo atualizado. Fix: `deploy_workflow.py` atualiza `workflow_entity` + `workflow_history` com mesmo versionId. Ver [deploy-workflow.md](deploy-workflow.md).
- ✅ **`pops_usados` vazio no dashboard** (resolvido mai/2026): bug em `Monta_Prompt.js:262` (`const popsUsados = ''`). Fix: `popsUsados = todosOsPops.map(p => p.titulo).join(', ')`.
- ✅ **Modelo `sonnet` mesmo com SQLite tendo `haiku`** (resolvido mai/2026): mesma raiz do bug do workflow_history.
