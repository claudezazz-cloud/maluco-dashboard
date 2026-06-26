# Reclamação encaminhada + contato compartilhado → atribuir ao CLIENTE (26/06/2026)

## Sintoma
Relatório da manhã reportou: *"Nego reportou às 11:00 que a rede está bloqueando todos os acessos remotos (AnyDesk/Rust)"* e criou tarefa no Notion. **Errado:** foi o **cliente Cassiano** (Cassiano Francisco Neves Moleiro, cód **15089**, grupo LDL) que reclamou — o **Negos só ENCAMINHOU** a mensagem dele e **compartilhou o contato** do Cassiano. O bot atribuiu ao Negos (quem postou).

## Causa-raiz (2 perdas de dado no nó `Extrai Dados Mensagem`)
Como o bot armazenou (tabela `mensagens`):
- As 3 mensagens encaminhadas ficaram como enviadas por `negosoliveira`, **sem marca de "encaminhada"**.
- O cartão de contato virou só **`[contato]`** — o **nome "Cassiano Moleiro" foi descartado**. (linha `else if (eMsg.contactMessage...) mediaTag = '[contato]'`)

Sem o nome do contato nem o flag de encaminhada, o bot só viu "Negos falando que a rede DELE bloqueia acessos" → atribuiu ao Negos.

## Fix (26/06)
1. **Nó `Extrai Dados Mensagem` (Pj5SdaxFh9H9EIX4):** o ramo de contato agora pega o nome do `contactMessage.displayName` (fallback: `FN:` do vCard) → grava **`[contato: Cassiano Moleiro]`**. Deploy cirúrgico `/tmp/deploy_extrai_contato.py` (node --check, mexe só no ramo de contato, baixo risco). Verificado com msg sintética. Backup em `/root/nodes_backup_extrai_*`.
2. **System prompt** ganhou a regra **"RECLAMAÇÃO ENCAMINHADA / CONTATO COMPARTILHADO"**: quando alguém ENCAMINHA uma reclamação (`[encaminhada]`) e/ou COMPARTILHA um `[contato: NOME]` junto de um problema, a reclamação é do **CLIENTE** (o NOME) — só RELATADA por quem postou. NÃO atribuir a quem encaminhou; identificar o cliente via buscar_cliente/historico_cliente.

> ⚠️ **Flag "[encaminhada]" ainda NÃO é capturado** (só o nome do contato). Dá pra adicionar no mesmo nó lendo `ctxInfo.isForwarded`/`forwardingScore` e prefixando `finalMessage` — mas isso toca o caminho de TODA mensagem (mais risco), por isso ficou de fora por enquanto. Hoje a regra funciona pelo `[contato: NOME]` perto da reclamação.

Ver: [[workflow-n8n]] · [[relatorio-notion-deterministico]] · [[historico-cliente]]
