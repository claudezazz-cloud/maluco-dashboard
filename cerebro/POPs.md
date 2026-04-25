# POPs

← volta para [[Maluco da IA]] | armazenados em [[Banco de Dados]] | usados em [[Workflow N8N]]

**POPs (Procedimentos Operacionais Padrão)** são o coração da inteligência do bot — manuais de "como fazer X" que o Claude consulta pra responder dúvidas técnicas.

## Estrutura

Tabela `dashboard_pops` em PostgreSQL:

| Campo | Uso |
|-------|-----|
| `titulo` | Nome do POP (ex: "Como resetar senha WiFi") |
| `categoria` | Grupo (Cliente, Banco, Base, CRM, Técnico...) |
| `conteudo` | Texto completo do procedimento |
| `prioridade` | `sempre` / `importante` / `relevante` |
| `ativo` | Soft-delete |

## Como o bot escolhe quais POPs incluir

No nó `Monta Prompt`, cada POP recebe um **score de relevância semântica** em relação à mensagem do usuário:

1. Normaliza a mensagem (remove stopwords, acentos)
2. Pra cada POP: conta quantas palavras da msg aparecem no título + categoria + primeiros 800 chars do conteúdo
3. Palavras no título valem **2x** (peso maior)
4. POPs com `prioridade = 'sempre'` ou título começando com **"LEIA SEMPRE:"** entram em TODAS as respostas
5. POPs com `prioridade = 'importante'` sempre entram
6. POPs com `prioridade = 'relevante'` entram ordenados por score (os com conteúdo, top N)

## Convenção "LEIA SEMPRE"

Título começa com `LEIA SEMPRE:` → marcado como obrigatório. Usa pra regras universais (formatação, tom, limites). **Cuidado**: cada POP "sempre" infla o input em toda chamada — ver [[Prompt Caching]] e [[Custos]].

## Categorias especiais

POPs com `categoria` contendo **Cliente / Banco / Base / CRM** são tratados como **base de clientes** — conteúdo é concatenado em `clientesContent` (não entra em `pops`). Ver [[Clientes]].

## CRUD

Pela [[Dashboard]] em `/pops` (admin only). API em `/api/pops` (CRUD) + `/api/pops-n8n` (leitura token-auth pro N8N, header `x-token: MALUCO_POPS_2026`).

## Limite

O nó `Monta Prompt` trunca `systemContent` em 80.000 chars se estourar. Cada POP também é limitado a 50k no template. Na prática o bot comporta ~40-50 POPs de tamanho médio sem problema.
