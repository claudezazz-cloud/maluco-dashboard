# Bom Dia

← volta para [[Maluco da IA]] | fluxo em [[Workflow N8N]]

Mensagem automática enviada pelo bot no grupo toda manhã **segunda a sábado às 7:30 AM** (horário de Brasília). Saudação + resumo dos chamados do dia anterior.

## Fluxo no N8N

```
Bom Dia Trigger (Schedule: 30 7 * * 1-6)
  → Busca Chamados Bom Dia (Redis: chamados:data)
  → Gera Bom Dia (Claude — prompt específico de saudação)
  → Extrai Mensagem (parse do output)
  → Busca Config Grupo (Redis: config:bom_dia_grupo)
  → Envia Bom Dia (HTTP POST pra Evolution API)
```

## Configuração

### Chave Redis `config:bom_dia_grupo`
Contém o `chat_id` do grupo onde a mensagem é enviada. Setar manualmente:

```bash
docker exec -it n8n-redis-1 redis-cli -a 'ZazzRedis2026!' SET config:bom_dia_grupo '5543999999999-1234567890@g.us'
```

### Horário

Hardcoded no `Bom Dia Trigger` node. Pra mudar, editar o cron em N8N (`30 7 * * 1-6` = min=30, hora=7, seg-sáb).

## Prompt

O nó `Gera Bom Dia` chama o Claude com um prompt curto tipo: _"Gere uma saudação de bom dia calorosa pra equipe de uma provedora, mencionando os chamados abertos resumidos"_. Resposta é livre — muda diariamente, deixa natural.

## Se não tiver chamados carregados

Se `chamados:data` estiver vazio (usuário não importou XLSX ontem), a saudação é só "bom dia sem métricas". Não quebra.

## Debug

Ver execuções filtrando por trigger type no N8N. Se mensagem não chegou, checar:
1. Workflow ativado?
2. `config:bom_dia_grupo` setado?
3. Evolution API online?
