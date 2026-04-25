# Custos

← volta para [[Maluco da IA]] | otimização em [[Prompt Caching]] | trade-off em [[Stack Tecnologica]]

Análise dos custos de API do projeto e o impacto das otimizações.

## Modelo atual: Claude Sonnet 4.6

Migrou de Haiku 4.5 → Sonnet 4.6 em **abril/2026**, em 3 nós (`Monta Prompt`, `Monta Prompt Relatório`, `Prepara Body Imagem`).

| Tipo | Preço por MTok |
|------|----------------|
| Input padrão | US$ 3,00 |
| Input cacheado (read) | US$ 0,30 (10x mais barato) |
| Cache write | US$ 3,75 (1,25x mais caro que input padrão) |
| Output | US$ 15,00 |

**3x mais caro** que Haiku 4.5 (US$ 1/$5). Cache continua dando 10x de desconto em reads — daí a economia da [[Prompt Caching]] continua valendo.

## Haiku 4.5 (alternativa mais barata)

| Tipo | Preço por MTok |
|------|----------------|
| Input padrão | US$ 1,00 |
| Output | US$ 5,00 |

Bom pra Vision simples e fluxos sem raciocínio profundo. Foi o modelo do projeto até abr/2026.

## Caso real medido (1 msg "oi" no grupo)

Medido com Haiku, antes da migração — multiplicar por 3 pra estimar Sonnet:

Antes do [[Prompt Caching|cache]]:
- ~19.621 tokens input × US$ 1/MTok = US$ 0,0196 por msg (Haiku) → ~US$ 0,059 com Sonnet

Depois do cache (mensagens seguintes — read):
- 16.807 tokens cacheados × US$ 0,10/MTok = US$ 0,0017 (Haiku) → ~US$ 0,005 com Sonnet
- 2.814 tokens dinâmicos × US$ 1/MTok = US$ 0,0028 (Haiku) → ~US$ 0,0084 com Sonnet
- Total: **~US$ 0,013 por msg cacheada com Sonnet** (vs US$ 0,0045 com Haiku)

## Estimativa mensal (20 msgs/dia × 30 dias = 600 msgs)

| Cenário | Custo/mês |
|---------|-----------|
| Haiku sem cache | ~US$ 12 |
| Haiku com cache | ~US$ 3 |
| **Sonnet sem cache** | ~US$ 36 |
| **Sonnet com cache (atual)** | **~US$ 9** |

## Custos extras

- **[[Fluxo de Audio|Groq Whisper]]**: Free tier confortável pra esse volume (limitado a 14.400 req/dia)
- **[[Fluxo de Imagem|Claude Vision]] com Sonnet**: ~US$ 0,004 por imagem (~US$ 12/mês a 100 imgs/dia) — antes era US$ 4/mês com Haiku
- **VPS Hostinger** ([[Infraestrutura]]): US$ ~10/mês

## Por que migrou pra Sonnet

- [[Relatorios|Relatórios]] mais ricos (síntese de muitas msgs com nuance)
- Respostas mais elaboradas em [[POPs]] longos com múltiplas etapas
- Compreensão melhor de contexto (quem disse o quê, quando)

## Otimizações ainda possíveis

- **Voltar Vision pra Haiku**: descrição automática de imagem é tarefa simples — usar Sonnet aqui é overkill, custa US$ 8/mês a mais sem ganho perceptível
- **Modelo híbrido**: usar Sonnet só onde compensa (relatórios) e Haiku no resto
- Se a fatura subir muito além de US$ 15/mês, reavaliar
