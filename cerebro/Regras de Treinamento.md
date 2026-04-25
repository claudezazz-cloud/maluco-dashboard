# Regras de Treinamento

← volta para [[Maluco da IA]] | ver também [[POPs]] e [[Workflow N8N]]

Sistema de aprendizado em tempo real — colaborador ensina uma regra pelo WhatsApp ou Dashboard, e o bot já aplica na próxima resposta.

## Como ensinar pelo WhatsApp

Mensagem começa com `aprenda:` ou `decore:` (case insensitive) seguida da regra.

Exemplo:
```
@Maluco aprenda: sempre que perguntarem sobre cancelamento, inclua o número 0800-123
```

No fluxo ([[Workflow N8N]]):
1. `Verifica Menção` detecta o prefixo → marca `isTraining = true`
2. `É Treinamento?` (IF) desvia pro ramo de treino
3. `Salva Regra` insere na tabela `regras`
4. `Confirma` responde "ok, aprendi"

## Armazenamento

Tabela `regras` em PostgreSQL — só tem uma coluna `regra TEXT`. Simples.

Na [[Dashboard]] em `/treinamento` aba "Regras" tem CRUD completo (admin).

## Como entram no prompt

No nó `Monta Prompt`:
```js
const rulesPrompt = rules
  ? '\n\n⚠️ REGRAS ADICIONAIS DE TREINAMENTO (Siga Rigorosamente):\n- ' + rules
  : '';
```

`rules` = `.join('\n- ')` das 30 primeiras regras distintas.

## Posicionamento (importante pra [[Prompt Caching]])

O `rulesPrompt` vai no **bloco dinâmico** (sem cache), não no bloco estável. Motivo: quando o colaborador ensina uma regra nova, ela precisa entrar na próxima resposta sem esperar o TTL de cache. Se estivesse no bloco estável, a regra só valeria depois de 5 min.

## Nó crítico

`Busca Regras` precisa ter `alwaysOutputData: true`. Sem isso, quando a tabela está vazia o fluxo trava. Nunca remover.
