# Detector de promessas → lembrete automático (02/07/2026)

O bot agora detecta **promessas da equipe** ditas no grupo ("amanhã eu passo lá", "vou combinar um horário pra amanhã", "segunda instalo") **sem precisar ser mencionado**, e agenda um lembrete no MESMO grupo pro dia prometido. Fecha o gap: o agent loop só roda quando mencionam o bot, então promessas em conversa normal se perdiam.

## Como funciona
`POST /api/lembretes/detectar-promessas` (`app/api/lembretes/detectar-promessas/route.js`, token interno), **cron a cada 30min** (`/var/log/detectar-promessas.log`):
1. **Cursor** em `dashboard_config` (`promessas_cursor_msg_id`) — cada run lê só mensagens NOVAS de `mensagens` (grupos `@g.us`, sem bot/rotinas/`🔔`, janela máx 26h, LIMIT 300).
2. **Gate regex** (GATILHO: amanhã/semana que vem/vou ver/segunda/...) — sem candidato, não chama LLM (custo zero).
3. **Claude Haiku POR GRUPO** (nunca mistura grupos num transcript) extrai `[{msg_id, autor, promessa, quando, hora}]` com calendário de 8 dias no prompt. Regra: datas relativas contam da **DATA DA MENSAGEM**, não de hoje (pegou "amanhã" dito ontem à noite errado — corrigido).
4. **Validação ESTRITA** do output (anti-alucinação/injection): `msg_id` tem que existir NO LOTE DO GRUPO; `quando` regex + janela [hoje, +30d]; `hora` regex; texto sanitizado (remove `@ * _ \n`, cap 180).
5. Agenda em `mensagens_agendadas`: dia prometido às `hora||08:30` BRT; se já passou → +2h; **clamp horário comercial** (07:30–18:30, senão vai pra 08:30 do dia seguinte); **domingo → segunda**. `dedup_key='promessa:<msg_id>'` (UNIQUE — nunca duplica). `criado_por='detector-promessas'`. Cap **5/run** — e ao estourar o cursor **retrocede** pro min(msg_id) restante (não perde promessa).
6. **@mention real**: casa pushName → colaborador (score: 1º token vale 2 — "Russo Zazz" ganha de "Plantão Zazz"; empate = sem mention, nunca inventa número).
7. `?dry=1` (não grava/avança) e `?dry=1&horas=N` (backfill de teste; `horas` sem dry é bloqueado).

## No processador (`mensagens-agendadas/processar`)
`criado_por='detector-promessas'` tem tratamento especial: se o texto da promessa casar o regex de **cobrança** (ex.: "resolver a pendência do X") em dia fora do expediente, o lembrete é **REAGENDADO +24h** (não cancelado); e ele **nunca** passa pelo check de "cobrança já resolvida" (não é cobrança).

## Revisão adversarial (ultracode) — achados aplicados
Workflow com 3 lentes (correção/segurança/spam) + céticos por achado. Confirmados e corrigidos: transcript cross-grupo (→ LLM por grupo), pushName sem sanitizar no fallback (→ sanit), cap perdia promessas (→ cursor de retomada), lembrete cancelável pelo filtro de cobrança (→ reagenda), acharNumero ambíguo (→ score por 1º token), fetch sem timeout (→ 60s), disparo de madrugada (→ clamp comercial).

⚠️ **Achado confirmado NÃO corrigido (pendente, ver [[bugs-abertos]]):** o token interno das rotas (`MALUCO_POPS_2026`) é fallback hardcoded no código versionado e a env `MALUCO_INTERNAL_TOKEN` NÃO está setada no VPS — rotação exige mudança coordenada (todas as rotas + crons + nós n8n).

## Teste real (02/07)
Dry-run 96h: detectou **exatamente 1** promessa (Russo 01/07 17:19 "vou combinar um horário pra amanhã" → "Combinar horário para ir à casa de Andreia") e **ignorou futebol/casual**. Run real criou o lembrete id 379 → dispara 02/07 08:30 no Nego's Internet com @mention do Russo. Cursor: 2939.

Ver: [[lembretes-standby]] · [[agent-loop-tool-use]] · [[feriados-calendario]]
