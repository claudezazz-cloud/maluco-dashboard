Audit de oportunidades, organizado por **impacto vs esforço**. Vou priorizar o que ajuda diretamente os técnicos no dia a dia, não polimento interno.

## 🔥 Alta prioridade

### 1. Alertas proativos (bot fala primeiro)

Hoje o bot é 100% reativo — só responde quando chamado. Poderia **detectar padrões e avisar o grupo sem ser perguntado**:

- Chamado aberto há mais de 4h sem resposta → "@grupo, chamado X de _Cliente_ tá parado desde 9h"
- Mesmo cliente reclamando 3x na mesma semana → "_Cliente_ reclamou 3x em 5 dias, vale ligar antes de virar churn"
- Pico de chamados na mesma região em 1h → "12 chamados na região Y nos últimos 60min, possível falha de OLT"

**Implementação:** novo trigger `Schedule` rodando a cada 30min, lê `mensagens` + [[Chamados]], aplica regras simples e envia se gatilho bater. ~3 nós novos. **Impacto:** transforma o bot de "FAQ" em "membro ativo da equipe".

### 2. Resposta em áudio (TTS)

Técnico no poste não pode ler texto. Hoje ele manda áudio (Whisper transcreve), mas a resposta volta em texto. **Adicionar TTS** (ElevenLabs ou OpenAI TTS) pra responder em áudio quando a pergunta veio em áudio.

**Custo:** ~US$ 0,015 por resposta (300 chars × OpenAI TTS US$ 15/MChar). 50 áudios/dia ≈ US$ 22/mês. **Implementação:** branch novo no [[Workflow N8N]] após `Parse Resposta` — IF "veio de áudio?" → gera mp3 → manda via Evolution API.

### 3. Skills que faltam

Os comandos `/` reduzem token e aceleram tarefas repetitivas. Faltam (verificar [[Skills]] pra confirmar quais já existem):

- `/cliente <nome>` — retorna dados do cliente direto, sem montar prompt gigante
- `/cobranca <cliente>` — gera mensagem de cobrança via template
- `/agenda` — lista tarefas Notion abertas hoje
- `/status <chamado>` — busca status específico no XLSX

**Custo:** zero (skills são código, não pagam API extra). **Esforço:** baixo, padrão já existe em [[Skills]].

## 🟡 Média prioridade

### 4. "POPs faltando" — knowledge gaps

Quando o bot **não tem POP claro** pra uma pergunta, hoje ele inventa ou desconversa. Adicionar detecção: se a resposta tem confiança baixa (ex: nenhum POP relevante encontrado, score < 2), salva em `bot_lacunas` → nova aba na [[Dashboard]] mostra "perguntas sem POP". Admin transforma em POP em 30s.

### 5. Notion bidirecional

Hoje o bot **cria** tarefas no Notion ([[Notion]]). Falta: quando tarefa é fechada no Notion, bot avisa no grupo: _"✅ Tarefa _Cliente X sem internet_ foi marcada como concluída por _João_"_. Mantém o grupo no loop sem precisar abrir o Notion.

**Implementação:** webhook do Notion → endpoint `/api/notion/webhook` na [[Dashboard]] → posta no grupo via Evolution.

### 6. Integração direta com sistema de chamados

[[Chamados]] hoje é XLSX importado manualmente. Se a Zazz usa **UISP, OctaCore ou similar** com API, dá pra puxar direto a cada hora — dados sempre frescos, sem alguém precisar exportar planilha. Pergunta: vocês usam algum ISP CRM com API exposta?

## 🟢 Baixa prioridade (mas fácil)

- **Resumo semanal automático** (segunda 8h) — não só [[Bom Dia]] diário. Bate com o tom do que vocês já têm rodando.
- **Backup automático** de POPs/regras/system prompt → daily dump pra Postgres ou S3. Se alguém deletar, recupera.
- **Audit log** — quem editou qual POP, quando. Hoje não tem rastro.
- **Dashboard de saúde** — gráfico de msgs/dia, custo Claude/dia, POPs mais acionados, taxa de erro.

---

Qual quer atacar primeiro? Eu recomendaria **#1 (alertas proativos)** — é o que mais muda a percepção da equipe sobre o bot. De "ferramenta que respondo quando lembro" pra "alguém que ajuda sozinho".