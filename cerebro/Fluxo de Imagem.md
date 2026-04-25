# Fluxo de Imagem

← volta para [[Workflow N8N]] | [[Funcionalidades]]

Análise automática via **Claude Vision** (Haiku 4.5 nativo). Suporta **single ou multi-imagem** (até 10 por mensagem).

## Diagrama

```
Detecta Imagem
  → Imagem Preloaded? (IF)
       ├─ false → Baixa Imagem (Evolution API)
       └─ true  → [dashboard: base64 já veio, até 10 imagens]
                     ↓
  → Prepara Body Imagem (Code: monta JSON com TODAS as imagens no content array)
  → Descreve Imagem (HTTP → Anthropic API, Haiku 4.5 Vision)
       ├─ 1 imagem:  max 300 tokens, prompt "Descreva em 1-3 frases CURTAS..."
       └─ 2-10 imgs: max 600 tokens, prompt "Analise o conjunto considerando a SEQUÊNCIA..."
  → Formata Imagem (monta dbMensagem, guarda allImages[])
       ├─ Salva Imagem (Postgres: INSERT ON CONFLICT DO UPDATE — sobrescreve "[imagem]")
       └─ Verifica Menção Imagem (IF)
             └─ true → entra no fluxo principal com TODAS as imagens no content array
```

## 1 webhook = 1 resposta

Mesmo com 10 imagens, o bot faz **apenas 1 chamada** ao Claude Vision e devolve **1 resposta** analisando o conjunto.

## Custo

- ~US$ 0,0015 por imagem (Haiku 4.5 Vision)
- ~100 imagens/dia ≈ US$ 4/mês

## Caso de uso

Analisar prints de conversa do WhatsApp — usuário manda vários prints de uma negociação e pede sugestão de melhoria. O bot vê a sequência toda e responde uma única avaliação consolidada.

## Detalhe do `Salva Imagem`

Usa `INSERT ... ON CONFLICT (message_id) DO UPDATE SET mensagem = EXCLUDED.mensagem`. Isso **sobrescreve** o placeholder `[imagem]` que o fluxo de texto (Salva no Postgres paralelo) inseriu primeiro. Ver [[Banco de Dados]] tabela `mensagens`.
