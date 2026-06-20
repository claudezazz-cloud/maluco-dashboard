# Repo Git, Segredos e Estrutura (faxina 17-19/06/2026)

Conhecimento pra **NÃO re-descobrir** o estado do git numa nova sessão.

## Repo
- GitHub: `claudezazz-cloud/maluco-dashboard` (privado). Branch de trabalho/deploy: **`main`**.
- O working dir local ("N8N ClaudeBot Versao 5") é um clone do maluco-dashboard. O VPS `/opt/zazz/dashboard` é outro clone.
- **`cerebro/` é TOP-LEVEL** (raiz do repo) — é o canônico que o bot indexa. O `dashboard/` é um **submódulo gitlink** (`ad97001`) com história divergente/desatualizada → **NÃO editar `dashboard/cerebro/` nem dar push no submódulo** (reintroduz história velha). Editar sempre `cerebro/` top-level.

## ⚠️ Segredos na história — faxina feita (NÃO refazer à toa)
A história ANTIGA tinha **API keys hardcoded em ~20 arquivos trackeados** (dumps `wf_v3.json`/`full_wf.json`, `agent_loop_*.js`, scripts `test_*`/`send_*`/`add_*`, e 2 rotas reais). Em 19/06 foi feita a limpeza com **`git filter-repo --replace-text`** redigindo TUDO na história inteira:
- **2 keys Anthropic** (`sk-ant-api03-…`), **2 tokens Notion** (`ntn_…`), **Groq** (`gsk_…`), **OpenAI** (`sk-proj-…`), **Evolution** (`apikey` que começa com `KGWU…`), senhas **Redis** (`ZazzRedis…`) e **Postgres** (`ZazzPostgres…`). (Os valores reais vivem só no `.env` do VPS — não repetidos aqui de propósito.)
- As **2 rotas reais** (`app/api/notion/sync-snapshot/route.js` e `app/api/mensagens-agendadas/processar/route.js`) foram **env-izadas** → `const EVOLUTION_KEY = process.env.EVO_KEY || ''` (o `.env` do VPS já tem `EVO_KEY`).
- `v3_dump/` é **gitignored** (continha `agent_loop_code.js` com keys — agora untracked).
- Backup da história ORIGINAL (com segredos) está em `/c/tmp/maluco-FULL-backup-*.bundle` (local).
- **Keys nunca foram expostas publicamente** (todo push falhava antes da limpeza). Rotação é precaução, não urgência.

## GitHub Secret-Scanning push protection está LIGADO
Bloqueia push com padrões de provedor: `sk-ant-`, `ntn_`, `gsk_`, `sk-proj-`, `ghp_`, `AKIA`, etc. (genéricos tipo senha Postgres NÃO bloqueiam, mas redija por higiene). Se o push for rejeitado por "repository rule violations", o erro diz qual segredo/commit — redija com filter-repo `--replace-text` e force-push de novo.

## Como COMMITAR/PUSHAR (método que funciona)
1. **Stage ESPECÍFICO** (NUNCA `git add -A`): o repo tem muito lixo untracked (screenshots, `fix_*.py`, dumps, `_vps_*.js`). Adicione só os arquivos da task: `git add app/... lib/... cerebro/...`.
2. **Scan do staged** antes de commitar: `git diff --cached | grep -E "sk-ant-|gsk_|sk-proj-|ntn_|KGWU|ZazzRedis|ZazzPostgres"` → tem que vir vazio.
3. Commit + `git push origin main` (fast-forward normal, sem `--force` — a main já está limpa).
4. Cerebro: editar `cerebro/*.md` (top-level), `git add cerebro/<arquivos>`, commit, push.

## ⚠️ Deploy NÃO é por git pull (o pull do VPS trava)
O `/opt/zazz/dashboard` tem **mudanças scp'd não-commitadas** (rotas, `next.config.js`, etc.) que **travam o `git pull`** do `sync-evolutivo.sh`. Então:
- **Deploy de código = scp + build + restart** (ver [[deploy-rotas-nos]]), NÃO `git pull`.
- **Cerebro pro bot:** depois de commitar/pushar, o pull do VPS pode não pegar. Garanta com **scp dos `.md` pro `/opt/zazz/dashboard/cerebro/` + reindex** (`POST localhost:3001/api/treinamento-evolutivo/sync -H 'x-token: EVOLUTIVO_SYNC_2026'`). O reindex retorna `{atualizados: N}` = quantas notas mudaram.
- Faxina pendente (não feita por risco): alinhar o clone do VPS com `origin/main` preservando `.env` e configs locais.

Ver também: [[deploy-rotas-nos]] · [[Infraestrutura]] · [[Deploy]]
