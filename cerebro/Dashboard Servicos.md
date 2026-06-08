# Dashboard de Serviços (Notion)

> 💡 **Nota histórica:** Este plano e a implementação da dashboard foram arquitetados e executados por **Gemini 3.1 High via Antigravity** em 27/05/2026.

Uma nova página na aplicação Next.js para gerenciar e visualizar os serviços pendentes, sincronizando diretamente com os dados do Notion. O layout adapta automaticamente as permissões dependendo de quem acessa (Colaborador x Admin) e roda totalmente isolado do menu do Maluco da IA.

## Estrutura Desenvolvida

### Backend API (`app/api/tarefas/route.js`)
- Rota GET que usa o `NOTION_TOKEN` e `NOTION_DB` configurados no `.env`.
- Busca todas as tarefas da base, excluindo as concluídas (`status = 'Ok'`).
- Retorna um JSON simplificado contendo apenas o que o frontend precisa: `id, titulo, status, responsavel, entrega, tipo`.

### Frontend Page (`app/servicos/page.jsx`)
A interface foi construída seguindo os requisitos de visualização da equipe:
- Importa ícones premium e layout escuro moderno (Glassmorphism).
- **Sem Navbar global:** roda de forma isolada usando sua própria barra de cabeçalho.
- Layout com 2 colunas:
  - **Sidebar (Esquerda):** 
    - Lê a role da API `/api/auth/me`.
    - **Se ADMIN:** Mostra o botão "TODOS" e extrai dinamicamente a lista de responsáveis que vieram do Notion, criando filtros.
    - **Se COLABORADOR:** Mostra apenas o cartão de boas-vindas do próprio usuário e força o filtro de tarefas para o nome dele.
  - **Main Content (Direita):**
    - Exibe o contador de tarefas pendentes do contexto atual.
    - Uma tabela limpa contendo as colunas: **Título, Tipo, Status, Responsável e Data de Entrega**.
    - Datas atrasadas ficam destacadas automaticamente em vermelho com um ícone de alerta.

---
← Volta para [[INDEX]] ou [[Maluco da IA]]
