# Treinamento Evolutivo — Sistema de Indexação de Notas

O sistema de treinamento evolutivo indexa as notas Obsidian do `cerebro-evolutivo/` em chunks vetorizáveis e os armazena no Postgres. O bot usa esses chunks como contexto adicional ao responder.

**Status:** 36 documentos indexados, 68 chunks em produção (03/05/2026).

---

## Arquitetura

```
cerebro-evolutivo/*.md  →  sync-evolutivo.sh (cron * * * * *)
                        →  git pull no VPS
                        →  /api/treinamento-evolutivo/sync (POST, token)
                        →  lib/evolutivo/indexer.js
                        →  evolutive_documents + evolutive_chunks (Postgres)
                        →  N8N busca chunks relevantes por similaridade de texto
```

---

## Tabelas no banco

```sql
evolutive_sources (
  id, nome, caminho_local TEXT, ativo BOOLEAN
)

evolutive_documents (
  id, source_id FK,
  caminho TEXT,       -- nome do arquivo .md
  titulo VARCHAR(500),
  hash VARCHAR(64),   -- SHA do conteúdo — detecta mudanças
  mtime TIMESTAMP,
  bytes INT,
  erro TEXT,          -- preenchido se falhou ao indexar
  ativo BOOLEAN,
  atualizado_em TIMESTAMP,
  UNIQUE (source_id, caminho)
)

evolutive_chunks (
  id, document_id FK,
  conteudo TEXT,
  posicao INT,        -- ordem no documento
  tokens_est INT,     -- estimativa de tokens
  atualizado_em TIMESTAMP
)
```

---

## Sync automático

Cron no VPS: `* * * * * /opt/zazz/dashboard/sync-evolutivo.sh`

O script faz `git pull` na pasta do projeto e chama `POST /api/treinamento-evolutivo/sync` com token `EVOLUTIVO_SYNC_2026`. O indexer:
1. Lê todos os `.md` da pasta fonte
2. Compara hash com o banco — só reindexar arquivos mudados
3. Quebra em chunks de ~500 tokens
4. Upsert em `evolutive_documents` e `evolutive_chunks`

**Token de autenticação:** `EVOLUTIVO_SYNC_TOKEN=EVOLUTIVO_SYNC_2026` (env VPS).

---

## APIs

| Rota | Auth | Função |
|---|---|---|
| `POST /api/treinamento-evolutivo/sync` | x-token ou admin | dispara reindexação |
| `GET /api/treinamento-evolutivo/status` | admin | status da fonte, contagem de docs/chunks |
| `GET /api/treinamento-evolutivo/documentos` | admin | lista documentos indexados |
| `GET /api/treinamento-evolutivo/config` | admin | configuração da fonte |
| `POST /api/treinamento-evolutivo/config` | admin | salva caminho da fonte |
| `POST /api/treinamento-evolutivo/validar-path` | admin | verifica se o caminho existe no servidor |

---

## UI — `/treinamento` aba "Evolutivo"

Visível apenas para admins. Mostra:
- Caminho da pasta fonte configurada
- Status da última sincronização
- Lista de documentos com tamanho e status de indexação
- Botão "Sincronizar Agora"

---

## Documentos indexados (36 em produção)

Inclui toda a pasta `cerebro-evolutivo/` + notas do Obsidian interno (`cerebro/`). Destaques:
- `agent-loop-tool-use.md`, `dashboard-admin.md`, `memoria-evolutiva.md`
- `multigrupo-tipos-implementado.md`, `notion-sync-snapshot.md`
- `skills-sistema.md`, `auditoria-bugs-corrigidos.md`, `ideias-melhorias.md`
- Notas do cerebro: `Chamados.md`, `Workflow N8N.md`, `Relatorios.md`, etc.

Arquivos vazios (`Teste.md`, `Untitled.md`, `wikilinks.md`) são indexados mas têm 0 bytes — sem impacto.

---

## Pegadinhas

- O cron de sync roda **a cada minuto** — qualquer commit nos .md do cerebro-evolutivo aparece no bot em ~1 min.
- Se `erro` estiver preenchido em `evolutive_documents`, aquele arquivo não está sendo servido ao bot — verificar pelo painel.
- Hash detecta mudança por conteúdo, não por data — renomear arquivo sem mudar conteúdo **não** força reindexação.
- **Regra de ouro:** ao alterar qualquer feature significativa, atualizar o `.md` correspondente em `cerebro-evolutivo/` e fazer commit. O bot aprende automaticamente.
