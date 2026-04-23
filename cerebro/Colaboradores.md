# Colaboradores

← volta para [[Maluco da IA]] | gerenciamento em [[Dashboard]]

Cadastro dos membros da equipe da Zazz — o bot sabe quem é quem, quais funções cada um tem, e usa esse contexto pra responder (ex: "quem cuida de financeiro?" → responde com o nome do cargo certo).

## Tabela

`dashboard_colaboradores` em PostgreSQL:

| Campo | Uso |
|-------|-----|
| `nome` | Nome completo |
| `cargo` | Função formal (ex: "Técnico", "Atendente") |
| `funcoes` | Descrição livre das responsabilidades |
| `telefone_whatsapp` | Número (só dígitos, DDI+DDD, ex: `5543999998888`) — usado pra @marcar no grupo |
| `ativo` | Soft-delete |

> Coluna `telefone_whatsapp` é criada automaticamente via `ALTER TABLE ADD COLUMN IF NOT EXISTS` na primeira chamada da API (`ensureTable`).

## Como entra no prompt

No nó `Monta Prompt`, vira `colaboradoresStr`:

```
COLABORADORES DA EQUIPE:
- João (Técnico): instala fibra, atende visitas
- Maria (Atendente): SAC, cobrança, retenção
...
```

Substitui o placeholder `{{COLABORADORES}}` no [[System Prompt]].

## Cache

Entra no **bloco estável** do [[Prompt Caching]] — muda raramente (contratações/desligamentos).

## CRUD

Dashboard em `/treinamento` aba "Colaboradores" (admin only). API: `/api/colaboradores` + `/api/colaboradores/[id]`.

## Dica de uso

Preencher `funcoes` com descrição rica aumenta a utilidade. Exemplo bom: "Responsável por cobrança, SPC, acordos de pagamento, emissão de boletos". Ruim: "atendimento".

## Telefone → @menção no grupo

Quando `telefone_whatsapp` estiver preenchido, o bot poderá **@marcar** o colaborador no grupo pra cobrar tarefas do [[Notion]] (ex: "Fulano, esse chamado de 2 dias ainda tá parado"). Fluxo ainda em implementação — falta:

1. Passar o mapa `nome→telefone` no `Monta Prompt` (system prompt do Claude)
2. Instruir Claude a inserir `@5543XXXXXXXX` na linha da tarefa
3. `Parse Resposta` extrai os `@DDDDDDDDDDD` e monta array `mentions.mentioned`
4. `Envia WhatsApp` envia com `mentions: { everyOne: false, mentioned: [...] }` (formato Evolution v2)
