# Notion Sync Snapshot — Detecção de Edições

Implementado em 2026-05-03. Detecta quando alguém edita uma tarefa diretamente no Notion e notifica o WhatsApp automaticamente.

## Problema resolvido

O bot criava e resolvia tarefas, mas não sabia quando alguém mudava campos diretamente no Notion (ex: trocou o responsável, adiou a data de entrega). A equipe ficava desatualizada.

## Como funciona

1. **Cron a cada 5 min** no VPS chama `POST /api/notion/sync-snapshot`
2. O endpoint busca todas as tarefas ativas do Notion (status ≠ Ok, até 200 tarefas)
3. Compara campo a campo com o snapshot salvo em `notion_tarefas_snapshot`
4. Se detectar mudança → envia notificação WhatsApp para grupos com `alertas_notion_entrega=true`
5. Atualiza o snapshot

## Campos monitorados

| Campo | O que detecta |
|---|---|
| `responsavel` | Técnico/responsável foi trocado |
| `entrega` | Data de entrega foi alterada |
| `status` | Status mudou (ex: Parado → Em andamento) |

**Não detecta:** criação de nova tarefa (já tratada pelo workflow `Urf233bK6RqoSlQs`), tarefas marcadas como Ok (idem).

## Formato da notificação

```
✏️ Tarefa editada no Notion:
*Verificar sem internet - João Silva*
Responsável: *Junior* → *Russo*
Entrega: *05/05/2026* → *08/05/2026*
```

Enviada via Evolution API: `POST https://lanlunar-evolution.cloudfy.live/message/sendText/ZazzClaude`

## Tabela `notion_tarefas_snapshot`

```sql
CREATE TABLE notion_tarefas_snapshot (
  page_id    VARCHAR(255) PRIMARY KEY,
  titulo     TEXT,
  status     VARCHAR(100),
  responsavel TEXT,
  entrega    DATE,
  tipo       TEXT,
  snapshot_em TIMESTAMP DEFAULT NOW()
)
```

Criada automaticamente (`ensureTable()`) na primeira chamada ao endpoint.

## Endpoint

`POST /api/notion/sync-snapshot`  
Auth: `x-token: MALUCO_POPS_2026`  
Retorna: `{ ok, verificadas, alteracoes[] }`

Código em: `dashboard/app/api/notion/sync-snapshot/route.js`

## Cron VPS

```bash
*/5 * * * * curl -s -X POST https://dashboard.srv1537041.hstgr.cloud/api/notion/sync-snapshot \
  -H "x-token: MALUCO_POPS_2026" >> /var/log/notion-snapshot.log 2>&1
```

## Primeira execução

Na primeira chamada, todas as 60 tarefas ativas são salvas como baseline — sem notificações. A partir da segunda chamada em diante, qualquer edição dispara o alerta.

## Limitações conhecidas

- Não detecta mudanças em campos não monitorados (obs, cliente, valor)
- Tarefas arquivadas no Notion somem do snapshot mas não geram notificação de "arquivada"
- Se o N8N já notificou a criação de uma tarefa e o snapshot ainda não a tinha, a próxima rodada do sync-snapshot vai ignorá-la corretamente (INSERT ... ON CONFLICT DO NOTHING)
