# Tool `historico_cliente` + página /clientes (23/06/2026)

Feature pra o bot **puxar o histórico de um cliente sob demanda** (em vez de injetar a memória de todo cliente em todo prompt). Nasceu junto com a desativação da memória automática (ver [[agent-loop-tool-use]] — token opt 22/06): o conhecimento por cliente saiu do prompt fixo e virou tool.

## O que é o "histórico"
Os **fatos aprendidos** em `bot_memoria_longa` (`entidade_tipo='cliente'`, `entidade_id='código - nome'`): problemas recorrentes, vendas/upgrades, preferências, equipamento, inadimplência. Populado pela tool `aprender_fato` (que continua ativa). Hoje ~27 fatos; cresce com o uso.

## Peças (todas 23/06/2026)
| Peça | Onde | Função |
|---|---|---|
| Tool `historico_cliente(q)` | nó **Claude API** (agent loop) | bot chama passando nome/código; recebe os fatos do cliente |
| `GET /api/clientes/historico?q=` | `app/api/clientes/historico/route.js` | **backend da tool** (token-auth `x-token`). Resolve cliente(s) por nome/código e devolve `{resultados:[{cod,nome,fatos:[...]}]}` |
| `GET /api/clientes/lista?q=&page=&comHistorico=` | `app/api/clientes/lista/route.js` | backend da **página** (sessão). Todos os clientes paginados (40/pág) + fatos agregados |
| Página **/clientes** | `app/clientes/page.jsx` (era só redirect) | lista buscável de TODOS os clientes; cada um expande e mostra o histórico. Link no Navbar (ícone Users) |

**Match cliente↔fato:** `split_part(entidade_id, ' - ', 1) = cod` (extrai o código do `'código - nome'`). Busca de cliente por nome usa `unaccent(LOWER(nome)) LIKE` (mesmo padrão do `buscar_cliente`).

## Como o bot usa
System prompt (seção 🧠 CONTEXTO E MEMÓRIA) instrui: *"Para o histórico/contexto aprendido de um cliente, USE historico_cliente ANTES de responder algo sobre ele."* O `buscar_cliente` continua pra achar o código exato (faturamento); `buscar_chamados` pra tickets. Os três são complementares.

## Deploy
- Dashboard (rotas + página + Navbar): `scp` + `npm run build` + `pm2 restart maluco-dashboard`.
- Tool no agent loop: **`v3_dump/deploy_agentloop_historico.py`** — patch cirúrgico no nó 'Claude API' (insere schema após `buscar_cliente` + handler antes de `criar_tarefa_notion`), com **`node --check`** antes de tocar o n8n e backup em `/root/nodes_backup_agentloop_*`. Mesmo mecanismo entity+history+republish de [[deploy-workflow]].
- ⚠️ O nó 'Claude API' tem **API keys hardcoded** — o arquivo `v3_dump/agent_loop_code.js` NÃO vai pro git; edição é sempre no VPS.

## Teste (validado 23/06)
Webhook sintético "o que você sabe sobre o cliente Lucas Porto?" → bot chamou `historico_cliente`, respondeu com o fato ("upgrade 700Mb com ZAZZ TV"), **1.377 tokens**. API testada: `?q=10847` e `?q=Lucas Porto` retornam o cliente + fatos.

Ver: [[agent-loop-tool-use]] · [[deploy-rotas-nos]] · [[memoria-sistema]]
