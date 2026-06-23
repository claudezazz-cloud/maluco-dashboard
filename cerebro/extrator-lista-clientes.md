# Extrator diário da lista de clientes (Routerbox → dashboard) — 23/06/2026

Atualiza `dashboard_clientes` 1x/dia com a base completa do Routerbox, agora com **Cod, CPF, Nome e Grupo**. Mesma infra do scraper de chamados ([[Chamados]]), mas exporta a grade de Clientes.

## Fluxo (scraper)
`routerbox-auto/scrape_clientes.js` (Playwright headless, roda no VPS):
1. **Login** no Routerbox (igual ao `scrape.js` de chamados; usa o mesmo `.env`).
2. **Navega:** `openMenuItem('app_menu_item_13')` = **Clientes > Cadastro** (mesmo id que o gerar_carne usa). Conteúdo carrega no iframe `app_menu_iframe`.
3. **Exporta:** acha o frame com o botão **"Opções"** → clica → clica **"Excel"** → aguarda o Routerbox gerar → clica no link **"Baixar"** do modal → baixa `cons_clientes_geral.xls` (BIFF/.xls real, não HTML).
4. **Parseia** com SheetJS (`xlsx`, lê .xls e .xlsx). Header na linha 0 (com ~14 colunas vazias antes). Colunas: `Cód, CPF/CNPJ, Nome, Sigla, Bairro, Cidade, UF, Grupo, Servidor, Situação`.
5. **POSTa** `{headers, clientes:rows}` pro dashboard.

## Import (dashboard)
`POST /api/clientes/auto-import` (token `x-auto-token` = `CHAMADOS_AUTO_TOKEN`):
- Acha os índices de `Cód / CPF/CNPJ / Nome / Grupo` pelo nome do header (normalizado, sem acento).
- **Refresh completo** (`DELETE` + bulk `INSERT`) de `dashboard_clientes` com `cod, nome, cpf, grupo`. Atualiza `clientes_texto`/`clientes_importado_em`.
- **Fail-safe:** o scraper só POSTa se conseguiu o Excel; se falhar, NÃO apaga nada (base atual fica intacta).
- Colunas novas: `ALTER TABLE dashboard_clientes ADD COLUMN cpf VARCHAR(25), grupo VARCHAR(30)` (criadas pelo `ensureTable`).

## Onde aparece
- Página **/clientes**: cada cliente mostra **código, nome, CPF** (cinza embaixo) e **Grupo** (chip). `/api/clientes/lista` devolve cpf/grupo.
- A tool `historico_cliente` e o `buscar_cliente` seguem funcionando (consultam `dashboard_clientes`).

## Cron e conta
- **`30 23 * * *`** (23:30 UTC = **20:30 BRT**), log em `/var/log/routerbox-clientes.log`.
- ⚠️ **Conta RBX compartilhada** (`ldl.franquelin.2`) — por isso roda 20:30, **fora do expediente**: se um humano estiver logado no Routerbox, a sessão do bot cai (mesmo problema do gerar_carne). NÃO rodar durante o dia.
- ✅ **Teste live OK (23/06, 20:54):** roda fim a fim — login → Clientes>Cadastro → Opções>Excel → Baixar → 1128 clientes importados (com CPF e grupo).
- 🐞 **Pegadinha do "Baixar" (resolvida):** o botão é `<a id="idBtnDown" onclick="downloadClick(); return false;" class="scButton_default disabled">` — começa com a **classe `disabled`** enquanto o Routerbox gera o .xls. Playwright clica mesmo assim (a "desabilitação" é por CSS, não pelo atributo `disabled`), mas o `downloadClick()` não faz nada → download nunca dispara. **Fix:** esperar a classe `disabled` SAIR do botão (poll até 120s) ANTES de clicar; e capturar o download em qualquer aba (`page` + popups). Sem isso dava "Timeout waiting for download".

## PII
O `.xls` tem **CPF** → `*.xls`/`*.xlsx` no `.gitignore`. `routerbox-auto/downloads/` também é gitignored. Nunca commitar planilha de cliente.

## Teste feito (23/06)
Import validado com a planilha de amostra (`cons_clientes_geral.xls` que o Franquelin gerou): **1128 clientes, todos com CPF e Grupo**. Página mostrando certo.

Ver: [[Chamados]] · [[historico-cliente]] · [[project_gerar_carne_conta_compartilhada]]
