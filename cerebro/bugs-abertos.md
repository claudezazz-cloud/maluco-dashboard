# Bugs Abertos / TODO

Lista viva de problemas conhecidos e pendentes. Marque com data quando resolver.


---

## 🔴 ABERTO — Camada 2 "Bot Memoria Dia" (`5qTcBwOdBeoU1l7i`) erra a cada 30min (desde 25/05/2026)

**Sintoma:** todas as execuções do workflow "Bot Memoria Dia" terminam em `error`. Última `bot_memoria_dia` produzida foi 25/05. Como a Camada 3 (Bot Memoria Longa) lia esses resumos, os fatos de cliente pararam de crescer (travou em ~27).

**Impacto hoje:** baixo. O `memoriaContext` foi desligado do prompt (token opt 22/06), então os resumos diários não são mais injetados. E o crescimento de fatos foi resolvido por outro caminho (extrator direto — ver [[historico-cliente]]). Mas o workflow ativo errando 48×/dia polui `execution_entity` (e talvez `bot_erros`).

**Pendente:** ou **desativar** o workflow (`n8n update:workflow --id=5qTcBwOdBeoU1l7i --active=false`) já que está superado, ou achar a causa do erro e consertar (se quiserem manter os resumos diários da aba Admin→Memória). NÃO desativado ainda — aguardando OK do Franquelin.

---

## ✅ Relatório puxava PENDÊNCIA DE ONTEM num dia sem mensagens (18/06/2026 — RESOLVIDO)

**Sintoma:** o relatório da manhã de hoje (18/06) reportou e cobrou "Celinalva Barbosa Lima (482)" — mas esse caso foi de ONTEM (17/06). Hoje o grupo não teve NENHUMA mensagem sobre Celinalva (só os comandos de rotina + um vídeo). O bot "puxou" um caso velho como se fosse de hoje.

**ROOT CAUSE:** o `Monta Prompt Relatório` montava as `messages` do Claude com `...redisHistory.slice(-10)` — os últimos 10 turnos do Redis (`conv:{chatId}`), **SEM filtro de data**. O `Busca Histórico Postgres` (a fonte principal do relatório) JÁ é limitado ao dia (`DATE(data_hora AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW()...)`), então não tinha Celinalva. MAS num dia quieto, os últimos 10 turnos do Redis ainda eram de ONTEM (a conversa da Celinalva 17/06 11:23–11:44) → o bot via esses turnos e reportava como pendência de hoje.

**FIX (deployado, vid `2d2d36c2`):** o `Monta Prompt Relatório` agora **filtra `redisHistory` pra só HOJE (BRT) por `ts`** antes do `.slice(-10)` (as entradas do Redis têm `ts` ISO; entradas sem ts são mantidas, fail-safe). Deploy via `v3_dump/deploy_relatorio_hoje.py`. Confirmado no `workflow_history`. (O `Monta Prompt` normal NÃO foi tocado — pra chat comum o histórico recente é desejável.)

**Complementos (mesma queixa):**
1. **System prompt** ganhou regra forte (`v3_dump/update_sysprompt4.py`): se alguém responde que está VERIFICANDO / INDO no local / FAZENDO / já RESOLVEU, **NÃO é pendência** — não cria tarefa, não agenda cobrança, não pede "confirmação 100%". Só vira pendência o que ninguém respondeu. (Reforça o fix dos prompts das rotinas id 3/5.)
2. **Guard de cobrança (`/api/mensagens-agendadas/processar`)**: o `refsCliente` agora extrai o cliente nos DOIS formatos — `"482 - Celinalva"` E `"Celinalva (482)"`. Antes só pegava o primeiro, então cobranças no formato "(NNN)" escapavam do anti-cobrança-de-resolvido (foi por isso que o lembrete id 355 de 13:40 hoje disparou; o id 352 de 07:50, em formato "NNN - ", foi corretamente `cancelado`). Testado nos dois formatos → `cancelado / ja_resolvido`.

**Prova de que o guard #2 já funciona em produção:** lembrete id 352 (07:50 hoje) ficou `cancelado` com erro "cobrança pulada: pendência(s) já resolvida(s) no Notion".

---

## ✅ Relatório cobrava quem já tinha respondido + mention crua (17/06/2026 — RESOLVIDO)

**Sintoma:** a cobrança matinal (lembrete agendado pela rotina "Relatório Diário Tarde") cobrava o Russo em casos que ele JÁ tinha dito que estava indo no local / "resolvido" ("foi informado que estava fazendo upgrade às 15:57 e resolvido às 16:56, mas não há confirmação clara se 100% OK"). E o "@5543920014328" aparecia como **número cru**, não como marcação.

**2 causas + fix:**
1. **Prompt das rotinas de relatório (id 3 "Manhã", id 5 "Tarde" em `dashboard_solicitacoes_programadas`) definia "pendência sem resposta" errado** — incluía os casos em que "o técnico respondeu confirmando que iria resolver OU que já resolveu". Ou seja, mandava cobrar justamente quem respondeu. **Fix:** reescrita a definição — pendência = problema que NINGUÉM pegou; ⚠️ se alguém disse que está INDO/FAZENDO/VENDO ou que JÁ RESOLVEU, NÃO é pendência (não cria tarefa nem cobrança), no máximo cita "em andamento". Script: `v3_dump/update_prompts_pendencia.py`.
2. **Mention crua:** o lembrete dispara via `/api/mensagens-agendadas/processar`, que enviava só `text` no Evolution sendText — sem o array `mentioned`. **Fix:** helper `extrairMentions()` puxa os `@<numeros>` do texto e manda `mentioned: [...]` no body; Evolution converte em `contextInfo.mentionedJid` → vira marcação real. Confirmado: `mentioned: ["5511000000000"]` → HTTP 201 + `mentionedJid` aplicado. (Mesma rota que ganhou o anti-cobrança-de-resolvido.)

---

## ✅ Cobrança dispara em chamado JÁ RESOLVIDO (17/06/2026 — RESOLVIDO no mesmo dia)

**Sintoma:** o resumo da manhã (11:40) achou a pendência "482 - Celinalva Barbosa Lima sem internet", criou tarefa no Notion (resp. Russo) e **agendou uma cobrança pras 13:40**. O Russo respondeu **"Resolvido, roteador travado..." às 11:44**, mas às 13:40 a cobrança disparou mesmo assim, achando que não foi resolvido.

**✅ FIX (17/06/2026, deployado e testado):**
1. **`Detecta Resolvido` agora anexa o contexto da mensagem CITADA (quote) ao texto.** Antes ele re-extraía só o texto cru (ignorando o quote que o `Extrai Dados Mensagem` já captura), então um "Resolvido" em resposta não dizia QUAL cliente e o `Match Tarefa Resolvida` devolvia action=nenhum. Agora o texto vira `Resolvido... [em resposta a: "482 Celinalva sem internet"]` → o Claude casa a tarefa e marca Ok. Deploy: `v3_dump/deploy_detecta_resolvido.py` (string-replace no nó + workflow_entity/history + republish; vid `937bc963`). Testado via webhook sintético: o quote flui até o Match.
2. **O processador de lembretes (`/api/mensagens-agendadas/processar`) re-checa o Notion antes de disparar uma cobrança.** Helper `cobrancaResolvida()`: se a msg é cobrança (`ehCobranca`), extrai as referências "NNN - Nome" e, se NENHUM cliente citado ainda tem tarefa `Parado`, marca a msg como `cancelado` e NÃO envia (fail-safe: na dúvida/erro, envia). Testado: cobrança da Celinalva (Ok) → `cancelado / ja_resolvido`, não enviada.

As duas juntas fecham a causa: Russo resolve (citando) → tarefa vira Ok → cobrança re-checa → pula.

**2 causas somadas (confirmadas no VPS):**

1. **`detecta-resolvido` não casa REPLY CITADO sem nome de cliente.** O Russo respondeu CITANDO o chamado da Celinalva: o bot capturou o texto certo ("Resolvido, roteador travado, formigas..."), mas o fluxo vê só a resposta — **sem "Celinalva"/"482"** — então o Claude do "Match Tarefa Resolvida" não sabe QUAL tarefa marcar → tarefa fica **Parado**. (Funciona quando a msg nomeia, ex.: "Issao foi resolvido".) **Fix:** incluir o **contexto da mensagem citada (quoted)** no detecta-resolvido pra o Claude resolver a referência. Mexe no nó de extração + detecta-resolvido (deploy via `deploy_full.py`).

2. **Cobrança é "fire-and-forget".** A `mensagens_agendadas` (id 350) é **texto pré-montado às 11:40, SEM link pra tarefa** (a tabela não tem `notion_page_id`), disparado verbatim às 13:40 — não re-checa nada. **Fix:** adicionar `notion_page_id` na `mensagens_agendadas`, `criar_lembrete` passa o page_id da tarefa cobrada, e o **processador checa o status no Notion antes de enviar** — se Ok/resolvido, pula (status `cancelado`). Mexe no schema + `/api/lembretes` + o processador no dashboard.

**Por que as duas juntas:** mesmo com #2 (checar status), a tarefa fica Parado por causa de #1, então a cobrança dispararia igual. Precisa das duas (ou a cobrança re-ler o chat recente em busca de resolução). Escopo decidido com o usuário: por ora só marcar a tarefa Ok; fix do sistema pra depois.

**Diagnóstico:** tarefa Notion "Verificar sem internet — 482 Celinalva" estava `Parado`; msg capturada em `mensagens` ("Russo Zazz | Resolvido, roteador travado..."); cobrança em `mensagens_agendadas` id 350 (criada 14:40 UTC, agendada 16:40 UTC, status enviado, sem link p/ tarefa).

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

## 🔴 Bom dia rodando 2x + sem chamados (06/05/2026)

**Sintoma:** dia 06/05/2026 às 07:00 BRT, o bot enviou DUAS mensagens de bom dia idênticas e ambas disseram "não tenho os chamados importados/carregados na dashboard agora".

**Diagnóstico:**

1. **Mensagens duplicadas (race condition):**
   - `dashboard_solicitacoes_programadas` tem só 1 entrada (ID=6 "Bom dia + Resumo dos Chamados" às 07:00)
   - Mas `bot_conversas` registrou ID 446 (remetente=Dashboard, 10:00:13 UTC) e ID 447 (remetente=Agendamento, 10:00:15 UTC) — 2 segundos de diferença
   - Causa: cron `/api/solicitacoes/processar` roda a cada minuto. Quando bate 07:00, dois ticks consecutivos pegam a mesma solicitação antes do `ultimo_executado` ser atualizado.
   - Fix proposto: UPDATE atômico no endpoint, tipo `UPDATE ... SET ultimo_executado=NOW() WHERE id=? AND (ultimo_executado IS NULL OR ultimo_executado::date < CURRENT_DATE) RETURNING id`. Só proceder se RETURNING devolver linha.

2. **Sem chamados loaded:**
   - Redis `chamados:data` foi importado às `08:05:29 BRT` (TTL 24h)
   - Bot rodou às `07:00 BRT` — ANTES da importação
   - Bot estava CORRETO em dizer que não tinha chamados — por isso a mensagem ficou "genérica"
   - Fix imediato: mover solicitação ID=6 de 07:00 → 08:30 via UI dashboard
   - Fix definitivo: alinhar horário do import (provavelmente o cron `routerbox-auto` que roda em `5 * * * *`) pra rodar antes do bom dia, ou mover bom dia pra depois

**Impacto:** mensagens duplicadas + texto genérico irritam o grupo. Bug recorrente (todo dia 07:00) até alguém arrumar.

**TODO:**
- [ ] UI: mover hora de "Bom dia + Resumo dos Chamados" de 07:00 → 08:30
- [ ] Código: UPDATE atômico em `/api/solicitacoes/processar` pra evitar race
- [ ] Verificar se outras solicitações (`PARADOS NOTION SUB` 07:30, etc) têm o mesmo race — provavelmente sim mas não disparou hoje por sorte

---

## 🟢 Resolvidos recentemente

- ✅ **Tokens 30k+ pra "oi"** (resolvido mai/2026): workflow_history não estava sendo atualizado. Fix: `deploy_workflow.py` atualiza `workflow_entity` + `workflow_history` com mesmo versionId. Ver [deploy-workflow.md](deploy-workflow.md).
- ✅ **`pops_usados` vazio no dashboard** (resolvido mai/2026): bug em `Monta_Prompt.js:262` (`const popsUsados = ''`). Fix: `popsUsados = todosOsPops.map(p => p.titulo).join(', ')`.
- ✅ **Modelo `sonnet` mesmo com SQLite tendo `haiku`** (resolvido mai/2026): mesma raiz do bug do workflow_history.
- ✅ **Bot inventando "não tenho chamados" em `/chamados`** (resolvido mai/2026): Haiku 4.5 não chamava `buscar_chamados`. Fix: `tool_choice: {type: 'tool', name: 'buscar_chamados'}` forçado quando msg tem `/chamados`, `/relatorio` ou variantes. Ver [tool-choice-forcado.md](tool-choice-forcado.md).
- ✅ **Auto-resolver tarefa em mensagem de criação** (resolvido 06/05/2026): nó `Detecta Resolvido` matchava "pronto" em "Avisar quando tiver pronto" e marcava tarefa similar como Ok no Notion. Fix: regex restrito + exclusão `CRIA_TAREFA_RE` para templates de pedido. Ver [detecta-resolvido.md](detecta-resolvido.md).
- ✅ **`fix_*.py` poluindo raiz** (resolvido 06/05/2026): 19 scripts one-shot movidos para `archive/fix_scripts_2026_q2/` via `git mv`. Histórico preservado no git.
- ✅ **Chamados internet aparecendo no grupo Sub** (resolvido 14/05/2026): bot mostrava 42 chamados de internet no grupo de design. Fix duplo: (1) `buscar_chamados` no agent_loop verifica `/api/grupos/tipos` — se grupo não tem 'Internet' nos tipos_filtro, retorna mensagem de bloqueio; (2) sysprompt com regra "NUNCA inclua chamados de internet no grupo de design/loja".
- ✅ **MAX_ITER 5 → 8** (14/05/2026): workflows com buscar_cliente + criar_tarefa_notion + aprender_fato esgotavam as 5 iterações. Aumentado para 8.
- ✅ **Detecta Resolvido: "Marcar para passar" e "já foi feito o processo"** (14/05/2026): "Já foi feito o processo para atualizar a Rede" casava no KEY_RE e marcava tarefa errada como Ok. Fix: adicionado `marcar\s+para\s+passar`, `passar\s+na\s+casa`, `já foi feito o processo` à CRIA_TAREFA_RE de exclusão.
- ✅ **TypeError "content[0].text" no Parse Resposta** (resolvido 13/05/2026): quando `CRIAR_NOTION_INTENT` forçava `criar_tarefa_notion` via `tool_choice`, o agent_loop podia retornar `content: []` (array vazio). O guard `!finalContent` não detecta array vazio (`![] === false`). Fix duplo: (1) agent_loop — guard melhorado para `!finalContent || finalContent.length === 0 || !find(text block)`; (2) Parse Resposta — busca o primeiro bloco de texto com `.find(b => b.type === 'text')` em vez de assumir `content[0]`.
- ✅ **Bot encurtando respostas de POP** (resolvido 06/05/2026): Haiku chamava `buscar_pop` mas resumia o conteúdo com "RESUMO RÁPIDO". Fix duplo: (1) sysprompt — exceção anti-resumo na seção TOM + regras "TRANSCREVA TODOS os passos" na seção POPs; (2) `agent_loop_code.js` — prefixo "INSTRUCAO OBRIGATORIA" injetado no tool_result de `buscar_pop`. Tokens output: 428 → 1.547; chars resposta: 899 → 3.588; todas as etapas e checklists presentes.
- ✅ **Bot listando "RESOLVIDOS HOJE" com casos de sábado** (resolvido 18/05/2026): histórico do grupo no prompt estava formatado como `[HH:MM]` (só hora). Claude via `[10:58]` + `DATA ATUAL: 18/05/2026` e inferia "hoje" mesmo quando a mensagem era de dias anteriores. Fix triplo: (1) `Monta_Prompt.js` bloco do grupo agora formata como `[DD/MM HH:MM]` usando `mensagens.data_hora`; (2) `Parse_Resposta.js` salva `ts` ISO em cada turno do Redis (`conv:{chatId}`); (3) `Monta_Prompt.js` Redis history prefixa `content` com `[DD/MM HH:MM]` usando o `ts` antes de virar `messages`. `deploy_workflow.py` estendido pra cobrir `Parse Resposta` além dos dois Monta Prompt.
- ✅ **Bot listando chamados de ontem como "AGENDADOS PARA AMANHÃ"** (resolvido 19/05/2026): tool `buscar_chamados` retornava `Agendado: 18/05/2026 11:15:00` como string solta no ai_context; bot tentava agrupar por data sozinho e alucinava (chamados de 18/05 viraram "AMANHÃ 20/05"). Fix triplo: (1) `_processor.js` ganhou `classificarAgendamento(dataStr, hoje)` que retorna bucket `ATRASADO|HOJE|AMANHA|PROXIMO|INDEF` — cada chamado vira `Agendado: ATRASADO era 18/05 11:15 (1 dia atrás)`; seção rodapé `AGENDAMENTOS — classificação OFICIAL` pré-agrupa todos os chamados; (2) `Monta_Prompt.js` substitui `{{PROXIMOS_DIAS}}` (placeholder estava vazado no prompt) por tabela de 8 dias `HOJE = 19/05/2026 (terça-feira)` etc; (3) sysprompt_v3 ganhou regra "NUNCA recategorize por horário isolado — use a classificação OFICIAL". Princípio "Truque da métrica" (ver [[Chamados]]).

---

**Ver também:** [[Workflow N8N]] · [[Chamados]] · [[Solicitacoes Programadas]] · [[Notion]] · [[deploy-workflow]] · [[tool-choice-forcado]] · [[detecta-resolvido]]
