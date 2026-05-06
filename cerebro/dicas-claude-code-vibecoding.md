# Dicas de Claude Code para Vibecoding

Notas para o usuário (Franquelin) que orquestra o projeto Maluco da IA usando Claude Code dentro do Antigravity, sem saber programar tradicionalmente.

## Princípio fundamental: o Claude Code é executor, você é arquiteto

O Claude Code é incrivelmente competente em **executar** mudanças e **diagnosticar** sistemas. O ponto fraco é ele **não saber o que você já tentou** entre sessões. Seu papel é dar contexto certo, no momento certo.

## Top 10 dicas práticas

### 1. Direcione o início da sessão com contexto
❌ "tem um bug, conserta"
✅ "Lê `dashboard/cerebro/bugs-abertos.md`. O bug X está acontecendo: [print]. Já tentei Y."

Economiza minutos da IA fuçando arquivos errados.

### 2. Use a pergunta "você não fazia assim antes?"
Quando o Claude está patinando, sua memória do projeto vale ouro. Force a lembrança:
> "No começo você usava método X via API + deactivate/activate. Ainda funciona?"

Foi isso que destravou o bug do `workflow_history` em mai/2026.

### 3. Screenshots > descrições
Print do dashboard, do erro, da resposta do bot = 10x mais útil que descrever em texto.

### 4. Detecte o loop e quebre
Se a IA refaz a mesma tentativa 3+ vezes sem progresso:
> "Para. Você está em loop. Tenta outro ângulo completamente: A, B ou C?"

### 5. Critérios de sucesso explícitos
"Abaixar tokens pra pelo menos 10k", "responde em menos de 3s", "teste em 3 mensagens diferentes". A IA sabe quando parar quando você define o alvo.

### 6. Comite cedo, comite sempre
Se a sessão crashar, trabalho some. Peça commits de progresso parcial:
> "Comita o que tem, mesmo incompleto. Quero garantir que não some se a sessão fechar."

### 7. Plan mode antes de mudanças grandes
Use `/plan` ou peça "monta um plano antes de fazer". Você vê o que vai acontecer ANTES de quebrar algo.

### 8. Termine cada sessão atualizando o Obsidian
Regra obrigatória do `CLAUDE.md`. A IA não lembra entre sessões — sem nota, você vai gastar a próxima redescobrindo.

### 9. Antigravity: olhar histórico em paralelo
Se você só usa a extensão Claude Code dentro do Antigravity, abra o painel "Conversas" em janela separada. Te lembra do que falou há 30 minutos enquanto a IA trabalha.

### 10. Sessão ficando lenta? Reset.
Se passou 30%+ do uso sem progresso real:
- Comita o que tem
- Abre sessão nova com: "Lê o último commit + `bugs-abertos.md`. Continuação de [problema]."

Sessão fresca + contexto certo > sessão exausta tentando lembrar.

## Anti-padrões que custaram caro nesse projeto

### "Vai vendo, conserta isso aqui" sem contexto
Resultado: a IA fuça 20 arquivos, lê coisas erradas, gasta 30k tokens só pra entender o que você quer. Sempre comece com **onde está** o problema.

### Confiar que a IA lembra entre sessões
Ela NÃO LEMBRA. O que persiste é:
- `CLAUDE.md` (carregado automaticamente)
- `memory/MEMORY.md` (memória persistente do Claude Code)
- Notas em `dashboard/cerebro/` (precisam ser lidas explicitamente OU referenciadas no CLAUDE.md)

Tudo o resto morre quando a sessão acaba.

### Aceitar a primeira solução proposta
A IA frequentemente sugere fix superficial em vez de raiz. Pergunte:
> "Por que o problema acontece? Qual é a causa raiz, não o sintoma?"

Só implementa quando entender (ou quando ela explicar de forma que faça sentido pra você).

### Não testar o resultado
"Pronto, deve funcionar" — não confie. Sempre peça:
> "Testa de verdade. Manda um curl, abre o dashboard, faz a ação. Me mostra o resultado."

A IA pode achar que terminou e não ter rodado nada.

### Misturar várias mudanças no mesmo deploy
Se quebrar, não dá pra saber qual foi. Faça um por vez (ou peça commits separados).

## Comandos úteis pra acelerar sessões

```
/plan                              # entra em plan mode (mostra plano antes de mexer)
/clear                             # limpa contexto da sessão (use se ficar confuso)
@arquivo.md                        # cita arquivo específico no chat
@dashboard/cerebro/      # cita pasta inteira (cuidado com tokens)
```

## Quando NÃO confiar 100% no Claude Code

- ✅ Excelente em: investigação de código, escrita de código, edits cirúrgicos, diagnóstico de SQL/logs, escrever scripts, gerar documentação
- ⚠️ Moderado em: estimativa de tempo, decisões de arquitetura sem dados, propor o "melhor" caminho (geralmente tem 2-3 caminhos válidos)
- ❌ Fraco em: lembrar contexto entre sessões, prever side effects de longo prazo, julgar prioridade de bugs sem você dizer

## Métrica de sucesso da sessão

Boa sessão = 1-2 problemas resolvidos + 1 doc atualizado + commit final
Sessão problemática = 4+ horas em 1 problema, vários arquivos editados sem commit, contexto fragmentado

Se sentir que está caindo no segundo caso → reset.

## Última dica: você está fazendo bem

Manter Obsidian atualizado, fazer perguntas meta sobre consumo, perguntar "você não fazia assim antes?", documentar bugs abertos pra próxima sessão — tudo isso é mais maduro do que muito programador faz. Vibecoding com método ≠ vibecoding caótico.

Continue assim.

---

**Ver também:** [[Maluco da IA]] · [[Objetivo]] · [[arquitetura-geral]] · [[bugs-abertos]]
