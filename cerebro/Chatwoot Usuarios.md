# Chatwoot — Usuários

← volta para [[Chatwoot]]

## Agentes cadastrados

| Nome | E-mail | Função |
|------|--------|--------|
| Franquelin Baldoria | `franquelin.almeida05@gmail.com` | Administrador |
| Claudival Nego | `lanlunardelli@gmail.com` | Administrador |
| Victor | `victorgabrielsousa79@gmail.com` | Agente |
| Computadores_F1_F2 | `F1eF2@gmail.com` | Agente |
| Luiz Felipe | `luizfelipegs131@gmail.com` | Agente |
| Junior Souza | `junioorsouza2001@gmail.com` | Agente |

> Senhas omitidas — solicitar ao administrador.

## Criar novo usuário (sem e-mail/SMTP)

```bash
ssh root@195.200.7.239
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
u = User.new(
  name: "Nome do Agente",
  email: "email@exemplo.com",
  password: "SenhaForte2026!",
  password_confirmation: "SenhaForte2026!",
  confirmed_at: Time.now
)
if u.save
  AccountUser.create!(account_id: 2, user_id: u.id, role: :agent)  # ou :administrator
  puts "OK: #{u.id}"
else
  puts "ERRO: #{u.errors.full_messages.join(", ")}"
end
'
```

> A senha precisa ter pelo menos 1 letra maiúscula.

## Resetar senha

```bash
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
u = User.find_by(email: "email@exemplo.com")
u.password = "NovaSenha2026!"
u.password_confirmation = "NovaSenha2026!"
u.save!
puts "OK"
'
```

## Atribuir agente a um inbox

Ver [[Chatwoot Inboxes]] — seção "Atribuir agentes ao inbox".

## Obter access token de um agente

```bash
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
User.all.each { |u| puts "#{u.email} | #{u.access_token&.token}" }
'
```

> O access token é usado na integração Evolution API → Chatwoot (campo `token`).
