# Autenticação

← volta para [[Maluco da IA]] | usado em [[Dashboard]]

Sistema simples de login JWT na [[Dashboard]]. Sem OAuth, sem MFA, sem refresh tokens — minimalismo intencional pra equipe pequena (5-10 usuários).

## Tabela `dashboard_usuarios`

| Campo | Uso |
|-------|-----|
| `email` | Login (UNIQUE) |
| `senha_hash` | bcryptjs (10 rounds) |
| `nome` | Display name |
| `role` | `admin` ou `colaborador` |
| `ativo` | Soft-delete |

## Fluxo

1. `POST /api/auth/login` com `{email, senha}`
2. Servidor valida com `bcrypt.compare`
3. Se OK, gera JWT com payload `{id, email, role, nome}` assinado com `JWT_SECRET`
4. Seta cookie `auth_token` (httpOnly, sameSite=lax, 7 dias)
5. Redirect pra `/dashboard`

## Roles

| Role | Pode |
|------|------|
| `admin` | Tudo: CRUD POPs/regras/colaboradores/filiais, system prompt, limpar histórico, importar/limpar clientes |
| `colaborador` | Ver dashboard/conversas/erros, importar/limpar [[Chamados]] (XLSX) |

## Onde se aplica

- **Páginas**: cada page faz `fetch('/api/auth/me')` no `useEffect` → 401 redirect pra `/login`
- **APIs**: `getSession()` retorna user ou null; `requireAdmin(session)` checa role
- **Páginas admin-only**: também checam `d.role !== 'admin'` no client

## Helpers em `lib/auth.js`

- `signToken(payload)` — gera JWT
- `verifyToken(token)` — valida e retorna payload
- `getSession()` — lê cookie do request, valida, retorna user
- `requireAdmin(session)` — retorna true se admin

## Segurança

- Cookie `httpOnly` — JS do browser não acessa
- `sameSite=lax` — CSRF mitigado
- Sem expiry sliding — força relogin a cada 7 dias
- Senhas bcrypt 10 rounds — adequado pra esse tamanho

## Inicial setup

`POST /api/setup` cria:
- Tabelas se não existirem
- Usuário admin inicial (`admin@zazz.com` / `admin123` se nenhum admin existir)

**Trocar a senha imediatamente após primeiro deploy** — nunca rodou em prod com a default ainda.
