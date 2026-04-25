# Clientes

← volta para [[Maluco da IA]] | relacionado: [[Chamados]], [[POPs]]

Base de clientes da Zazz — permite perguntar "qual o código do cliente Fulano?" ou "tem cliente chamado X?".

## Duas fontes

### 1. Tabela `dashboard_clientes` (PostgreSQL)

| Campo | Uso |
|-------|-----|
| `cod` | Código interno (PK) |
| `nome` | Nome do cliente |
| `ativo` | Soft-delete |

Importada via [[Dashboard]] `/chamados` aba **Clientes** (admin only — colaborador não pode).

### 2. [[POPs]] com categoria especial

POPs com `categoria` contendo **Cliente / Banco / Base / CRM** também viram "base de clientes" — o conteúdo é concatenado e injetado como `{{CLIENTES}}` no [[System Prompt]]. Útil pra bases pequenas ou segmentadas por filial.

## Busca

O nó `Busca Clientes` em [[Workflow N8N]] faz busca textual por nome contra `dashboard_clientes` usando as palavras da mensagem atual. Retorna:
- `TOTAL` — quantos clientes ativos existem na base
- Até N resultados mais relevantes

No prompt vira:
```
CLIENTES ENCONTRADOS NA BUSCA: 12345 - Fulano | 67890 - Ciclano (Total na base: 3521)
```

Se nenhum match: `Base de clientes ativa com 3521 clientes cadastrados.`

## Limite e cuidado com custo

Bases muito grandes (>10k clientes) podem inflar o `clientesContent` cacheado se colocadas via POP. Preferir tabela `dashboard_clientes` com busca textual — assim só os relevantes entram no prompt. Ver [[Custos]].
