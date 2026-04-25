# Resolvidos Hoje

← volta para [[Chamados]] | ver também [[Dashboard]] e [[Workflow N8N]]

Pipeline que responde "quem resolveu chamados hoje" sem ninguém precisar contar manualmente. Calculado por **diff de snapshots** — chamado some do Routerbox quando é resolvido, então a diferença entre o que apareceu hoje e o que ainda está aberto = ranking do dia.

## Cadeia de hora em hora

```
[Cron VPS :05]
   ↓
routerbox-auto/scrape.js (Playwright)
   ↓ XLSX baixado
POST /api/chamados/auto-import   (header x-auto-token)
   ↓
_processor.js
   ├── Redis SET chamados:data EX 86400      ← bot lê daqui
   └── INSERT chamados_snapshots             ← histórico bruto pro diff
```

A cada hora o snapshot da tabela `chamados_snapshots` ganha ~37 linhas (1 por chamado aberto naquele instante).

## A query do diff

Endpoint **`GET /api/chamados/resolvidos-hoje`** ([dashboard/app/api/chamados/resolvidos-hoje/route.js](dashboard/app/api/chamados/resolvidos-hoje/route.js)):

1. `estado_final` — pra cada chamado que apareceu hoje (>= 00:00 BRT), pega o registro mais recente (com `usuario_des`)
2. `ainda_abertos` — chamados presentes no snapshot mais novo
3. **Resolvidos = `estado_final` MINUS `ainda_abertos`**
4. Agrupa por `usuario_des` → ranking

Retorno:
```json
{
  "total_resolvidos": 7,
  "ranking": [
    { "usuario": "joao", "total": 4, "chamados": [...] },
    { "usuario": "maria", "total": 3, "chamados": [...] }
  ],
  "ai_text": "Resolvidos hoje (7 no total):\njoao: 4 chamados\nmaria: 3 chamados",
  "detalhes": [...]   // só se ?detalhes=1
}
```

**Auth dupla**: header `x-auto-token` (pro N8N) OU sessão de dashboard (pro front).

## Dois consumidores

### 1. Dashboard (humanos)
[/chamados](dashboard/app/chamados/page.jsx) tem aba **"Resolvidos hoje"** que mostra:
- Card com total
- Ranking colorido (1º amarelo, 2º cinza, 3º laranja)
- `<details>` por técnico expandindo lista de chamados resolvidos (numero, cliente, bairro, tipo)
- Preview do `ai_text` que o bot consome

### 2. Bot (Claude)
Workflow N8N (`DiInHUnddtFACSmj`) tem nó **"Busca Resolvidos Hoje"** entre `Busca Chamados Redis` e `Busca Clientes`. O `Monta Prompt` injeta `resolvidosContext` junto com `chamadosContext`:

```
🏁 CHAMADOS RESOLVIDOS HOJE (calculado por diff de snapshots — DADOS OFICIAIS):
Quando perguntarem "quem resolveu chamados hoje"... USE este bloco.
Os números são EXATOS, pré-calculados. Nunca reconte ou invente.

Resolvidos hoje (7 no total):
joao: 4 chamados
maria: 3 chamados
```

Por que pré-calcular: mesmo padrão do `chamadosContext` ([[Chamados#Truque da métrica]]) — Postgres conta determinístico, Claude só lê.

## Manutenção

**Purge automático**: cron diário às **04:00 BRT** roda `DELETE FROM chamados_snapshots WHERE snapshot_ts < NOW() - INTERVAL '30 days'`. Sem isso a tabela cresceria ~27k linhas/mês.

**Volume típico**: 37 linhas/hora × 24h = ~900 linhas/dia × 30 dias = ~27k linhas mantidas.

**Quando der bug** (ranking zerado ou errado):
1. `SELECT COUNT(*), MAX(snapshot_ts) FROM chamados_snapshots` — confere se o cron tá inserindo
2. `SELECT DISTINCT usuario_des FROM chamados_snapshots WHERE snapshot_ts > NOW() - INTERVAL '1 day'` — confere se o nome do técnico chegou (sem isso vira "(sem responsável)")
3. Logs do cron: `tail -f /var/log/routerbox-auto.log`

## Limitação conhecida

Se o Routerbox cair de manhã (ou cron falhar), o "primeiro snapshot do dia" pode ser tardio. Chamados resolvidos antes do primeiro snapshot **não entram no ranking** — não tem como diferenciar de "nunca abriu". Mitigação: Routerbox tem 99%+ uptime e cron roda a cada hora, janela de perda é pequena.

## Deploy histórico

- `8c66598` — tabela snapshots + endpoint
- `ff90eee` — aba do dashboard
- `f3f5e24` — workflow N8N consumindo o endpoint (commit anterior travou no secret scanning, foi reescrito)
- Script de deploy do workflow: [add_resolvidos_hoje_node.py](add_resolvidos_hoje_node.py)
