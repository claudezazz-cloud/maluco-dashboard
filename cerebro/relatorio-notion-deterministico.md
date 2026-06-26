# Relatório Notion (planilha) — filtro DETERMINÍSTICO no servidor (17/06/2026)

> **Ajuste 24/06:** planilha vinha com **texto cortado** (colunas de largura fixa, sem quebra). Fix em `app/api/report-excel/route.js`: `cell.alignment.wrapText=true` + `vertical:'top'` em TODAS as células de dados (abas Notion e Chamados). Texto longo agora quebra linha em vez de cortar. Verificado gerando a planilha (66 células com wrap).
>
> **Ajuste 26/06 (planilha de CHAMADOS):** a coluna **Cód.** vinha vazia (mapeava `ch.id`, inexistente) → agora usa **`ch.cod_cliente`** (código do cliente). A coluna **"End Nº"** mostrava o **número do chamado** (`ch.numero`, ex.: 2986756) em vez do nº do endereço → **removida** a pedido (índices de `mergeCells`/`autoFilter`/alinhamento ajustados de H→G; centralizadas agora as col 5/7). Campos reais do chamado (Redis `chamados:data`): `cod_cliente`, `numero`(=nº do chamado), `end_num`(=nº do endereço, disponível se quiserem de volta). Verificado: Cód=554, 7 colunas, sem End Nº.

## Sintoma
Na solicitação programada "PARADOS NOTION SUB" (07:35, filtra "Luiz Felipe ou Negos"), o bot mandou texto _"16 do Luiz Felipe e **2 do Franquelin/Negos**"_. Franquelin não foi pedido. Verdade no Notion (status Parado): **17 Luiz, 3 Negos, 9 Franquelin — nenhuma tarefa com Franquelin+Negos juntos**. Ou seja, o bot **subcontou** (16/2 em vez de 17/3) e **inventou** o rótulo "Franquelin/Negos".

## Causa-raiz
O relatório do Notion era **todo feito pelo LLM (Haiku 4.5)**: ele chamava `listar_tarefas_notion` (texto com as 29 tarefas), **filtrava/contava/rotulava na cabeça** e montava o JSON `categorias`. A rota `/api/report-excel` era só **renderizador** (não consulta Notion, não filtra). Haiku é não-confiável filtrando dezenas de itens: subconta, dropa tarefas e conflou "Franquelin" (que estava na **descrição** de uma tarefa do Negos: _"Resolver conflito… entre Franquelin"_) com o responsável. Ainda mandava resumo no texto, que a task pedia pra NÃO mandar. **Implicação: a planilha também vinha errada, não só o texto.**

> Nota: o relatório de **chamados (Routerbox)** já era determinístico — `/api/report-excel` lê de `redis chamados:data` server-side. Só o **Notion** dependia do LLM.

## Fix (A + B, deployado 17/06)

**A — determinístico (a correção real):** `/api/report-excel` agora, quando recebe `{ fonte:'notion', filtro:{status, responsaveis} }`, **consulta o Notion server-side** (paginado), filtra por responsável e monta as categorias. O match é por **ID de pessoa** com aliases (`Russo→Junior`, `Gester→Negos`) + fallback por nome — importante porque o nome do filtro ("Negos","Russo") nem sempre é o nome da pessoa no Notion ("Negos Oliveira","Junior Souza"). Calcula "tempo restante" (Xd atrasado / em Xd) a partir da Entrega.
- Tool `gerar_relatorio_excel_notion`: schema trocado de `categorias` (LLM monta) para `filtro: {status, responsaveis[]}`. O modelo só passa o filtro; **não lista, não conta**. Backward-compat: se vier `categorias` sem `filtro`, a rota ainda renderiza (legado).

**B — prompt:** regra "RELATÓRIOS EM PLANILHA" no system prompt — usar `gerar_relatorio_excel_notion` com o filtro; NÃO listar/contar na mão; depois de enviar, **não escrever resumo/contagem/responsável no texto** (só o arquivo + legenda); **nunca inventar combinação de responsável**. Reforçado também na mensagem de retorno do handler.

**Teste sintético (verdade):** `POST /api/report-excel {fonte:notion, filtro:{status:Parado, responsaveis:[Luiz Felipe, Negos]}}` → 23 linhas = 1 header + 2 grupos + **20 tarefas (17 Luiz + 3 Negos)**, grupos "LUIZ FELIPE"/"NEGOS", **sem grupo Franquelin**, responsáveis nas células só Luiz/Negos. Contagem certa.

## Deploy
- `app/api/report-excel/route.js`: scp + `npm run build` + `pm2 restart maluco-dashboard`.
- Nó Claude API: `v3_dump/deploy_agentloop.py` (lê `agent_loop_current.js`, grava entity+history+republish; backup `BK_*`). vid `893fd6b5`.
- System prompt: `v3_dump/update_sysprompt2.py` (backup `sysprompt_backup_*`).
- `NOTION_TOKEN`/`NOTION_DB` vêm do `.env` do dashboard (já existiam).

## Aprendizado
Não deixar o LLM **filtrar/contar coleções** (dezenas de itens) — ele subconta e conflma rótulos. Mover filtro/contagem pro servidor (determinístico) e deixar o modelo só passar os **parâmetros do filtro**. Mesma filosofia do guard de carnê ([[gerar-carne-bugs-popup]] — validar no servidor, não confiar no LLM).
