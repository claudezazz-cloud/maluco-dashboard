# Funcionalidades para um Funcionário de Verdade

Para que esse projeto passe de um simples robô que executa tarefas isoladas para um "Funcionário Autônomo" de verdade, aqui estão as principais ideias do que falta ser implementado:

## 1. Relatório de Fim de Expediente
Assim como um funcionário humano, o robô deve mandar uma mensagem no fim do dia (ex: no grupo da gerência no Telegram/WhatsApp) informando:
- Quantos chamados atendeu sozinho.
- Quantos carnês gerou com sucesso e quais deram erro.
- O que ele deixou "na mesa" para a equipe humana no dia seguinte.

## 2. Autonomia Pró-ativa (Rotinas Diárias)
Em vez de esperar você ou um cliente pedir para faturar algo, o robô pode rodar uma varredura diária no banco de dados / RouterBox procurando pendências e resolvendo ativamente:
- "Encontrei 5 clientes que estão precisando gerar faturamento esse mês, já gerei os carnês e mandei no WhatsApp deles."
- Analisar chamados abertos que estão parados há muito tempo e cobrar o técnico ou dar uma resposta ao cliente.

## 3. Integração Pró-ativa via WhatsApp (Suporte Nível 1 Autônomo)
Quando um cliente reclamar de lentidão, o robô deve ser capaz de ir no RouterBox, olhar o sinal da ONU, ver se a porta está online, realizar um ping/tracert, e já responder ao cliente com o diagnóstico final, e se não resolver, agendar uma visita técnica automaticamente.

## 4. Perfil de "Funcionário do Mês" no Dashboard
Criar no painel um dashboard específico do bot, medindo a economia e eficiência dele:
- "Tempo economizado hoje: 4 horas"
- "Faturas geradas: R$ 5.400,00"
- Para dar a verdadeira sensação de que ele é parte da equipe.

## 5. Skills de Resolução Técnica Avançada
Além de navegar em modais de faturamento, precisamos ensinar skills do tipo:
- `reiniciar_conexao_cliente`: Derruba a sessão PPPoE do cliente para forçar reconexão.
- `limpar_mac`: Limpar MAC preso.
- `mudar_vencimento`: Alterar dia de vencimento e proporcional de faturas com uma skill.

## 6. Feedback Loop (Aprendizado Contínuo)
Se o robô cometer um erro e um humano consertar, ele precisa anotar isso no Obsidian (como "Lições Aprendidas") e consultar antes de fazer de novo. A memória dele será o diferencial entre um bot burro e um funcionário experiente.
