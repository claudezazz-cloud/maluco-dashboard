# Feriados + Expediente — bot não cobra fora do horário de trabalho (18-19/06/2026)

Feature pra o bot **não mandar relatório, bom dia nem cobrança quando a equipe não está trabalhando**: feriados (dia todo) E fora do expediente (domingo; **sábado fora de 09h–12h**, que é meio período).

## Expediente da equipe (19/06)
`lib/feriados.js` → `janelaForaExpediente(now)` (BRT):
- **Seg–sex:** qualquer hora (sem restrição — pode cobrar cedo também).
- **Sábado:** trabalha **até 12h** → manhã liberada (**inclusive antes das 09h**); só a **TARDE (12h em diante) pula**.
- **Domingo:** nunca dispara.

`foraDeExpediente()` combina **feriado OU fora-da-janela** → `{motivo, detalhe}` se o bot não deve disparar. Os 3 gates usam `foraDeExpediente()`. Testado: sáb 08h/10h → roda; sáb 12h/14h → pula (`sabado_tarde`); seg 06h → roda; sexta → roda; domingo → pula. **No sábado:** rotinas da manhã (07:30 bom dia, 11:40 resumo) **rodam**; as da tarde (17:20/17:30) pulam. (Regra ajustada de "09–12" para "≤12h" a pedido em 19/06.)

## Peças
- **Tabela `feriados`** (Postgres): `(id, data DATE UNIQUE, descricao, tipo, criado_em)`. `tipo` = nacional/estadual/municipal/facultativo/recesso. **Seed**: nacionais + PR + facultativos de 2026 e 2027 (29 datas). Datas móveis (Carnaval, Sexta Santa, Corpus Christi) calculadas via Páscoa.
- **`lib/feriados.js`** → `feriadoHoje()`: retorna `{data, descricao, tipo}` se HOJE (timezone America/Sao_Paulo) está na tabela, senão `null`. **Fail-safe**: erro de banco → `null` (não bloqueia as rotinas).
- **Gates** (todos chamam `feriadoHoje()` no topo):
  - `app/api/solicitacoes/processar/route.js` — se feriado, retorna `{executadas:0, motivo:'feriado'}` ANTES de buscar rotinas devidas → nenhuma rotina dispara (relatório/bom dia/resumo).
  - `app/api/tarefas/cobrar/route.js` — se feriado, retorna `{cobrados:0, motivo:'feriado'}`.
  - `app/api/mensagens-agendadas/processar/route.js` — se feriado, no loop, mensagens de COBRANÇA (`ehCobranca`) viram `status='cancelado'` (motivo:feriado) em vez de enviar. **Lembretes pessoais (não-cobrança) continuam disparando.** (Necessário porque a cobrança da manhã do feriado foi agendada no dia anterior.)
- **API `app/api/feriados/route.js`** (auth `getSession`): GET (lista de hoje pra frente), POST (add/upsert por data), DELETE `?id=`.
- **UI `app/admin/feriados/page.jsx`**: tela no Admin (botão "📅 Feriados" ao lado de "+ Nova Solicitação") pra adicionar/remover feriados — incl. municipais de Lunardelli e recessos da empresa.

## Comportamento
No feriado: bot **não dispara nada das rotinas pra equipe** (relatório, bom dia, cobrança). Cobrança da manhã agendada na véspera é **cancelada** (não fica pendurada). Lembrete pessoal de usuário ainda dispara.

## Decisões (com o usuário, 18/06)
Pular **tudo** (relatórios + cobranças + bom dia) no feriado; incluir **facultativos** (Carnaval/Corpus); gerenciar via **painel no Admin**.

## Manutenção
- Adicionar feriado municipal de Lunardelli / recesso: **Admin → 📅 Feriados → Adicionar**.
- Datas móveis de 2028+: cadastrar pelo painel (ou estender o seed).

## Deploy
Tudo via scp + `npm run build` + `pm2 restart maluco-dashboard`. Tabela criada via psql (seed). Testado: os 3 gates retornam `motivo:feriado` quando hoje está na tabela; cobrança vira `cancelado/feriado`; UI 200, API 403 sem sessão.
