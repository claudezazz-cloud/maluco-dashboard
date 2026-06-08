# Maluco da IA — Apresentação do Projeto

## O que é o projeto?

A Zazz Internet é uma provedora de internet fibra óptica em Lunardelli, no Paraná. Nossa equipe atende clientes, gerencia instalações, produz materiais gráficos e cuida da operação do dia a dia. Para organizar tudo isso de forma ágil, criamos o **Maluco da IA** — um assistente inteligente que vive dentro do WhatsApp da equipe.

---

## Para que serve?

Em vez de acessar diferentes sistemas para cada tarefa, a equipe conversa diretamente com o bot no WhatsApp. Ele entende o contexto, age e registra tudo automaticamente.

**O Maluco da IA consegue:**
- Criar e acompanhar tarefas no sistema de gestão da empresa (Notion)
- Buscar informações de clientes instantaneamente
- Criar lembretes automáticos que chegam no próprio grupo
- Aprender fatos sobre clientes e colaboradores para usar no futuro
- Marcar tarefas como concluídas
- Gerar relatórios automáticos em horários fixos
- Enviar alertas quando o status de uma tarefa muda

---

## Como funciona na prática?

Um colaborador manda uma mensagem no grupo do WhatsApp:
> "51.224 Maria José está disponível para instalação — marcar no notion para o técnico"

O bot lê, identifica o cliente pelo código, cria a tarefa no sistema e confirma no próprio chat. Tudo isso em segundos, sem precisar abrir nenhum outro sistema.

Ou então:
> "Me lembre amanhã às 10h de conferir o slide"

O bot agenda uma mensagem automática que vai aparecer no grupo no horário certo, lembrando a pessoa.

---

## O painel de controle

Existe também um site exclusivo da equipe (o Dashboard) onde é possível:
- Ver e cancelar lembretes agendados
- Configurar quais grupos recebem quais tipos de alerta
- Gerenciar o "cérebro" do bot — o que ele sabe sobre clientes, colaboradores e processos
- Acompanhar o histórico de conversas e erros
- Atualizar as instruções do bot sem precisar de programador

---

## Memória inteligente

O bot tem três camadas de memória:

1. **Memória do momento** — lembra o que foi dito naquela conversa
2. **Memória do dia** — ao final de cada dia, salva um resumo do que aconteceu em cada grupo
3. **Memória permanente** — aprende fatos duráveis sobre clientes e colaboradores que ficam guardados para sempre

Exemplo: se um cliente sempre reclama de sinal fraco em dias de chuva, o bot aprende isso e já traz a informação quando o nome do cliente for mencionado.

---

## Grupos diferentes, funções diferentes

A equipe tem vários grupos no WhatsApp. Cada grupo pode ser configurado para receber tipos específicos de alerta:
- Alertas de tarefas de internet para o grupo técnico
- Alertas de serviços gráficos para o grupo da loja
- Lembretes gerais para o grupo de gestão

---

## Automações que rodam sozinhas

Sem ninguém precisar pedir, o sistema:
- Às 8h15 de dias úteis: manda um resumo das tarefas vencidas para os grupos responsáveis
- A cada 5 minutos: monitora o sistema de gestão e avisa se alguma tarefa mudou de status
- A cada 6 horas: processa e salva aprendizados sobre os clientes
- Todo dia às 2h: consolida os resumos diários de cada grupo

---

## Resultado para a equipe

- Menos tempo alternando entre sistemas
- Tarefas registradas na hora, sem esquecer
- Lembretes que chegam sem precisar anotar nada
- Histórico completo de tudo que foi discutido
- Bot que fica mais inteligente com o tempo, aprendendo sobre a operação da empresa

---

## Tecnologias (resumido)

O projeto usa inteligência artificial da Anthropic (mesma empresa que criou o Claude, concorrente do ChatGPT), integrada ao WhatsApp via Evolution API, com automações gerenciadas pelo N8N, dados no PostgreSQL e interface no Next.js. Tudo rodando em um servidor próprio.

---

*Projeto interno da Zazz Internet — em evolução contínua desde 2026.*
