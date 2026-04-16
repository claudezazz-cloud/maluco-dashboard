# 🏗️ Estrutura Mapeada do Projeto - Maluco da IA

Este documento foi criado para ser um mapa completo. Ele explica, de forma clara e não tão técnica, para que serve cada pastinha e arquivo fundamental do repositório da sua Inteligência Artificial e da sua Dashboard.

---

## 📁 Principais Diretórios de Código

### `/app/`
É aqui que vive a **Dashboard (Frontend e Backend Web)**. Este diretório é o coração da interface web e das APIs (criado em *Next.js 14*).
*   **`/app/dashboard/`, `/app/chamados/`, `/app/treinamento/`:** Cada diretório destes desenha uma tela que você acessa visualmente. Lá dentro têm o código e o visual das páginas.
*   **`/app/api/`:** São as "tomadas" secretas. É por aqui que o N8N busca as informações do Postgres para saber com qual POP responder, qual skill executar. A tela de usuários e login interage totalmente com essas APIs por baixo dos panos.
*   **`layout.js` e `globals.css`:** Arquivos mestres globais. Eles ditam o fundo escuro do site, onde vai o rodapé e a nova estética envidraçada avançada.

### `/components/`
Aqui guardamos os "Lego Bricks" visuais do site. Basicamente os componentes (itens de tela) que usamos toda hora na Dashboard.
*   *Exemplos:* `Navbar.jsx` (Barra do topo principal com o logo), `StatusCard.jsx` (A caixinha de resumo onde aplicamos os neons recentemente), e `Sidebar.jsx` (A barra lateral onde você consegue ler o arquivo 'Sobre').

### `/lib/`
As ferramentas ocultas da Dashboard.
*   `db.js`: Conexão pesada e com tolerância à queda conectando direto no seu banco PostgreSQL.
*   `redis.js`: Conecta com o serviço de cache e memória ultrarrápida do servidor (usado pela AI para ter memória das conversas nos últimos 20 minutos).
*   `auth.js`: O segurador de porta. Ele autentica a sua sessão de usuário admin para não deixar curiosos mexerem nos popups.

### `/public/`
Arquivos estáticos abertos par todos acessarem diretamente por URL. Imagens, logotipos (`logo-zazz.png`) ou fontes (o favicon).

### `/hostinger/`
Tudo o que se refere **exclusivamente aos servidores VPS e infraestrutura**.
*   `docker-compose.yml`: O manual de instruções da "fábrica". Ele constroi o contêiner do Postgres, do Redis, as redes e hospeda o n8n no seu IP.
*   `nginx.conf`: Ele serve de ponte (proxy), decidindo se os curiosos vindos da porta '80' ou '443' vão bater no Dashboard, no Evolution-API ou no n8n baseados no domínio ("n8n.seudom..." ou "painel.seudom...").
*   `SETUP_HOSTINGER.md`: O próprio manual pra um ser humano refazer todo o setup caso o mundo caberia.

### `/.github/` e `/.next/`
*   `/.github`: Scripts cruciais que observam você fazer mudanças e enviam isso direto pro universo da compilação, é a sua automação de workflow GitHub.
*   `/.next`: Uma pasta auto-gerada cheia de lixo compresso. Basicamente, sempre que o servidor liga ele compacta e refaz os arquivos web e guarda aqui, você ignora isso e nunca mexe.

---

## 📄 Arquivos Raiz - O Motor e as Engrenagens Clássicas

*   **`workflow_v2.json`:** O seu Tesouro Maior. O arquivo enorme com todos os caminhos neurais e ramificações pra dentro do Claude, o gerenciamento de arquivos de áudio, tratamentos e regras de inteligência pelo N8N.
*   **`package.json`**: A prancheta do construtor de obra. Dita e gerencia todos os pedreiros/ferramentas utilizadas pela interface de usuário (O "Tailwind", o "Bcrypt", "Next" etc...).
*   **`tailwind.config.js`**: Nosso livro de coloristas e animadores. Lá defino os verdes da marca, gradientes dinâmicos e que uma tela precisa dar Bounce (saltar).
*   **`ecosystem.config.js`**: Seu "cão de guarda" pra Dashboard no servidor (usado pelo PM2). Sempre que um erro acontecer que for capaz de quebrar/derrubar o serviço, o PM2 olha as regras apontadas nesse arquivo e sobe tudo no ar em milésimos de segundo.
*   **Scripts em Python (`*.py`)**: Como o JSON do fluxo do workflow do n8n é insanamente grande (+ 2.000 ou 3.000 linhas), nós escrevemos minicódigos (`fix_n8n_pops.py`, `add_image_nodes.py`, etc) para encontrar blocos ruins, substituir código javascript sem risco humano e consertar formatações difíceis.
*   **`reset-admin.js`**: O programa rápido de salvação, criado especialmente para você resgatar sua conta caso as senhas percam sincronismo ou sejam alteradas acidentalmente.
*   **`deploy.sh / deploy.bat`**: As manivelas. Se precisarmos engatar tudo manualmente pro Cloud de deploy e ignorar o GitHub, damos dois cliques neles.

---

## 📚 Seção de Biblioteca e Manuais (Markdown)

*   `README.md`, `DEPLOY.md`, `COMO_FUNCIONA_CHAMADOS.md`, `ALTERACOES_PROJETO.md`: Toda a bíblia de construção do seu software. Desde o motivo dele existir até quais problemas e dificuldades passamos ao construir o Redis em paralelo. Toda vez que uma inteligência chegar limpa na máquina, nós lemos isso e estamos cientes do contexto total em minutos.
*   `SE VOCÊ É UMA IA, LEIA ISSO...`: As Três Leis da Robótica locais da Maluco Da IA. Diz pra mim (AI bot), ou aos meus semelhantes como focar na transparência, nunca estragar chaves e como interagir sem prejudicar o ecossistema pronto.
