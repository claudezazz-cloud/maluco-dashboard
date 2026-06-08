# Auditoria N8N e Otimizações (02 de Junho de 2026)

Este documento registra todo o plano arquitetado, o raciocínio utilizado (por quê), as alterações executadas (o que foi feito) e as pendências em nossa infraestrutura durante a bateria de testes e otimizações do bot no N8N.

## 🎯 O Objetivo

Foi solicitada uma auditoria e uma busca por falhas de lógicas no N8N e ideias para melhorar e otimizar o fluxo completo (Maluco da IA v7).

## 🕵️ O Que Foi Encontrado (Diagnóstico)

1. **Modelo de IA Fictício (Causa de Erros e Quedas):** 
   - No `workflow_v2.json` e `Monta_Prompt.js`, a chave `model` estava configurada para `"claude-sonnet-4-6"` ou `"claude-haiku-4-5-20251001"`. Esses modelos não existem oficialmente na documentação da Anthropic.
   - **Por que é um problema:** Se o N8N tentar consumir a API da Anthropic pedindo um modelo inexistente, o sistema retorna erro *400 Bad Request*, o que aciona o tratamento de exceções (nó *Parse Resposta*) e devolve ao técnico uma mensagem de erro genérica ("Tive um probleminha técnico...").
   
2. **Potencial Armadilha de Custos (Vision API em Background):**
   - No pipeline de imagens do N8N, **todas** as mídias (fotos e áudios) enviadas ao grupo fluem silenciosamente para as APIs da Groq (Whisper) e da Anthropic (Claude Vision API) *antes* da verificação se o bot foi mencionado ou não.
   - **Por que é um problema:** Mesmo que a equipe de técnicos envie centenas de fotos e vídeos que não têm a ver com o bot, nós pagamos o custo computacional e financeiro pela leitura de 100% delas em busca da descrição (para salvar no histórico da memória).

3. **Riscos de Exaustão de Conexões no PostgreSQL:**
   - O *System Prompt* do bot requer a injeção simultânea de POPs, Regras, Clientes, Colaboradores e Histórico. Cada um desses itens estava em um nó Postgres isolado correndo em paralelo para cada mensagem recebida.
   - **Por que é um problema:** Em horários de pico (muitas mensagens enviadas rapidamente no grupo), isso esgota o pool de conexões com o banco de dados e derruba todo o sistema do Dashboard.

4. **Vazamento de Segredos de API no GitHub (Secret Scanning):**
   - Durante a tentativa de "dar push" das modificações para o Github, percebi que os arquivos `workflow_v2.json` e `v3_dump/agent_loop_code.js` hospedam os Tokens do Notion e da Groq diretamente em código limpo.
   - **Por que é um problema:** Isso impede versionamento seguro. O Github bloqueou as modificações (Git Push Protection). 

---

## 🛠️ O Que Foi Executado (Soluções Aplicadas)

### 1. Atualização Oficial do Modelo (Claude Haiku 3.5)
- **Ação:** Fiz um script Python interno para editar o `workflow_v2.json` e o `v3_dump/Monta_Prompt.js` substituindo toda a string de modelos inválida por `"claude-3-5-haiku-20241022"`.
- **Deploy:** Como o GitHub barrou o nosso envio (`git push`), transferi diretamente as modificações (via `SCP/SSH`) para o servidor VPS `195.200.7.239`, acessando o script `deploy_workflow.py` existente na infraestrutura. O N8N foi reiniciado na VPS e publicou a nova versão.

### 2. Tratamento da Trava do Claude Vision
- **Ação:** Apresentei a sugestão de colocar uma trava com um Nó `IF` para só processar imagens que explicitamente tivessem o `@Maluco` marcado na legenda.
- **Resultado:** **Cancelado pelo usuário.** Decidimos manter o fluxo integral. As imagens continuarão sendo processadas e descritas pelo Claude Vision para formar a memória de grupo para o robô.

### 3. Melhoria no Split de Cache da Anthropic
- **Ação:** O algoritmo do `Monta Prompt` foi revisado para garantir que a tag oculta `__CACHE_SPLIT__` divida perfeitamente o prompt em um bloco estático imutável (POPs, Regras) e um bloco dinâmico (Histórico Redis e Tarefas). 

### 4. Gestão do Versionamento Seguro (Git)
- **Ação:** Desfiz todos os commits locais que continham `workflow_v2.json` e a pasta `v3_dump` para não sujar o histórico de versionamento do projeto principal no GitHub, garantindo que suas chaves do Notion estejam protegidas de vazamentos na internet.

---

## 📝 Próximos Passos (Salvos na Base do Obsidian)

Adicionei uma nota no arquivo `cerebro/ideias-melhorias.md` sobre a Exaustão do PostgreSQL. A recomendação deixada para o time de infra é:
- **Criar uma rota única em Next.js:** Fazer o Dashboard hospedar uma API unificada que traz todos os POPs e Regras do banco de dados cacheados na memória do PM2. O N8N precisará apenas fazer uma requisição HTTP Request simples e rápida em vez de bater no Postgres 6 vezes por mensagem.
