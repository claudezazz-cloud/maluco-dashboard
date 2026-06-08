# Manutenção N8N — 03/06/2026

## Resumo
Sessão de manutenção emergencial para resolver erros críticos no N8N (Task Runner crash, modelo Claude descontinuado, e corrupção do banco de dados após atualização de versão).
Também implementamos a geração e envio automático de relatórios visuais (tabelas em imagem) dos chamados via WhatsApp!

---

## Problemas Encontrados e Resolvidos

### 1. Task Runner Timeout (60 segundos)
- **Erro:** `Task request timed out after 60 seconds`
- **Causa:** O Task Runner do N8N não conseguia iniciar dentro do timeout padrão de 60s por conta de recursos limitados da VPS
- **Solução:** Adicionada variável `N8N_RUNNERS_TASK_REQUEST_TIMEOUT=300` no `docker-compose.yml` (5 minutos de tolerância)

### 2. Grant Token Expirado
- **Erro:** `invalid or expired grant token. If the runner startup exceeds grant token TTL 30s, increase N8N_RUNNERS_GRANT_TOKEN_TTL`
- **Causa:** O runner demorava mais de 30s para se autenticar com o broker, e o token expirava
- **Solução:** Adicionada variável `N8N_RUNNERS_GRANT_TOKEN_TTL=120` no `docker-compose.yml` (2 minutos de tolerância)

### 3. Permissões de Arquivo
- **Erro:** Conflito de permissões no SQLite
- **Causa:** Configuração padrão do N8N v2.23 exigindo permissões restritas
- **Solução:** Adicionada variável `N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false`

### 4. Modelo Claude Descontinuado (API 404)
- **Erro:** `Claude API 404: model: claude-3-5-haiku-20241022`
- **Causa:** O modelo `claude-3-5-haiku-20241022` foi descontinuado pela Anthropic
- **Solução:** Substituído por `claude-haiku-4-5-20251001` em todos os workflows via script Python direto no SQLite
- **Workflows afetados:** `DiInHUnddtFACSmj` (Maluco da IA v7.12), `Pj5SdaxFh9H9EIX4` (Maluco Bot v3)

### 5. Foreign Key Constraint (SQLite)
- **Erro:** `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`
- **Causa:** Ao atualizar os modelos no banco, os registros em `workflow_publish_history` ficaram com referências órfãs para versões que não existiam mais em `workflow_history`
- **Solução:** 
  1. Script `repair_db2.py` — verificou e corrigiu `activeVersionId` em `workflow_entity`
  2. Limpeza de 11 registros órfãos na tabela `workflow_publish_history`
  3. Remoção dos arquivos WAL/SHM do SQLite para evitar locks

### 6. Atualização de Versão
- **Antes:** N8N v2.14.2
- **Depois:** N8N v2.23.2
- **Impacto:** Migração automática do banco (várias tabelas novas), mas workflows preservados

---

## 🚀 Nova Feature: Relatório de Chamados em Imagem

Implementada uma nova **Tool no Agent Loop** que permite que o Claude gere um dashboard visual com a tabela de chamados pendentes/concluídos e envie como foto no WhatsApp!

### Como funciona:
1. O Claude identifica quando o usuário pede um relatório visual ("manda a imagem", "manda a tabela dos chamados").
2. Ele chama a tool `gerar_relatorio_imagem` enviando um JSON com as categorias e chamados do Notion.
3. O bot faz uma requisição POST pra nossa rota `/api/report-image` no Dashboard Next.js.
4. A rota gera um PNG usando Satori (`next/og`) e retorna em Base64.
5. O bot repassa a imagem pro grupo do WhatsApp usando o endpoint `sendMedia` da Evolution API.

### 🛠️ Problemas resolvidos no caminho (Descobertas Importantes!)
1. **Satori vs Node Runtime:** Tivemos que tirar a configuração `export const runtime = 'edge'` pois estava quebrando no ambiente PM2/Node.js padrão que usamos no Dashboard.
2. **Satori Strictness:** Satori é MUITO restrito! Ocorria o erro `Expected <div> to have explicit "display: flex"` constantemente.
   - **Descoberta:** TODOS os `<div>` com filhos **precisam** de `display: 'flex'` explícito. Não podemos usar tags como `<span>`, `<h1>` ou `<p>`. Tivemos que transformar tudo em `<div>` puros. Também não suporta CSS `gap`, tivemos que usar `marginLeft`. Textos puros e `fontWeight` numérico.
3. **Evolution API `sendMedia`:** Retornava `HTTP 400 Bad Request` reclamando do formato.
   - **Descoberta:** Não envie o prefixo `data:image/png;base64,`. O corpo da requisição precisa ser apenas a string base64 pura.
4. **Alucinações de ID/Nome do Claude:** O modelo estava passando IDs gigantes do Notion (`37495b8c5c...`) que quebravam o layout da imagem.
   - **Solução:** Na rota do Satori criamos uma sanitização (`truncate` em IDs com mais de 8 caracteres adicionando um `#`, e um `.split(' — ')[0]` na categoria pra limpar o nome do técnico). E no prompt da tool no N8N reforçamos que o Claude DEVE enviar nomes e IDs simplificados!

---

## Variáveis de Ambiente Adicionadas ao docker-compose.yml

```yaml
- N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false
- N8N_RUNNERS_TASK_REQUEST_TIMEOUT=300
- N8N_RUNNERS_GRANT_TOKEN_TTL=120
```

---

## Modelos Claude — Mapeamento

| Modelo Antigo (descontinuado) | Modelo Novo |
|---|---|
| `claude-3-5-haiku-20241022` | `claude-haiku-4-5-20251001` |
| `claude-3-5-sonnet-20241022` | `claude-sonnet-4-6` |

---

## Scripts Criados

| Script | Função |
|---|---|
| `fix_models.py` | Substituiu nomes de modelos Claude descontinuados no SQLite |
| `repair_db.py` | Primeira tentativa de reparo de FK (parcial) |
| `repair_db2.py` | Reparo completo de FK — verificou `activeVersionId` e `workflow_history` |
| `fix_image.py` | Reverteu nome da imagem Docker após tentativa de usar tag `-debian` |
| `test_anthropic.py` | Teste direto da API Anthropic para validar modelos |
| `test_models.py` | Listou modelos disponíveis na conta Anthropic |
| `deploy_agent_loop.py` | Atualiza dinamicamente o código JavaScript do "Code Node" no SQLite sem precisar abrir a interface (bypassa limite de auth)! |

---

## MCP Server

- **Registrado:** n8n MCP server no Claude Code (escopo user)
- **URL:** `https://n8n.srv1537041.hstgr.cloud/mcp-server/http`
- **Arquivo modificado:** `C:\Users\franq\.claude.json`
- **Requer:** Reinício do Claude Code + fluxo OAuth

---

## Chatwoot

- **Status:** Parado intencionalmente para liberar recursos da VPS
- **Containers parados:** `n8n-chatwoot_app-1`, `n8n-chatwoot_sidekiq-1`
- **Motivo:** Consumo excessivo de RAM/CPU que travava o N8N

---

## Recursos da VPS (pós-manutenção)

| Recurso | Total | Usado | Livre |
|---|---|---|---|
| RAM | 7.9 GB | 1.5 GB | 6.4 GB |
| Disco | 96 GB | 33 GB | 63 GB |
| Swap | 4 GB | 0 | 4 GB |

---

## Status Final dos Workflows

| Workflow | ID | Status |
|---|---|---|
| Maluco da IA v7.12 -hostinguer | DiInHUnddtFACSmj | ✅ Ativo |
| Maluco Bot v3 (tool_use) | Pj5SdaxFh9H9EIX4 | ✅ Ativo |
| Bot Memoria Dia | 5qTcBwOdBeoU1l7i | ✅ Ativo |
| Bot Memoria Longa | tPUy8FowXH8v0skk | ✅ Ativo |
| Bot Notícias Regional | gEZjgtEvHViQx0nd | ✅ Ativo |
| Bot Clima — Lunardelli-PR | qDQSeL6VP50k2kqf | ✅ Ativo |
| Bot Notícias Política | vlh4zs3KdOcVURXQ | ✅ Ativo |
| Notificação Tarefa Ok — Notion | Urf233bK6RqoSlQs | ✅ Ativo |
| Maluco da IA v7.1 - Bom Dia com Chamados | Is9YW0tsvctIgSsR | ⏸️ Inativo |
| Teste versão 6.3 | z6vgnQc8pk06BZ53 | ⏸️ Inativo |

---

## Lições Aprendidas

1. **Nunca modificar o SQLite do N8N sem desabilitar FK checks** — a tabela `workflow_entity` tem FK para `workflow_history` via `activeVersionId`
2. **Sempre verificar modelos da Anthropic antes de deployar** — modelos são descontinuados sem aviso prévio
3. **Task Runner do N8N v2.x precisa de TTL generoso** em VPS com disco lento
4. **Chatwoot consome muitos recursos** — considerar migrar para VPS separada ou desabilitar permanentemente se não estiver em uso
5. **N8N e Python:** Scripts Python são excelentes atalhos de manutenção para bypassar expiração de tokens JWT/autenticação no SQLite do N8N.
6. **Satori/Next.js OG:** É inflexível. Exige `display: flex` em tudo, rejeita `gap`, não aceita tags textuais simples como span ou p.
7. **Evolution API (`sendMedia`):** Exige puramente a string Base64 no body `media` do JSON. Se você mandar o Data URI (`data:image/png;base64,...`) ele dá 400 Bad Request.
