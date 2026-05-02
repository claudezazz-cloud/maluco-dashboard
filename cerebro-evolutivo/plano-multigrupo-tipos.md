# Plano: Multi-Grupo WhatsApp + Filtro por Tipo de Tarefa

> ✅ **CONCLUÍDO em 2026-05-02.** Documentação do estado atual em
> [multigrupo-tipos-implementado.md](multigrupo-tipos-implementado.md).
> Este arquivo fica como histórico do plano original.

**Data:** 2026-05-01
**Contexto:** Bot v3 (tool_use) já em produção no único grupo "Nego's Internet". Vai expandir
para outros grupos internos (Designer, Migração, Diário) com regras independentes.

## Problema

Hoje:
- Bot é mencionado em qualquer grupo, mas só **1 grupo** recebe Bom Dia e alertas Notion (OK/Entrega).
- Toda tarefa criada via tool é tipo "Internet" (default).
- Alertas Notion não filtram por tipo: se um designer marca um carimbo como Ok, o alerta vai pro grupo da Internet (irrelevante pra equipe técnica).
- O modelo pode inventar tipos novos (já criou um tipo "teste" no Notion via tool_use).

## Objetivo

1. **Bot escolhe tipo semanticamente** entre os tipos *já existentes* na DB do Notion. Nunca cria novo.
2. **Cada grupo configura seus filtros**:
   - Recebe Bom Dia? Sim/Não
   - Recebe alerta Entrega? Sim/Não — para quais tipos?
   - Recebe alerta Ok? Sim/Não — para quais tipos?
3. **Multi-grupo**: 1 instância Evolution + 1 workflow + N grupos diferentes.

## Arquitetura

### Schema (Postgres)

Tabelas novas (criadas via `ensureTable()` no padrão do projeto):

```sql
CREATE TABLE IF NOT EXISTS grupos_whatsapp (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  chat_id VARCHAR(255) UNIQUE NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  bom_dia BOOLEAN DEFAULT false,
  alertas_notion_entrega BOOLEAN DEFAULT false,
  alertas_notion_ok BOOLEAN DEFAULT false,
  tipos_filtro_entrega TEXT[],   -- vazio/null = todos os tipos
  tipos_filtro_ok      TEXT[],   -- vazio/null = todos os tipos
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensagens_agendadas (
  id SERIAL PRIMARY KEY,
  grupo_id INT REFERENCES grupos_whatsapp(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL,
  agendar_para TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente',
  criado_por VARCHAR(255),
  criado_em TIMESTAMP DEFAULT NOW(),
  enviado_em TIMESTAMP,
  erro TEXT
);
CREATE INDEX ON mensagens_agendadas(status, agendar_para);
```

Seed inicial dos 4 grupos (idempotente, só insere se tabela vazia):

| nome | bom_dia | entrega | ok | tipos_filtro_ok |
|---|---|---|---|---|
| Nego's Internet | true | false | true | ['Internet'] |
| Nego's Sub (Designer) | false | true | true | ['Carimbo','Adesivo','Fachada','Banner/Faixa','Adesivo Recorte','Arte','Cardápio','Cartão Crachá','Perfurado','Acrílico','Placa','Cartão de Visita','Crachá','Encadernação','Fotos','Impressão','MDF','Gráfica','Plastificação','Xerox','Lona','Bloquinho Destacavel','Medalha','Adesivo','Panfletos','Fichas','5S','Outros'] |
| Migra e Instalação | false | false | false | NULL |
| Diário | false | false | false | NULL |

JID do "Nego's Internet" lido de `dashboard_config.bom_dia_grupo` (compatibilidade).
Outros chat_id ficam vazios — usuário preenche pela dashboard.

### API endpoints

| Rota | Método | Função |
|---|---|---|
| `/api/grupos` | GET | Lista grupos (auto-seed se vazio) |
| `/api/grupos` | POST | Cria grupo |
| `/api/grupos/[id]` | PUT | Edita (nome, chat_id, toggles, tipos_filtro_*) |
| `/api/grupos/[id]` | DELETE | Remove |
| `/api/notion/tipos` | GET | Lista todos os tipos válidos da DB do Notion (pra UI) |
| `/api/mensagens-agendadas` | GET / POST | Lista / cria |
| `/api/mensagens-agendadas/[id]` | DELETE | Cancela |

Padrão de auth: `getSession()` + `requireAdmin()` igual restante.
`/api/notion/tipos` usa `x-token` (igual `/api/clientes/buscar`) pra ser consumível pelo bot também.

### UI dashboard — aba "Grupos" em /admin

Sub-painel **Grupos**:
- Card por grupo: nome, chat_id, 3 toggles (Bom Dia / Entrega / OK)
- Pra cada toggle ativo, multi-select de tipos (ou "Todos os tipos")
- Botão "Adicionar grupo"

Sub-painel **Solicitações**:
- Form: select grupo, textarea, datetime-local
- Tabela: grupo, msg, data/hora, status (badge), cancelar

### Bot v3 — agente

**Tool `criar_tarefa_notion`** (mudança):
- Schema: `tipo` ganha `enum` com a lista atual da DB Notion
- Handler valida: se tipo ausente da lista → retorna erro descritivo pro modelo
  ("Tipo X não existe. Use um dos: Internet, Carimbo, Adesivo, ...")
- Modelo escolhe semanticamente o mais próximo

**Carregamento da lista de tipos:**
- 1ª chamada do agent loop busca em `https://api.notion.com/v1/databases/{db_id}` e cacheia em variável global do código (vive enquanto o processo do task-runner não morrer)
- TTL implícito = vida do task-runner (poucos minutos a horas)

**System prompt (atualização menor):**
> "tipo": escolha o mais próximo semanticamente entre os tipos válidos. Ex: "carimbo da Dra." → Carimbo. "adesivo do João" → Adesivo. Se não souber, use "Outros".

### Workflow N8N — fan-out por grupo

Hoje "Decide Notif Ok" + "Envia Notif Ok" mandam pra 1 grupo lido de Redis/dashboard_config.
Mudança:
- "Busca Grupos Notif Ok" (Postgres novo): `SELECT chat_id, tipos_filtro_ok FROM grupos_whatsapp WHERE ativo=true AND alertas_notion_ok=true`
- "Filtra Por Tipo" (Code novo): pra cada grupo, se `tipos_filtro_ok` é null/vazio OU contém o tipo da tarefa → emite. Senão pula.
- "Envia Notif Ok" (existente, parametriza chat_id de cada item)

Mesmo pro caminho Entrega.

Mesmo pro Bom Dia: "Busca Grupos Bom Dia" → `SELECT chat_id WHERE bom_dia=true` → fan-out.

### Mensagens agendadas
Adiciona ao workflow um Schedule Trigger separado:
1. `SELECT ma.*, g.chat_id FROM mensagens_agendadas ma JOIN grupos_whatsapp g ON g.id=ma.grupo_id WHERE ma.status='pendente' AND ma.agendar_para <= NOW() LIMIT 50`
2. IF tem resultado → HTTP Evolution send → UPDATE status='enviado', enviado_em=NOW()
3. Em erro → UPDATE status='erro', erro=mensagem

## Limpeza

Antes de subir: deletar a opção "teste" do multi_select Tipo no Notion (criada por engano pelo bot). É feito via PATCH na DB schema.

## Fora do escopo

- POPs por grupo (mantido global)
- System prompt por grupo (mantido global)
- Histórico por grupo: já funciona (Redis usa `conv:{chatId}`)
- Filiais separadas: já existe `admin/filiais/`

## Ordem de execução

1. Plano (este doc) ✓
2. Limpar tipo "teste" do Notion
3. Bot — enum de tipos válidos + validação (Parte 1)
4. Postgres — tabelas + seed (Parte 2 — schema)
5. APIs — `/api/grupos*`, `/api/notion/tipos`, `/api/mensagens-agendadas*` (Parte 2 — endpoints)
6. UI — aba Grupos no /admin (Parte 3)
7. Workflow N8N — fan-out por grupo + filtro de tipo + agendadas (Parte 4)
8. Deploy dashboard + commits
9. Doc final em `cerebro-evolutivo/multigrupo-tipos-implementado.md`

## Validação ao final

- [ ] /admin → aba Grupos → 4 grupos pré-cadastrados
- [ ] Editar "Nego's Sub", preencher chat_id, ativar Entrega+OK, escolher tipos do designer
- [ ] Criar tarefa no Notion com tipo "Carimbo" e marcar OK → notificação chega só no grupo Designer
- [ ] Criar tarefa "Internet" e marcar OK → notificação só no grupo Internet
- [ ] Pedir ao bot "agenda um carimbo da Dra." → tool cria com Tipo=Carimbo (não inventa)
- [ ] Tentar pedir tipo absurdo "abre tarefa de planeta marte" → tool valida e bot pede esclarecimento
- [ ] Agendar mensagem teste pra grupo X daqui 2 min → chega + status="enviado"
