# Skills (Comandos com /)

← volta para [[Funcionalidades]] | tabela em [[Banco de Dados]] (`dashboard_skills`)

Comandos que começam com `/` e podem ser acionados no WhatsApp ou na [[Dashboard]] (aba chat).

## Skills nativas

- `/menu` → lista todas as skills ativas com nome, descrição e exemplo (responde direto, **sem chamar Claude**)
- `/relatorio` → relatório de atendimentos do dia

## Skills customizadas

Cadastradas pela [[Dashboard]] em `/treinamento` → aba Skills. Campos:
- `nome` — comando (ex: `/financeiro`)
- `descricao` — curta, aparece no `/menu`
- `prompt_contexto` — texto injetado no prompt do Claude quando a skill é acionada
- `exemplo_uso` — ex: `/financeiro cliente 123`

## Detecção

O nó `Verifica Menção` do [[Workflow N8N]] usa regex `/(?:^|\s)(\/\S+)/` — funciona tanto em privado quanto em grupo (desde que o bot seja mencionado nesse último caso).

Quando detecta, popula `isSkillCommand`, `skillName` e `skillArgs`. Depois o nó `Busca Skills` puxa o `prompt_contexto` da tabela e o nó `Monta Prompt` injeta no system prompt do Claude, **mantendo ativas** todas as outras funções (POPs, histórico, chamados).

## Endpoint dedicado

`/api/skills/ativas` — GET com JWT (não-admin), usado pelo dropdown de skills no chat da [[Dashboard]].
