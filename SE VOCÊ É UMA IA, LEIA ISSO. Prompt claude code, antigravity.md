# CLAUDE.md - Instruções para o Claude Code no Projeto Antigravity

## Sobre o Projeto
Este é o **Maluco da IA**, um dashboard de gerenciamento de workflows n8n da Zazz Internet. O projeto inclui uma dashboard React e workflows JSON que rodam no n8n.

## Regras Obrigatórias

### 1. Comunicação
- **Sempre explicar o passo a passo** de forma clara e detalhada. O usuário ainda está aprendendo.
- Antes de executar qualquer mudança, explique **o que vai fazer, por que, e qual o resultado esperado**.
- Use linguagem simples e direta, em português do Brasil.
- Quando corrigir um erro, explique **o que causou o erro** e **como a correção resolve**.

### 2. Segurança - API Keys e Tokens
- **NUNCA remover, alterar ou apagar API keys, tokens, credenciais ou secrets** dos arquivos de workflow ou de qualquer outro arquivo do projeto.
- Se precisar mexer em um arquivo que contém credenciais, **mantenha todas as credenciais intactas**.
- Se um token ou key parecer errado, **pergunte ao usuário antes de alterar**.
- Trate qualquer string que pareça uma key (começando com `sk-`, `xoxb-`, `Bearer`, etc.) como dado sensível que não deve ser removido.

### 3. Versionamento e Backup
- **Sempre que a mudança for drástica ou estrutural**, crie um novo arquivo com sufixo de versão antes de modificar. Exemplos:
  - `workflow.json` → criar `workflow_v2.json` (novo) e manter `workflow.json` (original intacto)
  - `dashboard/App.jsx` → criar `dashboard/App_v2.jsx` se a mudança for grande
- Para mudanças pequenas (correção de bug, ajuste de texto, fix de erro), pode editar o arquivo diretamente.
- Na dúvida se é grande ou pequena, **pergunte ao usuário**.

### 4. Arquivo de Workflow
- O arquivo principal de workflow é `workflow.json` na raiz do projeto.
- **Sempre manter este arquivo atualizado** quando fizer alterações no fluxo do n8n.
- Se criar uma versão nova, informe o usuário qual arquivo é o mais recente.

### 5. Deploy via GitHub
- Este projeto tem integração com GitHub para deploy.
- Após fazer alterações na dashboard ou no projeto, **faça o commit e push para o GitHub** para que o deploy aconteça automaticamente.
- Use mensagens de commit descritivas em português. Exemplo: `fix: corrigido erro de conexão com API do n8n`
- Sempre pergunte ao usuário antes de fazer push se a mudança foi grande.

### 6. Quando o Usuário Colar um Erro
Siga esta ordem:
1. **Leia o erro com atenção** e identifique a causa raiz.
2. **Explique o erro** em linguagem simples (o que aconteceu e por quê).
3. **Mostre a solução** passo a passo.
4. **Pergunte se pode aplicar** a correção antes de executar.
5. **Após corrigir**, explique o que foi feito e como verificar se funcionou.

### 7. Estrutura do Projeto
Ao trabalhar neste projeto, respeite a estrutura existente:
- `/dashboard` - Frontend React da dashboard
- `/workflow.json` - Workflow principal do n8n
- Não crie pastas ou arquivos fora da estrutura sem avisar o usuário.

## Resumo Rápido
| Regra | Ação |
|-------|------|
| Explicar tudo | Passo a passo, linguagem simples |
| API Keys/Tokens | NUNCA remover ou alterar sem perguntar |
| Mudança grande | Criar arquivo novo (v2, v3...) |
| Mudança pequena | Editar direto |
| Workflow | Sempre manter `workflow.json` atualizado |
| Deploy | Commit + push pro GitHub após alterações |
| Erros | Explicar causa → mostrar solução → pedir permissão → aplicar |
