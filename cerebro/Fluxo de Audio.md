# Fluxo de Áudio

← volta para [[Workflow N8N]] | [[Funcionalidades]]

Transcrição via **Groq Whisper-large-v3** (substituiu o OpenAI Whisper — mais rápido, free tier generoso).

## Diagrama

```
Detecta Áudio
  → Áudio Preloaded? (IF)
       ├─ false → Baixa Áudio (Evolution API)
       │            ↓
       │         Converte p/ Whisper
       │            ↓
       │         Transcreve Áudio (Groq)
       │            ↓
       │         Formata Transcrição
       │
       └─ true  → Converte p/ Whisper (base64 já veio no payload)
                     ↓
                  Transcreve Áudio → Formata Transcrição

  → Salva Transcrição → Verifica Menção Áudio
  → [continua no fluxo principal de [[Workflow N8N]] a partir de Busca POPs]
```

## Por que o IF "Áudio Preloaded?"

A [[Dashboard]] tem chat com gravação via MediaRecorder (webm/opus). O base64 já vem no payload, então não precisa buscar no Evolution. O IF separa:
- **WhatsApp real** → `Baixa Áudio` busca no Evolution
- **Dashboard** → pula direto para conversão

## Groq vs OpenAI

- URL: `https://api.groq.com/openai/v1/audio/transcriptions` (API compatível OpenAI)
- Modelo: `whisper-large-v3`
- Header: `Authorization: Bearer gsk_...`

## Extração de dados

`Formata Transcrição` monta o payload que o resto do fluxo consome (igual o fluxo de texto):
- `textMessage`, `chatId`, `dbRemetente`, `dbMensagem`
- `isMentioned`, `isReport`, `isTraining`, `reportType`

Depois volta pra `Verifica Menção` e entra no fluxo normal.
