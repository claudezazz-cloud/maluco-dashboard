# Relatórios

← volta para [[Maluco da IA]] | fluxo em [[Workflow N8N]]

Bot gera relatórios do que rolou no grupo em diferentes janelas de tempo. Ativado por comando no WhatsApp.

## Comandos

Mensagem contém `relatorio` ou `resumo` → ativa o fluxo. Tipo de janela detectado por palavras-chave:

| Palavra-chave | Tipo | Janela |
|---------------|------|--------|
| `mensal`, `mes` | `mensal` | últimos 30 dias |
| `semanal`, `semana` | `semanal` | últimos 7 dias |
| (default) | `diario` | últimas 24h |

## Fluxo

1. `Verifica Menção` detecta termos de relatório → marca `isReport = true`, `reportType`
2. `É Relatório?` (IF) desvia pro ramo especializado
3. `Busca Histórico Postgres` query específica em `mensagens` filtrando pelo período e `chat_id` (LIMIT 2000)
4. `Monta Prompt Relatório` monta prompt específico (diferente do normal) com TODAS as mensagens do período
5. Chama Claude com instrução: "Resuma os principais temas, ocorrências e pendências desse período"
6. Envia resposta no grupo

## Armadilha: IF lê de upstream errado

`É Relatório?` é alimentado por `Busca Regras` (não por `Verifica Menção` direto). Como `Busca Regras` emite items `{regra: "..."}`, `$json.isReport` é sempre `undefined` → IF sempre vai pro FALSE → fluxo do relatório nunca roda → Claude gera relatório com as 10 mensagens do `Busca Histórico 10` (do fluxo normal).

**Fix**: leftValue do IF precisa ler explicitamente do nó certo, com guard pra nodes não executados:

```
={{ $if($('Verifica Menção').isExecuted, $('Verifica Menção').first().json.isReport === true, false)
 || $if($('Formata Transcrição').isExecuted, $('Formata Transcrição').first().json.isReport === true, false) }}
```

O `$if(...isExecuted, ..., false)` é obrigatório — n8n avalia TODAS as referências antes do `||` short-circuit, então `$('Formata Transcrição').first()` quebra com "node not executed" no fluxo de texto puro mesmo se o primeiro operando já desse `true`.

## Qualidade

Esse é o caso de uso onde [[Stack Tecnologica|trocar Haiku por Sonnet]] faz mais diferença — Sonnet sintetiza janelas grandes (centenas de mensagens) com muito mais nuance. Ver [[Custos]] pra análise de trade-off.

## Dica

Se o grupo tem muita foto, a coluna `mensagem` em [[Banco de Dados|mensagens]] hoje traz a descrição automática gerada pelo Claude Vision (ver [[Fluxo de Imagem]]). Então o relatório inclui contexto das fotos também — não fica só "[imagem]".
