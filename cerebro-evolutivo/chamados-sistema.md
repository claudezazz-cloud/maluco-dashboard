# Chamados — Sistema de Importação e Acompanhamento

Chamados são os tickets de suporte da Zazz Internet importados via planilha CSV/Excel. O bot usa os chamados em aberto como contexto ao fazer relatórios e responder perguntas sobre clientes.

---

## Fluxo

```
Admin importa planilha  →  POST /api/chamados  →  _processor.js processa
                        →  Redis chamados:data (TTL 24h)
                        →  Bot lê via GET /api/chamados (status resumo)
                        →  N8N injeta dados no contexto do bot
```

---

## Importação manual

Via página `/chamados` no dashboard. Admin faz upload da planilha, o frontend envia as linhas para `POST /api/chamados` com `{ chamados: [[...]], headers: [...] }`.

O `_processor.js` normaliza os campos (mapeia colunas para schema interno), salva em Redis com TTL de 24h, e retorna resumo.

---

## Importação automática

`GET /api/chamados/auto-import` — busca planilha de fonte configurada automaticamente (sem upload manual). Chamado via cron ou N8N.

---

## Redis — estrutura

Chave: `chamados:data`
TTL: 86400s (24h)

```json
{
  "total": 42,
  "resumo": "42 chamados em aberto...",
  "importado_em": "2026-05-03T14:00:00.000Z",
  "chamados": [...]
}
```

---

## Resolvidos hoje

`GET /api/chamados/resolvidos-hoje` — lista chamados com status resolvido no dia atual. Usado pelo bot no `/relatorio` para mostrar o que foi fechado.

---

## Snapshot histórico

Tabela `chamados_snapshots` — armazena snaps diários dos chamados para histórico.  
Cron de purge: `0 4 * * *` — deleta registros com mais de 30 dias.

---

## APIs

| Rota | Auth | Função |
|---|---|---|
| `POST /api/chamados` | session | importa planilha (linhas+headers) |
| `GET /api/chamados` | session | status atual (Redis: total, TTL, importado_em) |
| `DELETE /api/chamados` | session | limpa cache Redis |
| `GET /api/chamados/auto-import` | token | importação automática |
| `GET /api/chamados/resolvidos-hoje` | session | chamados resolvidos hoje |

---

## UI — `/chamados`

Página de upload de planilha. Mostra status do Redis (ativo/expirado, total, quando expira). Botão para limpar cache.

---

## Pegadinhas

- Cache Redis expira em 24h — se não reimportar, o bot fica sem dados de chamados.
- O bot usa `chamados:data` para responder perguntas sobre clientes com chamado aberto — se vazio, responde que não tem dados.
- A skill `/chamados` lista os chamados em aberto formatados para WhatsApp.
