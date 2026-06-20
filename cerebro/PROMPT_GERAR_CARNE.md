# 🎯 Tool: `gerar_carne` — Automação de Faturamento RBX ISP

## Contexto do Projeto

Este script faz parte do projeto **Maluco da IA**, um sistema de automação via WhatsApp
rodando em **n8n + Claude API + Evolution API** hospedado em VPS com Docker.

O projeto já possui:
- Autenticação no sistema RBX ISP (Routerbox) via Playwright
- Módulo de login reutilizável que retorna um `page` autenticado
- Servidor Express ou equivalente para expor tools via HTTP

**NÃO refazer o login. Reutilizar o contexto autenticado existente no projeto.**

---

## Objetivo da Tool

Automatizar a geração de carnês mensais no sistema **Routerbox (RBX ISP)** para um cliente
específico, do mês atual até Dezembro/2026, sem acesso à API do sistema (automação via browser).

---

## Arquitetura de Integração

```
WhatsApp
    │
    ▼
"Gere Carnê para o Cliente X"
    │
    ▼
Maluco da IA (n8n + Claude)
    ├─ Claude busca código do cliente na base de dados (já tem acesso)
    ├─ Claude chama tool: gerar_carne({ codigo: "52261" })
    └─ Tool executa este script Playwright no VPS
            └─ Retorna JSON com resultado para o Claude responder no WhatsApp
```

---

## Estrutura de Arquivos a Criar

```
projeto-base/
└─ tools/
    └─ gerar_carne/
        ├─ index.js      ← endpoint HTTP Express (POST /tools/gerar_carne)
        └─ faturar.js    ← lógica Playwright principal (exporta função)
```

---

## Configurações Fixas do Formulário (NÃO alterar)

| Campo                  | Valor exato no sistema              |
|------------------------|-------------------------------------|
| Faturar                | `Contratos e Atendimentos`          |
| Filtrar Contratos      | Deixar TODOS desmarcados            |
| Conta a Receber        | `100-Contas a Receber - OFICIAL`    |
| Histórico              | `Contas a Receber - LDL`            |
| Classificador          | `(Selecione)` — não mexer           |
| Dia de Vencimento      | `10`                                |
| Enviar por e-mail      | `Sim`                               |
| Gateway de E-mail      | `FATURAMENTO LDL`                   |
| Ano                    | `2026`                              |

---

## Fluxo Completo do Script Playwright (`faturar.js`)

### Parâmetro recebido
```js
async function gerarCarne(page, codigoCliente)
// page     → instância Playwright já autenticada (vinda do módulo de login existente)
// codigoCliente → string com o código numérico do cliente, ex: "52261"
```

### Passo 1 — Navegar até Cadastro de Clientes
- Clicar nos **três tracinhos** (ícone hamburguer, menu lateral esquerdo)
- Aguardar menu expandir
- Clicar em **Empresa**
- Clicar em **Clientes**
- Clicar em **Cadastro**
- Aguardar a tela "Cadastro de Clientes" carregar completamente

### Passo 2 — Buscar o cliente pelo código
- Localizar o campo de busca (input de texto no topo da tabela)
- Limpar o campo e digitar o `codigoCliente`
- Clicar no botão **Pesquisar** (botão verde com lupa)
- Aguardar a tabela atualizar e mostrar o resultado
- Verificar se encontrou exatamente 1 resultado — se não encontrar, lançar erro descritivo

### Passo 3 — Abrir edição do cliente
- Clicar no ícone **"Editar o Registro"** (ícone de lápis/edição na linha do cliente)
  - Tooltip do botão: `"Editar o Registro"`
- Aguardar a tela **"Dados do Cliente XXXXX"** carregar completamente

### Passo 4 — Abrir modal de Faturamento
- Clicar no ícone de **quadradinhos/grade** (topo direito da tela do cliente)
- Aguardar menu dropdown aparecer
- Clicar em **"Faturar Cliente"**
- Aguardar o modal **"Gera Faturamento"** abrir completamente

### Passo 5 — Loop de meses (CRÍTICO — leia as observações de timeout)

Iterar sobre os meses restantes do ano atual até Dezembro:
```
meses = ["Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
```
> Ajustar dinamicamente: se o script rodar em Julho, começar por Julho. Usar `new Date().getMonth()` para determinar o mês inicial.

**Para cada mês, executar na ordem:**

1. Selecionar **Mês** no dropdown `select[name]` correspondente
2. Selecionar **Ano**: `2026`
3. Selecionar **Faturar**: `Contratos e Atendimentos`
4. **NÃO marcar** nenhum checkbox de contratos (deixar todos desmarcados — sistema considera todos automaticamente)
5. Selecionar **Conta a Receber**: `100-Contas a Receber - OFICIAL`
6. Selecionar **Histórico**: `Contas a Receber - LDL`
7. **Classificador**: não mexer (já vem como `(Selecione)`)
8. **Dia de Vencimento**: garantir que está como `10`
9. **Enviar por e-mail**: `Sim`
10. **Gateway de E-mail**: `FATURAMENTO LDL`
11. Clicar no botão **"Executar"**
12. **Aguardar confirmação de sucesso** (ver seção de timeout abaixo)
13. Logar no terminal: `[OK] Junho/2026 gerado para cliente 52261`
14. Passar para o próximo mês

---

## ⏱️ TIMEOUT E RETRY — SEÇÃO CRÍTICA

> **ATENÇÃO:** O faturamento pode demorar entre 30 segundos e 2+ minutos dependendo
> da carga do servidor. O sistema às vezes retorna erro após 2 minutos e exige
> que o mesmo mês seja tentado novamente.

### Estratégia de timeout

```
TIMEOUT_EXECUCAO = 180000ms (3 minutos)
MAX_TENTATIVAS_POR_MES = 3
DELAY_ENTRE_TENTATIVAS = 5000ms (5 segundos)
```

### Lógica de retry por mês

```
Para cada mês:
  tentativa = 1
  enquanto tentativa <= MAX_TENTATIVAS_POR_MES:
    tente:
      preencher formulário
      clicar Executar
      aguardar seletor de SUCESSO com timeout de 180000ms
      se encontrou seletor de sucesso → break (mês concluído)
    em caso de erro ou timeout:
      logar: [RETRY] Mês X — tentativa N falhou, tentando novamente...
      aguardar 5 segundos
      recarregar/reabrir o formulário do mês
      tentativa++
  se tentativa > MAX_TENTATIVAS_POR_MES:
    logar: [ERRO] Mês X — falhou após 3 tentativas
    adicionar ao array de erros
    continuar para o próximo mês (NÃO parar o script inteiro)
```

### O que considerar como "sucesso"
Após clicar em Executar, aguardar um dos seguintes sinais visuais:
- Aparecimento de mensagem de sucesso/confirmação na tela
- Desaparecimento do spinner/loading
- Reexibição do formulário limpo (pronto para o próximo mês)
- Toast/alert de confirmação

**Usar `waitForSelector` com o timeout de 3 minutos, NÃO usar `setTimeout` fixo.**

### Possível modal de confirmação
O sistema exibe o aviso **"Tenha certeza antes de confirmar!"** abaixo do botão Executar.
Se após clicar em Executar aparecer um modal/dialog de confirmação adicional (alert nativo
do browser ou modal HTML), aceitar/confirmar automaticamente antes de aguardar o sucesso.

---

## Interface HTTP (`index.js`)

```
POST /tools/gerar_carne
Content-Type: application/json
Body: { "codigo_cliente": "52261" }

Resposta de sucesso:
{
  "sucesso": true,
  "mensagem": "Carnê gerado — 7 meses (Jun-Dez/2026) para cliente 52261",
  "detalhes": {
    "meses_gerados": ["Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
    "erros": []
  }
}

Resposta com erros parciais:
{
  "sucesso": true,
  "mensagem": "Carnê gerado parcialmente — 6 de 7 meses concluídos",
  "detalhes": {
    "meses_gerados": ["Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro"],
    "erros": ["Dezembro — falhou após 3 tentativas"]
  }
}

Resposta de erro total:
{
  "sucesso": false,
  "mensagem": "Falha ao gerar carnê para cliente 52261",
  "erro": "Cliente não encontrado no sistema"
}
```

---

## Comportamento esperado no terminal (logs)

```
[START] Iniciando geração de carnê para cliente: 52261
[NAV]   Navegando para Cadastro de Clientes...
[SEARCH] Buscando cliente 52261...
[FOUND] Cliente encontrado: Franquelin Baldoria de Almeida
[EDIT]  Abrindo edição do cliente...
[MODAL] Abrindo modal de faturamento...
[MES]   Processando Junho/2026 (1/7) — tentativa 1...
[OK]    Junho/2026 — concluído em 45s
[MES]   Processando Julho/2026 (2/7) — tentativa 1...
[RETRY] Julho/2026 — timeout após 3min, tentativa 2...
[OK]    Julho/2026 — concluído em 1min20s (tentativa 2)
...
[DONE]  Carnê gerado: 7/7 meses concluídos para cliente 52261
```

---

## Observações Finais

- **SPA (Single Page Application)**: O RBX não muda a URL ao navegar internamente.
  Toda navegação deve ser feita via cliques nos menus, nunca via `page.goto()` para seções internas.
- **Busca por código numérico**: Sempre buscar pelo código (ex: `52261`), não pelo nome.
  O código é único e evita ambiguidade.
- **Seletores**: Inspecionar os elementos reais do RBX para confirmar os seletores CSS/XPath.
  Os dropdowns parecem ser `<select>` nativos — usar `page.selectOption()`.
- **Não fechar o browser entre meses**: Manter a mesma instância durante todo o loop.
- **Reutilizar login existente**: Importar e usar o módulo de autenticação já existente no projeto.
  Nunca duplicar a lógica de login.
