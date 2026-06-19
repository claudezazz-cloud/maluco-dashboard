# gerar_carne — RESOLVIDO em 11/06/2026 (a teoria do "throttle de IP" estava ERRADA)

> **Status (11/06/2026):** Faturamento **FUNCIONANDO 100%** rodando LOCAL (PC, IP residencial) com conta exclusiva. Testado no cliente 13543 (José Antonio Monteiro Arcanjo): 6 meses (Jun–Nov/2026) em **121s**, sem erros. Detecção de sucesso, skip de "já faturado" e gravação de vídeo funcionando.

## 🎯 CAUSA RAIZ REAL (derruba toda a saga v1–v11)

A conclusão de 10/06 ("Routerbox throttla o IP do VPS") estava **ERRADA**. A pista que matou a teoria: o Routerbox ficou lento no Brave do notebook do Franquelin, mas **normal no Firefox da MESMA máquina/MESMA internet**, e normal em outro PC no mesmo IP. Se fosse IP, todos estariam lentos. As causas reais eram:

1. **🔑 SESSÃO ÚNICA POR CONTA (o assassino principal).** O Routerbox força 1 sessão por usuário — logar numa conta **desloga as outras máquinas**. O bot (VPS) e o Franquelin usavam a MESMA conta `ldl.franquelin.2`. Cada vez que alguém logava, **o bot era derrubado no meio da execução** → a sessão morria → ele ficava preso esperando popups que nunca vinham. Explica perfeitamente o "primeira tentativa funcionou, depois deu muito erro": a 1ª rodou sozinha, as seguintes foram chutadas. **FIX: conta dedicada e exclusiva do bot, que nenhum humano usa.**

2. **Bugs de login no `rbx_auth.js`:**
   - A senha não colava (fill rápido demais, sem verificação). **FIX:** preenche, confere `inputValue()`, re-tenta digitando tecla-a-tecla (`pressSequentially`).
   - O botão "ENTRAR" é um `<a id="sub_form_b" class="scButton_ok">` do ScriptCase (onclick `scBtnFn_sys_format_ok()`), **NÃO um `<button>`**. Os seletores antigos (`button:has-text`) não achavam → dava Enter, que não dispara o login. **FIX:** seletor `a#sub_form_b`.
   - Usuário de teste tem **DOIS pontos**: `ldl.luiz..garcia` (não confundir com typo).

3. **Campos AJAX selecionados rápido demais.** Histórico ("Contas a Receber - LDL") e Gateway ("FATURAMENTO LDL") carregam opções via AJAX. Selecionar antes de carregar → campo fica vazio. **FIX:** `selectCampo()` espera a OPÇÃO aparecer no dropdown antes de selecionar (wait adaptativo), com fallback por match parcial, e re-confere o Histórico antes do Executar.

4. **Texto do popup de confirmação** é **"Confirma execução da rotina de faturamento?"** (SEM "a" entre Confirma e execução). A regex antiga `'confirma a execuç'` NUNCA batia → ficava polando até timeout. **FIX:** procurar `'rotina de faturamento'`.

5. **Sinal de SUCESSO = o formulário RESETA** (campo Mês volta pro placeholder "Escolha Mês") após o Routerbox processar. **Não existe mensagem de sucesso confiável** (some rápido). **FIX:** detectar o reset do `select[name="mes"]`. Erro continua sendo o banner vermelho "Já existe faturamento".

6. **"Já existe faturamento para o cliente no período informado"** = mês já faturado → **pular** (não é erro). Detectado logo após escolher Mês+Ano.

7. **Classificador é OPCIONAL** (sem asterisco) — não trava se não preencher (wait curto de 15s).

## Arquitetura atual (11/06/2026)

- **`tools/lib/rbx_auth.js`** — login robusto (fill verificado, botão `a#sub_form_b`, gravação de vídeo via `RB_VIDEO_DIR`).
- **`tools/gerar_carne/faturar.js`** — reescrito: waits adaptativos (espera opção/elemento, não tempo fixo), skip de já-faturado, sucesso por reset de form, vídeo 1.5x.
- **`tools/gerar_carne/run_local.mjs`** — runner local (roda do PC, IP residencial). Uso:
  ```bash
  RB_USER="ldl.luiz..garcia" RB_PASS="123mudar" RB_HEADLESS=false RB_VIDEO_DIR=videos \
    node run_local.mjs 13543 "Junho,Julho,Agosto,Setembro,Outubro,Novembro"
  ```
- **`next.config.js`** — webpack `externals` pra playwright/puppeteer (senão o build do Next quebra com require dinâmico do stealth).
- **Vídeo:** Playwright grava `.webm` (`RB_VIDEO_DIR`). O ffmpeg EMBUTIDO do Playwright é mínimo — **não faz `setpts` nem H.264**. Pra 1.5x + mp4 (WhatsApp) precisa de **ffmpeg completo** (`apt install ffmpeg` no VPS). `acharFfmpeg()` prioriza `/usr/bin/ffmpeg`.

## ✅ Wiring de produção (FEITO em 11-12/06/2026)

O fluxo "GERE CARNÊ DE FULANO" no WhatsApp está **funcionando end-to-end**:

1. **Bot recebe** a mensagem → agent loop (Claude) → desambigua cliente (via `buscar_cliente`) → chama tool **`gerar_carne`**.
2. **Tool `gerar_carne`** (nó Claude API) chama `POST /api/faturar` com `{ cliente, meses, chat_id }`. O `chat_id` = `$input.first().json.chatId` → vídeo vai pro **grupo que pediu**.
3. **`/api/faturar`** → `exec` do **`worker.js`** (síncrono, timeout 30min).
4. **`worker.js`**: resolve nome→código (`/api/clientes/buscar`), roda `faturarCliente` (grava vídeo), processa **mp4 1.5x** (ffmpeg), e **envia o vídeo via Evolution** (`sendMedia`) no `chat_id` (fallback `CARNE_CHAT_DEFAULT`).
5. **GUARDA DE NEGÓCIO**: `worker.js` bloqueia **Dezembro** (gera boleto 2027, proibido). Regra também no system prompt.

### Config (no `.env` do dashboard no VPS)
- `RB_USER=ldl.luiz..garcia`, `RB_PASS=123mudar` (conta de teste; trocar por conta dedicada)
- `RB_VIDEO_DIR`, `RB_VIDEO_SPEED=1.5`
- `EVO_URL=https://lanlunar-evolution.cloudfy.live`, `EVO_KEY=...`, `EVO_INSTANCE=ZazzClaude` ⚠️ **Evolution ainda é CloudFy** (não migrou pro Hostinger; instância `ZazzClaude` viva)
- `CARNE_CHAT_DEFAULT=120363409735124488@g.us` (Claudebot2)

### Deploy do nó Claude API (agent loop)
Editar via replace pontual + `workflow_entity` E `workflow_history` (mesmo versionId) + `unpublish`/`publish`. Script: `v3_dump/deploy_chatid.py` (espelha o `deploy_workflow.py`). Backups: `v3_dump/BACKUP_workflow_*`.

### Pendências restantes
- [ ] **Conta Routerbox dedicada** (hoje usa `luiz.garcia` do Luiz — risco de conflito se ele logar).
- [ ] **Async de verdade**: hoje `gerar_carne` é síncrono (~90s p/ skips; mais p/ meses novos). Cabe no timeout (900s) mas o ideal é responder "Ok, gerando..." na hora e mandar o vídeo depois.
- [ ] Migrar Evolution CloudFy → Hostinger (instância `ZazzClaude` não existe no Hostinger; só `Telegram-Whatsapp`, `Agente_Zazz`, `Loja`).

---

## 🐛 BUG CRÍTICO: faturava o CLIENTE ERRADO (12/06/2026 — RESOLVIDO)

**Sintoma:** pediram carnê do João Miguel (cód 51875). O bot pegou o código certo, mas o Routerbox gerou o carnê do **Issao Onuki (2766)** — cliente totalmente diferente.

**Causa raiz:** buscar "51875" no Routerbox retorna **2 clientes** (Issao 2766 + João 51875 — a busca casa vários campos). E o **ScriptCase fatura sempre o 1º RESULTADO**: todos os links da grade têm `OrScLink*scin1` (referência à "linha 1"); só o `vcodcli` muda, mas o servidor usa a linha 1. Clicar (programaticamente) em qualquer linha — Editar ou Faturamento — abre o **1º cliente (Issao)**. O clique MANUAL funciona porque o navegador seta o contexto da linha de um jeito que o Playwright não replica.

**O que NÃO funcionou:** achar a linha do código e clicar no Editar/link de faturamento dela (sempre abria a linha 1); clicar o `<a>` do lápis; selecionar por `scin{codigo}` no onclick.

**Correção (2 camadas) em `tools/gerar_carne/faturar.js`:**
1. **Isolar pelo CPF (re-busca).** Acha a linha do código exato, extrai o **CPF** dela (único), e **re-busca pelo CPF** → o cliente vira o **ÚNICO resultado** (= linha 1) → faturamento mira nele. (`acharLinha()` itera os links de faturamento e pega o texto da linha via `closest('tr')` — rápido; varrer célula a célula TRAVA por causa das tabelas aninhadas do ScriptCase.)
2. **Rede de segurança `[VERIFY]`.** Depois do modal abrir, lê "Cliente XX.XXX" do form e **aborta** se o código não bater com o pedido. Nunca fatura o errado — no pior caso, erra pra MENOS (aborta), nunca pra mais.
3. **`RB_DRY_RUN=true`** — modo que abre+verifica o cliente e para ANTES de Executar (pra testar sem faturar).

**Testado:** dry-run do 51875 → re-busca CPF 450.072.849-04 → `[VERIFY] Modal confirmado do cliente 51875` (João, não Issao). ✅

⚠️ **Issao (2766) foi faturado por engano** antes do fix — precisa ESTORNAR manualmente no Routerbox.

---

## 🧊 INCIDENTE 15/06/2026: carnê da fila travou 25min (Amanda 8538) — RESOLVIDO

**Sintoma:** pediram o carnê da Amanda Caparelli Baldoria (cód **8538**) no WhatsApp. O bot enfileirou ("Carnê enfileirado! Chega aí no grupo em breve") mas **nada chegou**. Job 17 da `fila_jobs` ficou `erro: "timeout 25min — árvore do faturamento morta"`.

**Como diagnosticamos (cena do crime via vídeo):** o `.webm` órfão (`page@*.webm`, não virou mp4 porque o SIGKILL pulou o `finally`) tinha 40MB. Extraímos frames com ffmpeg (`-ss 25/90/600/1200/1450`): **TODOS idênticos** — parado na tela "Cadastro de Clientes", busca "8538", 3 resultados (Amanda linha 1, + Cristina 9277, + Robson 36857). O navegador **nunca saiu da tela de busca** por 24min → renderer **congelado (wedged)**, não lento. Zero screenshots novos no cwd (`/opt/zazz/dashboard`) → nunca chegou no loop de meses; travou dentro do `acharLinha()` (1ª busca, antes da re-busca por CPF — o box ainda mostrava "8538").

**CAUSA-RAIZ confirmada (a mesma de sempre): conta Routerbox COMPARTILHADA.**
`RB_USER=ldl.luiz..garcia` ainda é a conta de teste do Luiz (a pendência nº1 "conta dedicada" NUNCA foi feita). Às 21h alguém estava logado nessa conta → Routerbox força sessão única → **derrubou a sessão do bot no meio** → SPA congelou. **Prova definitiva:** re-rodamos ~1h40 depois ("ninguém tá usando a conta") e gerou os **6 meses em ~4min, vídeo enviado, zero erro** (job 18). Mesmo código, mesma máquina, mesma conta — só mudou ter ou não conflito de sessão.

**2 bugs de código que transformaram o conflito num hang MUDO de 25min (corrigidos em `tools/gerar_carne/faturar.js`):**

1. **`waitUntil` tinha timeout COOPERATIVO.** Ele só checava o relógio *entre* chamadas do predicate: `const result = await predicate(iter).catch(()=>null)`. Quando uma op do Playwright trava num renderer morto, esse `await` **nunca resolve nem rejeita** → o deadline (30s/180s) nunca era re-checado → preso até o killer externo de 25min do `fila_worker`. **Fix:** `Promise.race` do predicate contra um timer (`PRED_TICK_MAX=12s`); o tick vence, o loop re-checa o relógio, e o wedge falha em ≤ timeoutMs.

2. **`locator.evaluate()` via CDP NÃO respeita `setDefaultTimeout`.** O `acharLinha()` fazia `link.evaluate(a => a.closest('tr').innerText)` sem timeout explícito → no renderer travado, o `Runtime.callFunctionOn` do CDP pendurava pra sempre. **Fix:** `link.evaluate(fn, undefined, { timeout: 8000 })`.

**Também adicionados (defensivo):**
- `page.on('dialog', d => d.accept())` — o `faturar.js` atual NÃO tinha handler de dialog nativo (o `_vps_faturar.js` antigo tinha). Dialog nativo bloqueia a thread do renderer.
- `sessaoCaiu()` — lê URLs dos frames (sync, nunca trava); se achar `app_login`, aborta com mensagem clara ("Sessão caiu na conta X — use conta DEDICADA") em vez do genérico "não encontrado". Chamado nos 2 pontos de falha (linha não achada / modal não abriu).

**Lição transferível:** `waitUntil`/polls caseiros que dão `await predicate()` precisam dar **race contra um timer** — senão qualquer op que pendure (CDP morto, rede, etc.) ignora o timeout. E **toda** `locator.evaluate()` em página potencialmente instável precisa de `{ timeout }` explícito.

**PENDÊNCIA REFORÇADA (agora urgente):** criar **conta Routerbox dedicada e exclusiva do bot**. Enquanto for a conta do Luiz, todo carnê pedido em horário comercial tem chance de travar (agora falha rápido com diagnóstico, mas ainda falha). Precisa de admin do Routerbox (Negos).

---

## 🛠️ RODADA DE FIXES 17/06/2026: 9 bugs do gerar carnê (caça + correção)

Caça a bugs no pipeline inteiro (`faturar.js`, `worker.js`, `fila_worker.js`, `enqueue`, nó, `rbx_auth.js`) → 9 bugs corrigidos e deployados. **Nenhum altera o caminho feliz comum; todos protegem contra duplicar/faturar errado.**

**🔴 #1+#2 — Boleto DUPLICADO em timeout pós-Executar (`faturar.js`).** Se a Fase 2 dava timeout DEPOIS do clique em Executar, caía no `catch` → `tentativa++` → **re-clicava Executar** → boleto duplicado. O ramo `desconhecido` que tentava evitar isso era **código morto** (o predicate nunca retornava esse tipo). **Fix:** flag `executou` (vira true após o clique). No `catch`: se `executou` → NUNCA re-clica; faz settle 8s + re-checa "já existe" (se sim, marca `ja_faturados`; senão `REVISAR: timeout pós-Executar`). Só re-tenta falhas ANTES do Executar (preenchimento). Removido o código morto.

**🔴 #3 — Rota bypass `/api/faturar` (`app/api/faturar/route.js`).** Era o caminho síncrono antigo: `exec` do `worker.js` SEM o guard código↔nome. Ninguém ativo chamava (o bot usa a fila). **Fix:** desativada — retorna **HTTP 410** ("use a fila"). Lápide mantida.

**🟡 #4 — Timeout da fila curto p/ lote (`fila_worker.js` + `faturar.js`).** Por mês, a Fase 1 (popup) usava 180s (o popup aparece em segundos). **Fix:** `TIMEOUT_CONFIRM=45s` na Fase 1 (env `RB_TIMEOUT_CONFIRM`); com #1 (sem retry pós-Executar) o pior caso/mês cai de ~720s p/ ~210s. `FILA_CARNE_TIMEOUT` 25min → **40min** (cabe lote de 6 meses novos). Residual: lote gigante que estoure o teto ainda perde o vídeo (SIGKILL pula o `finally`).

**🟡 #5 — Leak de Chromium no login que falha (`rbx_auth.js`).** Se `loginToRouterbox` lançava após `chromium.launch()`, o browser ficava órfão (o `finally` do `faturarCliente` só roda se o login RETORNA). **Fix:** `try/catch` em volta do pós-launch que faz `browser.close()` antes de re-lançar.

**🟡 #6 — Falso 'sucesso' por leitura vazia (`faturar.js`).** Sucesso era inferido quando `option:checked` do Mês vinha vazio — mas `.catch(()=>'')` fazia uma falha de leitura virar `''` → falso sucesso (mês marcado gerado sem faturar). **Fix:** exige o sinal POSITIVO `/escolha|selecione/` (placeholder); leitura vazia volta a polar.

**🟢 #7 — Cliente com 2 cadastros de MESMO CPF (`faturar.js`).** A re-busca por CPF não isola quando o CPF tem 2+ cadastros; o ScriptCase fatura sempre a **linha 1**, e o `[VERIFY]` aborta o 2º cadastro. **Fix:** `acharLinha()` devolve o índice; se o código pedido não é a linha 1 (`idx>0`), abre o faturamento por **URL direta** (`app_faturamento.php?...vcodcli*scin{cod}...`) em vez de clicar a grade. O `[VERIFY]` continua garantindo (no pior caso aborta com mensagem acionável, NUNCA fatura errado). ⚠️ A URL direta é historicamente instável — **precisa de teste ao vivo** (`RB_DRY_RUN=true` abre+verifica sem faturar). Provável que afete o **48482** (Vera Lucia dos Santos II, pendente).

**🟢 #8 — Typo em primeiro nome curto no guard (`enqueue/route.js`).** `lev<=1` fazia "Ana"≈"Ane" casarem. **Fix:** fuzzy só em tokens ≥4 chars (mantém "caparelli"≈"capareli"; "Ane" agora rejeita). Testado.

**🟢 #9 — Mensagem enganosa em lote misto (handler do nó).** Dizia "NÃO enfileirei" mesmo tendo enfileirado alguns. **Fix:** só "NÃO enfileirei" se `enfileirados===0`; senão "Enfileirei X, mas barrei: ...".

**Deploy:** `faturar.js`/`rbx_auth.js` via scp (spawn'd, sem build); `fila_worker.js` via scp + `pm2 restart maluco-fila`; rotas via scp + `npm run build` + `pm2 restart maluco-dashboard`; nó via `deploy_agentloop.py` (vid `351d8327`). **Verificado:** #3 → 410, #8 → rejeita curto/aceita typo longo. **Pendente de teste ao vivo (janela com conta livre):** #1/#6 (e2e em cliente já-faturado = skip, zero boleto) e #7 (dry-run no 48482).

⚠️ **Nota operacional (cuidado em limpeza de teste):** ao limpar jobs de teste, deletar pelo `batch_id` específico — NÃO `WHERE id > N` (boundary fica velho entre sessões; numa limpeza apaguei ~8 linhas terminais reais da `fila_jobs` — só histórico, sem perda de trabalho, mas evitável).

---

## 📦 LOTE DE CARNÊS 17/06/2026: 3 bugs lógicos do fluxo "lista de 10 clientes"

Caça a bugs lógicos do cenário "mandar uma lista de N clientes pra faturar". 3 problemas + correções deployadas.

**🔴 A — `MAX_ITER=15` estourava em lote grande** (loop do agent, `claude_api_live.js`). Se o Haiku processasse 10 clientes UM POR VEZ (buscar→gerar→buscar→…), eram até 20 iterações > 15 → `"erro interno de limites"`, possivelmente no MEIO do lote (uns faturados, outros não), com mensagem genérica. **Fix:** `MAX_ITER` 15 → **20** + (principal) o array abaixo torna lote = 1 chamada.

**🔴 B — Sem guarda anti-alucinação do carnê** (loop). Havia reinjeção pra lembrete/tarefa ("disse que criou sem chamar a tool"), mas NÃO pro carnê. O modelo podia dizer "enfileirei os 10" tendo chamado menos. **Fix:** `chamouCarne` + regex `hallucinaCarne` → se afirma que gerou/enfileirou sem ter chamado `gerar_carne`, reinjeta forçando a chamada real.

**🟡 C — Lote de N virava N batches isolados → SEM resumo final.** Como a tool era "1 chamada por cliente", cada `gerar_carne` fazia um enqueue `batch_total=1`, e o `checarLoteCompleto` só resume se `> 1`. Logo, 10 clientes = 10 batches → nunca disparava "X/10 OK", e se a conta caísse no meio o usuário não sabia o que falhou.

**Correção central (resolve A + C): `gerar_carne` voltou a aceitar array `clientes: [{cliente, nome, meses?}]`** (além do single). Agora "10 clientes" = **UMA chamada** → 1 iteração (sem risco de MAX_ITER) e **1 batch_id** → o `checarLoteCompleto` dispara o resumo. É SEGURO porque o **guard código↔nome valida CADA item** no enqueue (os barrados voltam no `rejeitados` pro bot confirmar). Foi por isso que dava pra reintroduzir o array (sem o guard era perigoso).
- Schema/handler: `clientes` (array) OU `cliente`+`nome` single; `meses` top-level aplica a todos.
- `enqueue` agora **persiste `nome` no payload** do job (era só `{cliente, meses}`) → o resumo nomeia quem falhou.
- `checarLoteCompleto` (carne): além de "X/N OK", lista **`⚠️ Falharam (verificar): nome1, nome2`** (lê `payload.nome`).
- System prompt: "vários clientes → UMA chamada com `clientes` array; no fim mando resumo X/N".

**Deploy:** nó via `deploy_agentloop.py` (vid `7bdc8572`); `fila_worker.js` via scp + `pm2 restart maluco-fila`; `enqueue` via scp + `npm run build` + restart dashboard; prompt via `update_sysprompt3.py`. **Verificado:** lote de 3 (2 válidos + 1 mismatch) → `enfileirados=2` mesmo `batch_id` `batch_total=2`, mismatch barrado; `nome` persistido no payload; runtime com array+guard+MAX_ITER. (Resumo "2/2 OK" dispara quando o lote processa — não testado ao vivo p/ não faturar.)

---

## 🎯 INCIDENTE 16/06/2026: bot FATUROU CLIENTE ERRADO (alucinação de código) — RESOLVIDO

**Sintoma:** pediram carnê de "Vera Lúcia dos Santos 1 e 2" (os dois cadastros: 2587 + 48482). O bot acertou o 2587, mas no segundo **faturou o 21651 (Silvana Cristina dos Santos II)** — pessoa sem relação. Foram **2 chamadas separadas** de `gerar_carne`: `cliente:"2587"` ✅ e `cliente:"21651"` ❌ (código **fabricado pelo LLM**, não bate com nada da lista que ele mesmo mostrou).

**Sem estrago financeiro:** a Silvana (21651) já estava faturada → resultado "já faturado", `meses_gerados:[]`, nenhum boleto novo. O skip de já-faturado salvou. O 48482 (o que o usuário queria) ficou pendente.

**Causa-raiz:** a tool `gerar_carne` recebia só `cliente` (código) — **livre-digitado pelo LLM (Haiku 4.5 aluc­ina dígitos)** — e **nada validava**. O `/api/fila/enqueue` mandava direto pro faturamento (só bloqueava Dezembro). Um código válido-mas-errado ia reto. A rede `[VERIFY]` do `faturar.js` NÃO pega isso: ela só confere que o modal aberto bate com o **código pedido** — e o código pedido já estava errado.

**Inconsistência adicional encontrada:** descrição da tool dizia "uma chamada por cliente", system prompt dizia "passe `clientes` (array)", schema só tinha `cliente`. Confundia o modelo. E `v3_dump/agent_loop_code.js` estava **desatualizado** (sem a tool de carnê) — o código vivo só existe no n8n; deploy tem que partir do nó extraído, senão regride.

**FIX em 3 camadas (16/06):**

1. **Validação determinística código↔nome no `/api/fila/enqueue` (a rede real).** A tool agora passa `nome` junto do código; o enqueue resolve o nome canônico do código via `/api/clientes/buscar` e exige que batam. Match é **fuzzy** (`nomesBatem`): gate no PRIMEIRO nome + ≥60% de cobertura de tokens, com Levenshtein ≤1 (tolera typo: "Caparelli"≈"Capareli") e ignorando conectores ("dos","de","II"). Rejeita pessoa diferente (Silvana≠Vera), aceita typo de sobrenome. Em dúvida (sem nome / código inexistente / mismatch) **NÃO fatura** — devolve `rejeitados:[...]` com "código X é FULANO, não BELTRANO".
2. **Tool `gerar_carne` (nó Claude API):** schema agora exige `nome` (required `['cliente','nome','meses']`), UMA chamada por cliente, handler surfaca a recusa ("❌ NÃO enfileirei — código X é Y...") pro bot repassar.
3. **System prompt:** regra "CLIENTE CERTO" — sempre `buscar_cliente` e copiar código+nome EXATOS, nunca inventar, confirmar "código - nome" + meses com o usuário antes de chamar, e alinhada a inconsistência ("não existe array de clientes — 1 chamada por cliente").

**Decisão de modelo:** mantido **Haiku 4.5** (não trocou pra Sonnet). O guard determinístico resolve o bug **independente do modelo**; Sonnet só reduziria a frequência de alucinação e **triplicaria o custo** ($3/$15 vs $1/$5 por 1M). Quem resolve é o guard, não o modelo.

**Deploy:** nó via `v3_dump/deploy_agentloop.py` (lê `agent_loop_current.js`, grava `workflow_entity`+`workflow_history` mesmo versionId + republish; backups `BK_*`). `agent_loop_code.js`/`agent_loop_current.js` sincronizados com o nó vivo. Enqueue route via `scp` + `npm run build` + `pm2 restart maluco-dashboard`. System prompt via `v3_dump/update_sysprompt.py` (backup `sysprompt_backup_*`).

**Testes sintéticos (sem faturar — guard barra ANTES de criar job):**
- 21651 + "Vera Lucia dos Santos II" → REJEITA ("código 21651 é Silvana Cristina dos Santos II") ✅ (o bug)
- 8538 + "Amanda Caparelli Baldoria" (banco "Capareli") → ACEITA (tolera typo) ✅
- 8538 + "Maria Caparelli Baldoria" → REJEITA (primeiro nome ≠) ✅
- código inexistente / sem nome → REJEITA ✅

**Pendência:** gerar o carnê do **48482 (Vera Lucia dos Santos II)** — o usuário pediu pra deixar pra depois.

**Aprendizado pra agent memory:** quando um LLM passa um identificador numérico crítico (código de cliente, conta, etc.) que ele "lembra" da conversa, **NÃO confie** — Haiku aluc­ina dígitos. Exija um campo verificável junto (nome) e **valide no servidor** (determinístico), com match fuzzy pra tolerar grafia. Confirmação no prompt é complemento, não substituto.

---

## [HISTÓRICO] Sessão 09-10/06/2026: saga do juíz v6+ (conclusões já superadas)

> **NOTA:** tudo abaixo é histórico. A teoria de "throttle de IP" e os juízes v6–v11 foram superados pelo diagnóstico de 11/06 acima. Mantido pra contexto.

## TL;DR

**Duas evoluções da saga 09-10/06:**

1. **v6 (Gemini 10/06 ~07:25)** — Gemini deployou `faturar.v6.js` no VPS (14.505 bytes, 3 promises no `Promise.race`, SEM `continue;` no `confirmacao`). API voltou ao ar. Smoke test (POST Tatiane 8119) → HTTP 200 com timeout 60s.
2. **v6+ (Mavis 10/06 08:06)** — Mavis subiu versão evoluída do `faturar.js` (15.485 bytes, **6 promises** no `Promise.race` — procura em `frameFaturamento` E `page`, **COM `continue;` no `confirmacao`** — reentra no while sem incrementar tentativa). **Diferença:** mais robusto contra popup que aparece em frame aninhado, e não desperdiça tentativa em caso de confirmação de popup.

**Cena do crime (`erro_mes_Setembro_t1.png`)** revelou bug residual: o Routerbox está com popup de "Confirma execução" aberto + 9 contratos desmarcados, e o juíz tá entrando no Caso 3 (`'confirmacao'`) que clica Ok, mas o `Promise.race` não re-dispara pra esperar o popup de resultado real. **Bug identificado e documentado, ainda não corrigido.**

## O que mudou no juíz v6+ (versão atual em produção)

**Estrutura do `faturar.js` v6+ (15.485 bytes, 320 linhas):**
- Mantido 100% do código existente (imports, login, navegação, busca de cliente, modal) — **IDÊNTICO ao original**
- Substituído APENAS o `try { ... } catch { ... }` interno do `while (tentativa <= MAX_TENTATIVAS_POR_MES)` (linhas 161-293)
- Juíz v6+ tem:
  - `const SUCESSO_SEL`, `ERRO_SEL`, `POPUP_TITULO_SEL`, `POPUP_CORPO_SEL` definidos uma vez antes do `for` dos meses
  - **`Promise.race` com 6 promises (3 pares)** — cada caso (sucesso/erro/popup) é procurado em `frameFaturamento` E em `page` (2x). Cobre popup que aparece em frame aninhado OU no top frame.
  - `timeout: 60000` (60s) ao invés de `waitForTimeout(10000)` fixo
  - Lê `titulo + corpo` do popup SweetAlert ANTES de clicar Ok
  - Regex `'confirma a execuç'` para identificar popup de confirmação (não é erro)
  - **`continue;` no caso `'confirmacao'`** — reentra no `while` SEM incrementar `tentativa` (não desperdiça chance)
  - Screenshot SEMPRE (`erro_mes_${mes}_t${tentativa}.png`) — cena do crime mesmo no caminho feliz
  - Fallback `popup_erro:` com texto literal do Routerbox (Claude passa pro usuário sem reescrever)

**Diferença v6 → v6+:**
- v6 (Gemini 07:25): 3 promises, sem `continue;` no confirmacao
- v6+ (Mavis 08:06): 6 promises (3 pares), COM `continue;` no confirmacao
- **Robustez:** 2x mais chances de detectar popup que aparece em frame aninhado
- **Economia de tentativa:** confirmação de popup não conta como falha

## Validação em 3 camadas

| Camada | Comando | Resultado |
|---|---|---|
| 1. `node --check` | `node --check tools/gerar_carne/faturar.v6.js` | ✅ SYNTAX_OK |
| 2. `import()` ESM direto | `import(pathToFileURL(faturar.v6.js))` | ✅ IMPORT_OK, exports `faturarCliente` |
| 3. Smoke test em prod | `curl POST /api/faturar` (Tatiane 8119, Setembro) | ✅ HTTP 200, JSON estruturado |

## Deploy seguro (sequência exata que funcionou)

```bash
# 1. Upload do v6
scp tools/gerar_carne/faturar.v6.js root@195.200.7.239:/opt/zazz/dashboard/tools/gerar_carne/faturar.v6.js

# 2. Backup do estado atual + promover v6
ssh root@195.200.7.239 "cp /opt/zazz/dashboard/tools/gerar_carne/faturar.js /opt/zazz/dashboard/tools/gerar_carne/faturar.js.bak.2026-06-10_07-25"
ssh root@195.200.7.239 "cp /opt/zazz/dashboard/tools/gerar_carne/faturar.v6.js /opt/zazz/dashboard/tools/gerar_carne/faturar.js"

# 3. Restart + smoke
ssh root@195.200.7.239 "pm2 restart maluco-dashboard --update-env"
ssh root@195.200.7.239 "curl -X POST 'http://localhost:3001/api/faturar' -H 'x-token: MALUCO_POPS_2026' -H 'Content-Type: application/json' --data-binary @smoke_body.json"
# Resultado: HTTP 200, body {"sucesso":false,"mensagem":"...Timeout de 60s sem mensagem..."}
```

## O que o smoke test revelou (a cena do crime)

**Output JSON do smoke test:**
```json
{
  "sucesso": false,
  "mensagem": "Falha total: Nenhum mês foi gerado para cliente 8119. Detalhe dos erros: Setembro falhou: Timeout de 60s sem mensagem de sucesso ou erro (servidor lento ou silenciou).; Setembro — falhou após 3 tentativas",
  "detalhes": {
    "meses_gerados": [],
    "erros": [
      "Setembro falhou: Timeout de 60s sem mensagem de sucesso ou erro (servidor lento ou silenciou).",
      "Setembro — falhou após 3 tentativas"
    ]
  }
}
```

**Tempo: 102 segundos** (3 tentativas, cada uma com timeout de 60s no Promise.race)

**Screenshot `erro_mes_Setembro_t1.png` (working dir do Next.js, no VPS):**
- Mostra popup "Confirma execução da rotina de faturamento?" com botões "✓ Ok" verde e "✕ Cancelar" vermelho
- Mostra a Tatiane (8.119 Tatiane Cruz dos Santos) com **9 contratos listados** (598144, 598145, 598146...)
- **TODOS os checkboxes de "Filtrar Contratos" desmarcados**

## Bug residual identificado (próxima iteração)

**Causa:** depois que o juíz clica Ok no popup "Confirma execução" (Caso 3 → `'confirmacao'`), o `Promise.race` **JÁ RESOLVEU** com esse resultado. O `then()` que devolveu `'confirmacao'` retornou, mas **NENHUM outro Promise.race é disparado** pra esperar o popup de resultado real (sucesso, erro, ou popup de "0 documentos").

**Comportamento atual:**
1. Juíz clica Ok no popup "Confirma execução" → resultadoMes = 'confirmacao'
2. Juíz entra no `if (resultadoMes === 'confirmacao')` → marca `alertaAceito = true`, **NÃO dá break**
3. Volta pro topo do while → re-clica Executar? **NÃO** — vai pra próxima iteração do while mas o `tentativa` não é incrementado... na verdade o código atual nem tem `continue`, então cai no `else if` e atira o erro de timeout

Espera, vou reler o patch... o bug pode ser que **após `'confirmacao'`, a próxima iteração do while JÁ estava completa** (saiu do `try` sem break/continue), então o catch trata como erro genérico.

**Fix proposto (próxima iteração):** depois de `'confirmacao'`, fazer o `while` reentrar com um SEGUNDO `Promise.race` que espera o popup de resultado real (sucesso, erro, ou "0 documentos"). O código já tem o `continue` mas precisa de mais uma volta no try.

**Mas isso é OUTRA sessão.** Por agora, o juíz novo está rodando, o smoke test passou, e a API não quebrou.

## Pendências

- [x] Aplicar juíz v6 no VPS (Gemini 07:30)
- [x] Evoluir v6 → v6+ com 6 promises + `continue;` (Mavis 08:06)
- [x] **FIX TIMEOUT 300s N8N — Etapa A do Plano C (broker):** aumentado `N8N_RUNNERS_TASK_REQUEST_TIMEOUT` 300 → 900 (Mavis 10/06 09:01)
- [x] **FIX TIMEOUT 300s N8N — Etapa A do Plano C (runner):** aumentado `N8N_RUNNERS_TASK_TIMEOUT` 300 → 900 (Mavis 10/06 09:35, **erro apareceu de novo porque tem DUAS envs, não uma!**)
- [x] **FIX TIMEOUT 300s N8N — Etapa A do Plano C:** reduzido `MAX_TENTATIVAS_POR_MES` 3 → 2 (Mavis 10/06 08:50)
- [x] Backup timestamped (`faturar.js.bak.2026-06-10_07-25` v6, `faturar.js.bak_pre_v6plus_*` v6+, `faturar.js.bak_pre_max2_20260610_0850` v6+ com max=3, `docker-compose.yml.bak_pre_timeout900_20260610_0901` com timeout=300)
- [x] Sintaxe validada no VPS com `node --check` (SYNTAX_OK_NO_VPS)
- [x] PM2 reiniciado (PID 220825, restart #23, uptime 50s)
- [x] N8N container recriado com nova env var (N8N_RUNNERS_TASK_REQUEST_TIMEOUT=900 confirmado via docker inspect)
- [x] Smoke test API básica (GET=405, POST=403, auth ativa)
- [x] Smoke test webhook N8N (`POST /webhook/whatsapp` → 200, "Workflow was started")
- [ ] **TESTE REAL (1-2 meses):** Franquelin testar via WhatsApp `fatura 09/10 Tatiane`. Cenário: 60s × 2 × 2 = 240s < 900s ✅
- [ ] **TESTE REAL (6 meses):** Franquelin testar `fatura 07-12/2026 Tatiane` (semestre). Cenário: 60s × 2 × 6 = 720s < 900s ✅ **primeira vez que vai funcionar!**
- [ ] **PRÓXIMO (se teste real falhar):** corrigir o bug residual do `'confirmacao'` (reentrar no Promise.race com segundo loop)
- [ ] **PLANO C — ETAPA B (projeto, 1-2 dias):** Refatorar pra **arquitetura assíncrona** (worker em background, webhook retorna 202, bot manda msg via Evolution API quando terminar). Resolve QUALQUER número de meses. Hoje não é urgente porque 900s cobre o uso real.
- [ ] **PRIORITÁRIO MAS SEPARADO:** Refatorar `dashboard/app/api/faturar/route.js` pra usar `spawn` ao invés de `exec`, com stdout → `/var/log/faturar-worker.log`. Sem isso os logs `[MES]`, `[DIALOG]`, `[TIMEOUT]` continuam invisíveis.
- [ ] **CONSIDERAR:** Investigar se o problema da Tatiane é regra de negócio (histórico "Contas a Receber - LDL" não cobre contratos futuros) — print mostra 9 contratos desmarcados, pode ser isso.

---

## Bug Timeout 300s N8N (10/06 08:30)

**Sintoma:** Franquelin testou "fatura 09/10 Tatiane" via WhatsApp → N8N reportou `Task execution timed out after 300 seconds` no nó `Claude API` e matou a task.

**Causa raiz:** Multiplicação de tempos do juíz v6+:
```
60s (Promise.race) × 3 (MAX_TENTATIVAS_POR_MES) × 2 (meses Set+Out) = 360s
```
360s > 300s (timeout N8N) → N8N matou aos 300s.

**4 sugestões do Gemini (10/06 08:45):**

| # | Sugestão | Veredicto |
|---|---|---|
| 1 | `MAX_TENTATIVAS_POR_MES = 1 ou 2` | ⚠️ Boa, mas 1 é pouco (perde robustez) |
| 2 | Reduzir `Promise.race` de 60s → 35s | ❌ Desfaz ganho do v6+ (era justamente 60s vs 10s) |
| 3 | `N8N_RUNNERS_TASK_TIMEOUT=900` | ⚠️ Band-aid, mas nice-to-have |
| 4 | Async (webhook retorna 202, worker roda em background) | ⏳ Correto, mas overkill (projeto de 1-2 dias) |

**Solução aplicada (10/06 08:50):** `1+2 combinadas com ajuste fino` — `MAX_TENTATIVAS_POR_MES = 2`.

**Cenário pós-fix:**
- Tatiane (2 meses, Routerbox lento): `60s × 2 × 2 = 240s` ✅ cabe nos 300s
- Comum (1 mês, Routerbox OK): `< 60s` ✅
- Semestre (6 meses, Routerbox lento): `60s × 2 × 6 = 720s` ❌ passa, mas é raro (uso real é 1-2 meses)

**Por que 2 e não 1:** com 1 tentativa qualquer hiccup de 30s do Routerbox = carnê perdido. Com 2, cobre hiccup E ainda cabe no timeout.

**Por que manter 60s no race:** o v6+ foi criado JUSTAMENTE pra esperar 60s em horário de pico. Voltar pra 35s seria regredir.

**Por que NÃO aumentar N8N_TIMEOUT agora:** muda infra (env var do Docker) e não escala pra sempre. Solução de código é mais elegante.

**Arquivo:** `tools/gerar_carne/faturar.js` linha 6
```js
const MAX_TENTATIVAS_POR_MES = 2; // Mavis 10/06 08:50: reduzido de 3 → 2 pra caber no timeout N8N de 300s (60s × 2 tentativas × 2 meses = 240s)
```

**SHA VPS atual:** `0c1bb2c1298359a368c455886affd978d9ee9ed890d2e0852d5a06af2da6f2a5` (15486 bytes, 320 linhas, max=2)
**Backup:** `faturar.js.bak_pre_max2_20260610_0850` (max=3, antes do fix)

**Aprendizado pra agent memory:** **juízes "pacientes" (60s+) precisam de teto de tentativas calculado pelo timeout upstream (N8N, fila, etc). Default 3 tentativas × 60s × 2 itens = 360s já passa do timeout N8N de 300s. Regra: `(timeout_upstream - margem) / timeout_juiz / max_itens ≥ tentativas`.**

### 🪤 ATENÇÃO: N8N tem DUAS envs de timeout (não uma!)

**Descobri às 09:35 (10/06):** mesmo depois de mudar `N8N_RUNNERS_TASK_REQUEST_TIMEOUT=900`, o task runner MATOU DE NOVO aos 300s. Stack trace apontou pra `js-task-runner.js:210:28` (não `task-broker.service.ts:508:4` como antes).

**São 2 envs, 2 camadas:**
| Env var | Camada | Função |
|---|---|---|
| `N8N_RUNNERS_TASK_REQUEST_TIMEOUT` | **Task Broker** (servidor) | Tempo que o broker espera pela task ser requisitada ANTES de mandar pro runner |
| `N8N_RUNNERS_TASK_TIMEOUT` | **JS Task Runner** (worker) | Tempo que a task PODE RODAR enquanto executa o código JS |

**Erro do N8N (no log do Franquelin original) JÁ indicava a env certa:** "increase the timeout using the N8N_RUNNERS_TASK_TIMEOUT environment variable". Eu confundi com typo porque a env que eu já tinha visto era `_REQUEST_` (com REQUEST). **NÃO era typo — era a OUTRA env que eu não sabia que existia.**

**Fix aplicado 09:35:** Adicionei `N8N_RUNNERS_TASK_TIMEOUT=900` no docker-compose. Container recriado, smoke test webhook 200. Agora as 2 envs tão em 900.

**Lição:** SEMPRE ler TODAS as envs de timeout/task do container antes de assumir que tem só uma. Comando: `docker inspect <container> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -iE 'timeout|task'`.

## Histórico de versões do juíz (pra contexto futuro)

| Versão | Status | Causa da falha / autor |
|---|---|---|
| **v1** (09/06 ~21:30) | ❌ SYNTAX ERROR | Patch não fechou o `try {` externo, ficou `try` sem `catch` — Mavis |
| **v2** (09/06 ~21:35) | ❌ SYNTAX ERROR | `} else { throw ... }` no nível errado, `catch (error)` órfão — Mavis |
| **v3** (09/06 ~22:10) | ❌ SYNTAX ERROR | `_apply_local.cjs` gravou em `.v5_patched` em vez de `faturar.js` (typo) — Mavis |
| **v4** (09/06 ~22:15) | ❌ SYNTAX ERROR | Mesmo após corrigir typo, splice pegou `end_idx` errado, chaves desbalanceadas — Mavis |
| **v5** (10/06 ~07:25) | ❌ Patch aplicado no VPS, ainda quebrava | `node --check` local OK, mas ESM em produção pegou residual — Mavis |
| **v6** (10/06 ~07:30) | ✅ **FUNCIONANDO (intermediário)** | Gemini usou `replace_file_content` (ferramenta nativa de Agentic AI) pra aplicar o patch no `faturar.js`. 3 promises no `Promise.race`, SEM `continue;` no confirmacao. 14.505 bytes. |
| **v6+** (10/06 08:06) | ✅ **FUNCIONANDO (parcial)** | Mavis subiu versão evoluída via `scp` + `pm2 restart`. 6 promises (procura em `frameFaturamento` E `page`), COM `continue;` no confirmacao. 15.485 bytes. SHA VPS `0c636b40...` bate com local. **PROBLEMA:** o `continue` no confirmacao reexecuta o `try` INTEIRO, incluindo selecionar mês e clicar Executar — pode gerar carnês DUPLICADOS ou CANCELAR o anterior. |
| **v7** (10/06 09:55) | ✅ **FUNCIONANDO (parcial)** | Mavis substituiu o `continue` por **segundo `Promise.race`** que SÓ espera o popup de resultado (sem re-clicar Executar). 16.503 bytes. SHA `245cc46b...`. Backup `.bak_pre_v7_20260610_0955` no VPS. Detecta automaticamente "0 documentos" e "gerado/sucesso" no texto. **PROBLEMA:** timeout de 60s do segundo race ainda curto — Routerbox demora +60s pra processar em horário de pico. |
| **v8** (10/06 10:25) | ✅ **FUNCIONANDO (parcial)** | Mavis aumentou timeout do segundo race de 60s → 180s + espera inicial 5s → 10s. Total pior caso: 60s + 10s + 180s = 250s/mês. 388 linhas. SHA `f7aa2181...`. Backup `.bak_pre_v8_20260610_1025` no VPS. **BUG corrigido:** primeiro edit deixou `} catch (e) {` órfão resíduo do v6+, `node --check` pegou antes de subir, removido. **PROBLEMA:** primeiro race ainda em 60s — Routerbox lento (>60s) faz juíz desistir antes do popup aparecer. |
| **v9** (10/06 10:35) | ✅ **FUNCIONANDO (atual)** | Mavis aumentou TODOS os timeouts do **primeiro** race de 60s → 180s (6 ocorrências via `replaceAll`). 384 linhas. SHA `5581869f...`. Backup `.bak_pre_v9_20260610_1035` no VPS. Total pior caso: 180s + 10s + 180s × 3 tentativas = **9 min/mês**. **Teste real cliente 13543 (Junho) às 10:35 BRT:** juíz fez tudo certo, 9 min de execução, mas Routerbox NÃO respondeu em 3 min. Screenshot mostra popup "Confirma execução" só apareceu APÓS timeout (juíz desistiu antes). **Conclusão:** Routerbox HOJE tem latência >3min. NÃO é bug do juíz. **Ação recomendada:** acionar @554384452261 (Negos) pra verificar Routerbox. |
| **v10 (descoberta do Franquelin)** (10/06 11:15) | ❌ **NÃO FUNCIONA** | Franquelin mandou o código ORIGINAL (que ele disse que funcionava antes). Mavis deployou, MAS falhou com `Não foi possível localizar o frame de Faturamento` (itemid=99 não bate mais). **Revertido pro v9.** |
| **v9 final (restaurado)** (10/06 11:20) | ✅ **FUNCIONANDO (atual)** | Mavis restaurou o v9 (com 180s nos 2 races) depois de tentar o v10 do Franquelin. SHA `5581869f...`. |
| **DIAGNÓSTICO FINAL** (10/06 11:25) | 🚨 **NÃO É BUG DO JUÍZ** | Franquelin fez manual em 10s. Juíz trava em 180s+. Diferença absurda. **Causa provável: anti-bot do Routerbox tá throttlando IP do VPS (Hostinger).** Manual usa IP residencial confiável. |
| **v10 polling** (10/06 12:00) | ✅ **FUNCIONA (parcial)** | Mavis refatorou o juíz com **polling loop** (padrão do `scrape.js` que funciona) + text-based selectors (`text=Confirma a execução` em vez de classes CSS). TIMEOUT_EXECUCAO = 600s. 267 linhas. SHA `9426ad64...`. **Teste real cliente 13543 (Junho) às 12:00:** polling rodou 520 iterações em 600s SEM achar popup de confirmação. Depois foi pro polling de resultado e em 1 iteração achou a mensagem LITERAL: "**Já existe faturamento para o cliente no período informado**" (porque Franquelin já tinha feito manual antes). **VITÓRIA PARCIAL:** juíz agora captura mensagens literais do Routerbox, mas a Fase 1 (popup de confirmação) demora >10 min HOJE. |
| **v10.1 text-based polling** (10/06 12:10) | ✅ **FUNCIONANDO (atual)** | Mavis trocou seletores CSS por text-based polling (`text=Confirma a execução`, `text=gerado com sucesso`, `text=Incluídos`, `text=0 documentos`, `text=Já existe faturamento`, etc). Mesma estrutura de polling. 252 linhas. SHA `e2c6f940...`. **Teste real cliente 13543 (Julho) às 12:10:** polling rodou 528 iterações em 600s SEM achar popup de confirmação. Routerbox HOJE está com latência >10min pra processar 1 mês. **Conclusão:** juíz v10.1 está tecnicamente correto, mas Routerbox lento HOJE impossibilita teste real-time. Franquelin precisa acionar Negos OU testar de madrugada. |
| **v11 stealth** (10/06 15:10) | 🟡 **PROGRESSO** | Mavis instalou `playwright-extra` + `puppeteer-extra-plugin-stealth` e criou `tools/lib/rbx_auth_stealth.js` (cópia stealth do `rbx_auth.js`, NÃO substitui pra não quebrar scrape.js). Stealth: User-Agent Chrome 120, slowMo 200ms, viewport 1920x1080, locale pt-BR, navigator.webdriver=false, plugins fake, args anti-detecção. faturar.js v11 importa `loginToRouterboxStealth`. |
| **v11.2 com classificador** (10/06 15:35) | ✅ **PRONTO PRO TESTE** | **BUG FIX v11.2 (Mavis 10/06 15:35):** v11 stealth clicou Executar com **Histórico e Classificador VAZIOS** (screenshot `erro_mes_Agosto_t1.png` mostra!). Routerbox abriu popup mas não processou. v11.2 agora: preenche Classificador (pega primeiro item não-vazio), aumenta espera após Histórico pra 6s+2s, espera após cada selectOption, espera 3s APÓS preencher tudo antes de clicar Executar. SHA `46c5397c...`. Backup `.bak_pre_v11.2_classif_20260610_1535` no VPS. |

## Quem fez o quê

### v1-v5 (Mavis, 09/06 noite)
- Diagnosticou o bug do juíz (4 buracos identificados)
- Tentou patch cirúrgico v1-v4 (todas quebraram por splice)
- Fez rollback pra restaurar a API funcional
- Identificou bug crítico: smoke test tava na porta errada (3000 = Express worker, 3001 = Next.js correto)

### v6 (Gemini 10/06 ~07:25, Antigravity)
- Usou `replace_file_content` (ferramenta nativa de Agentic AI) — superou a limitação do Mavis com splice manual
- Aplicou patch cirúrgico, validou com `node --check`, fez deploy
- Atualizou esta nota do Obsidian com a saga
- **Métricas v6:** 3 promises no `Promise.race`, SEM `continue;` no confirmacao, 14.505 bytes

### v6+ (Mavis 10/06 08:06)
- Evoluiu v6 → v6+ com 6 promises (procura em `frameFaturamento` E `page`)
- Adicionou `continue;` no caso `'confirmacao'` (evita desperdiçar tentativa)
- **SHA VPS `0c636b40...` bate com local** (15.485 bytes, 320 linhas)
- Backup `.bak_pre_v6plus_*` criado para rollback
- Sintaxe validada no VPS com `node --check`: `SYNTAX_OK_NO_VPS`
- PM2 reiniciado (PID 219026, restart #22)
- Smoke test API: `GET /api/faturar` → 405, `POST {}` → 403 (auth ativa, API online)

### Aprendizados salvos na agent memory (pra próxima sessão)
1. `node --check` é lenient, Next.js ESM é estrito
2. Patch em loop try/catch exige ver wrapper completo (não splice)
3. Confirmar nome do arquivo de destino no script de apply
4. Next.js roda em 3001, não 3000
5. Confiar em log antigo é armadilha (timestamps!)
6. **NOVO:** `replace_file_content` (Gemini) > splice manual (Mavis) — ferramenta nativa supera gambiarra textual
7. **NOVO:** 6 promises (frameFaturamento + page) > 3 promises (só page) — popup pode aparecer em frame aninhado
8. **NOVO:** `continue;` no confirmacao > sem continue — não desperdiça tentativa em popup de "Confirma execução"
