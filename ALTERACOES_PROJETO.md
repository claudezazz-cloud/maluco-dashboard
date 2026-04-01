# ALTERACOES_PROJETO.md — Histórico completo de mudanças

Documento gerado em 29/03/2026. Use este arquivo para contextualizar o Claude Code sobre tudo que foi modificado no projeto Maluco da IA desde a migração para a Hostinger.

---

## 1. MIGRAÇÃO DE INFRAESTRUTURA (CloudFy + Railway → Hostinger VPS)

### Infraestrutura anterior
| Serviço | Onde ficava |
|---------|-------------|
| Dashboard Next.js | Railway (auto-deploy via GitHub) |
| PostgreSQL | CloudFy |
| Redis | CloudFy (lanlunar-redis.cloudfy.live:6476) |
| N8N | N8N Cloud |
| Evolution API | CloudFy (lanlunar-evolution.cloudfy.live) |

### Infraestrutura nova (Hostinger VPS KVM 2)
| Serviço | URL | Interno |
|---------|-----|---------|
| N8N | https://n8n.srv1537041.hstgr.cloud | porta 5678 |
| Evolution API | https://evolution.srv1537041.hstgr.cloud | porta 8080 |
| Dashboard | https://dashboard.srv1537041.hstgr.cloud | porta 3001 |
| PostgreSQL | — | postgres:5432 |
| Redis | — | redis:6379 |

**IP do servidor:** `195.200.7.239`
**Docker Compose:** `/docker/n8n/docker-compose.yml`
**Dashboard (PM2):** `/opt/zazz/dashboard/`

---

## 2. BANCO DE DADOS — MUDANÇAS IMPORTANTES

### Tabela de usuários da dashboard
O código de login (`app/api/auth/login/route.js`) usa uma tabela diferente do padrão. A tabela correta é:

```sql
CREATE TABLE dashboard_usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  nome VARCHAR(255),
  role VARCHAR(50) DEFAULT 'viewer',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

**Atenção:** O código busca em `dashboard_usuarios` (com "os"), não `dashboard_users`. A coluna de senha é `senha_hash`, não `password`. Tem coluna `ativo` (boolean).

### Tabela adicional criada para o workflow
```sql
CREATE TABLE dashboard_clientes (
  id SERIAL PRIMARY KEY,
  cod VARCHAR(50),
  nome VARCHAR(255),
  ativo BOOLEAN DEFAULT true
);
```

### Acesso ao banco
```bash
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb
```

---

## 3. DASHBOARD — CONFIGURAÇÕES

### Arquivo .env atual
```
PG_URL=postgresql://zazz:ZazzPostgres2026!@localhost:5432/zazzdb
JWT_SECRET=ZazzJWT2026SuperSecret!
N8N_URL=https://n8n.srv1537041.hstgr.cloud
N8N_API_KEY=[chave gerada no painel do N8N]
N8N_POPS_TOKEN=MALUCO_POPS_2026
REDIS_URL=redis://:ZazzRedis2026!@localhost:6379
```

### Como atualizar e reiniciar
```bash
cat > /opt/zazz/dashboard/.env << 'EOF'
# cole o conteúdo aqui
EOF
pm2 restart dashboard --update-env
pm2 save
```

### Deploy (não é mais automático)
```bash
ssh root@195.200.7.239
cd /opt/zazz/dashboard
git pull origin main
npm run build
pm2 restart dashboard --update-env
```

---

## 4. NOVA FUNCIONALIDADE — CONFIGURAÇÃO DO GRUPO DO BOM DIA

### O que foi adicionado
- Nova seção "Configurações do Bot" na página `/admin` da dashboard
- Campo editável para o ID do grupo que recebe o bom dia
- A configuração é salva na tabela `dashboard_config` com a chave `bom_dia_group_id`
- Nova rota de API: `/api/config/[chave]` (GET e PUT genérico para qualquer chave da dashboard_config)

### Como funciona no workflow
O nó **"Busca Config Grupo"** faz GET na chave `config:bom_dia_grupo` do Redis.
O nó **"Envia Bom Dia"** usa o valor retornado, com fallback para o ID original:
```javascript
const groupId = $('Busca Config Grupo').first().json?.propertyName || '554384924456-1616013394@g.us';
```

### Fluxo do Bom Dia atualizado
```
Bom Dia Trigger → Busca Chamados Bom Dia (Redis) → Gera Bom Dia → Extrai Mensagem → Busca Config Grupo (Redis) → Envia Bom Dia
```

---

## 5. NOVA FUNCIONALIDADE — BOM DIA COM RESUMO DE CHAMADOS

### O que mudou no nó "Gera Bom Dia"
O bom dia agora lê os chamados importados do Redis (`chamados:data`) e gera:
1. Saudação motivacional com dia e data
2. Resumo dos chamados agrupados por tópico (Perca de Equipamento, Retenção SPC, Instalação, Serviço Indisponível, Outros)
3. Prioridades do dia (agendamentos de hoje no topo, depois vencidos, depois os mais antigos)
4. Assinatura: `_Maluco da IA 👽🍀_`

Se não houver chamados no Redis, avisa que a planilha precisa ser importada.

### Formatação obrigatória dos chamados no bom dia
```
*PERCA DE EQUIPAMENTO:*

- 123 - João da Silva | Aberto há XX dias | SLA vencido há XX dias ⚠️

*RETENCAO SPC:*

- 321 - Maria da Silva | Agendado: 26/03 09:00 (hoje) ✅
```

---

## 6. WORKFLOW N8N — AJUSTES DE CONFIGURAÇÃO

### Nós que devem ter "Execute Once" ATIVADO
- Busca POPs ✅
- Busca System Prompt ✅
- Busca Colaboradores ✅
- Busca Histórico 10 ✅
- Busca Histórico Redis ✅
- Busca Chamados Redis ✅
- Busca Clientes ✅
- Busca Regras ✅ (este também precisa de Always Output Data ATIVADO)

### Nó "Busca Regras" — configuração especial
- Execute Once: **ON**
- Always Output Data: **ON** (único nó com essa configuração — necessário para o fluxo não parar quando a tabela está vazia)

---

## 7. WORKFLOW N8N — QUERY DO NÓ "BUSCA POPs"

A query foi completamente reescrita para:
- Sempre retornar conteúdo completo dos POPs com "leia sempre" no título
- Ordenar POPs "leia sempre" sempre primeiro (ORDER BY 0)
- Retornar conteúdo dos outros POPs apenas se tiverem relevância semântica (ts_rank > 0.001)
- Buscar no conteúdo completo, não apenas nos primeiros 500 chars

```javascript
{{ (() => {
  try {
    let msg = '';
    try { msg = $('Verifica Menção').first().json.textMessage || ''; } catch(e) {}
    try { if (!msg) msg = $('Formata Transcrição').first().json.textMessage || ''; } catch(e) {}
    if (!msg) msg = '';
    const clean = msg.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim();
    if (!clean || clean.length < 3) {
      return "SELECT titulo, categoria, conteudo FROM dashboard_pops WHERE ativo = true ORDER BY categoria, titulo";
    }
    const safe = clean.replace(/'/g, "''").substring(0, 200);
    return "SELECT titulo, categoria, CASE WHEN LOWER(titulo) LIKE '%leia sempre%' THEN conteudo WHEN ts_rank(to_tsvector('portuguese', titulo || ' ' || conteudo), plainto_tsquery('portuguese', '" + safe + "')) > 0.001 THEN conteudo ELSE '' END as conteudo FROM dashboard_pops WHERE ativo = true ORDER BY CASE WHEN LOWER(titulo) LIKE '%leia sempre%' THEN 0 ELSE 1 END, ts_rank(to_tsvector('portuguese', titulo || ' ' || conteudo), plainto_tsquery('portuguese', '" + safe + "')) DESC";
  } catch(err) {
    return "SELECT titulo, categoria, conteudo FROM dashboard_pops WHERE ativo = true ORDER BY categoria, titulo";
  }
})() }}
```

---

## 8. WORKFLOW N8N — NÓ "MONTA PROMPT" REESCRITO COMPLETO

### Principais mudanças em relação à versão original
| Ponto | Antes | Agora |
|-------|-------|-------|
| POPs "LEIA SEMPRE" | Dependiam de relevância semântica | **Sempre incluídos** no topo em todas as respostas |
| Conteúdo dos POPs | Cortado em 1000-5000 chars | **Conteúdo completo** sem corte |
| POPs incluídos | Máximo 2-5 com slice | **Todos** os relevantes |
| POPs sem match | Sumiam | Aparecem como lista no final |
| System prompt | Limite 20KB | **50KB** para template |
| Limite total | 20KB | **80KB** |
| max_tokens Claude | 2048 sem chamados / 4096 com | **Sempre 4096** |
| Histórico Redis | Cortado em 500 chars | **800 chars** por mensagem |
| Placeholder `{{REGRAS}}` | Não existia | **Adicionado** |
| Chamados | Limite 8000 chars | **30000 chars** |

### Lógica dos POPs "LEIA SEMPRE"
POPs cujo título contém "leia sempre" são separados numa lista especial `leiasSemprePops` e injetados **sempre no topo do prompt**, antes de qualquer outro POP, em todas as respostas, independente da pergunta.

```javascript
// Identificação no loop de POPs
const isObrigatorio = titulo.includes('leia sempre');

if (isObrigatorio) {
  if (pop.conteudo) leiasSemprePops.push(pop);
  allNonClientTitles.push(pop);
}

// Injeção no prompt — SEMPRE no topo
if (leiasSemprePops.length > 0) {
  pops += '📌 LEIA ANTES DE RESPONDER:\n\n';
  for (const pop of leiasSemprePops) {
    pops += '=== ' + pop.titulo + ' ===\n' + pop.conteudo + '\n\n';
  }
  pops += '---\n\n';
}
```

---

## 9. CONVENÇÃO DE POPs — COMO NOMEAR

Para que o sistema funcione corretamente:

| Tipo de POP | Como nomear | Comportamento |
|-------------|-------------|---------------|
| Instruções base da IA | Título começa com "LEIA SEMPRE:" | Incluído em **todas** as respostas |
| Procedimento específico | Nome normal (ex: "Processo de nova venda") | Incluído apenas quando relevante |
| Base de clientes | Categoria: "Cliente", "Banco", "Base" ou "CRM" | Usado para busca de clientes |

---

## 10. STATUS ATUAL (29/03/2026)

### Funcionando
- ✅ Dashboard acessível em https://dashboard.srv1537041.hstgr.cloud
- ✅ N8N rodando em https://n8n.srv1537041.hstgr.cloud
- ✅ Evolution API instalada em https://evolution.srv1537041.hstgr.cloud
- ✅ PostgreSQL local com todas as tabelas criadas
- ✅ Redis local funcionando
- ✅ POPs sendo lidos corretamente pelo workflow
- ✅ POP "LEIA SEMPRE" sendo incluído em todas as respostas
- ✅ Bom dia com resumo de chamados configurado
- ✅ Configuração do grupo do bom dia via dashboard

### Pendente
- ⏳ Instância WhatsApp na Evolution API da Hostinger (aguardando celular)
- ⏳ Atualizar webhook da Evolution do CloudFy para N8N da Hostinger
- ⏳ Token do Notion expirado — precisa renovar em notion.so/my-integrations
- ⏳ Migrar dados históricos do CloudFy (opcional)

---

## 11. COMANDOS ÚTEIS NO SERVIDOR

```bash
# Ver todos os containers
cd /docker/n8n && docker compose ps

# Reiniciar tudo
cd /docker/n8n && docker compose restart

# Ver logs do N8N
docker compose logs n8n -f --tail=50

# Ver logs da Evolution
docker compose logs evolution -f --tail=50

# Acessar banco
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb

# Acessar Redis
docker exec -it n8n-redis-1 redis-cli -a ZazzRedis2026!

# Status da dashboard
pm2 status

# Logs da dashboard
pm2 logs dashboard --lines 50

# Reiniciar dashboard com novas variáveis
pm2 restart dashboard --update-env && pm2 save
```
