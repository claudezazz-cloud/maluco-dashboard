# Ollama + Llama 3 no VPS

Instalado em 09/05/2026 no VPS Hostinger (195.200.7.239).

## Specs do VPS no momento da instalação

| Recurso | Total | Disponível |
|---|---|---|
| RAM | 7.8 GB | 4.6 GB |
| Disco | 96 GB | 54 GB |
| CPU | 2 cores | AMD EPYC 9354P |
| GPU | Nenhuma | CPU-only mode |

## O que foi instalado

- **Ollama** — instalado via `curl -fsSL https://ollama.com/install.sh | sh`
- **Llama 3 8B** (`llama3:latest`) — 4.7 GB
- **Swap de 4 GB** — criado antes da instalação por segurança (RAM estava no limite)

## Swap (criado junto com a instalação)

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab  # persiste após reboot
```

Sem swap, se a RAM estourasse o OOM killer poderia matar o N8N ou outros serviços.

## Modelos disponíveis

```
NAME             SIZE      MODIFIED
llama3:latest    4.7 GB    09/05/2026
gemma:2b         1.7 GB    (instalado antes)
```

## Como usar

### Via CLI no VPS
```bash
ollama run llama3
ollama list  # lista modelos instalados
```

### Via API REST (porta 11434)
```bash
# De dentro do VPS ou de qualquer lugar com acesso:
curl http://195.200.7.239:11434/api/generate \
  -d '{"model":"llama3","prompt":"oi","stream":false}'

# Geração com stream:
curl http://195.200.7.239:11434/api/generate \
  -d '{"model":"llama3","prompt":"oi","stream":true}'

# Chat (formato messages):
curl http://195.200.7.239:11434/api/chat \
  -d '{"model":"llama3","messages":[{"role":"user","content":"oi"}],"stream":false}'
```

### Compatível com OpenAI SDK
```bash
curl http://195.200.7.239:11434/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3","messages":[{"role":"user","content":"oi"}]}'
```

## Serviço Ollama (systemd)

O Ollama roda como serviço systemd, inicia automaticamente com o VPS:

```bash
systemctl status ollama
systemctl restart ollama
systemctl stop ollama
journalctl -u ollama -f  # logs em tempo real
```

## Integração com N8N

Para usar Llama 3 no N8N como alternativa ao Claude:
- URL base: `http://localhost:11434` (de dentro do VPS)
- Endpoint: `/api/generate` ou `/v1/chat/completions` (OpenAI-compatible)
- Sem autenticação por padrão (só acessível localmente)
- No `agent_loop_code.js`: trocar URL da Anthropic pela do Ollama e adaptar formato da resposta

## Adicionar outros modelos

```bash
ollama pull llama3.2        # Llama 3.2 3B (mais leve, ~2GB)
ollama pull mistral         # Mistral 7B
ollama pull phi3:mini       # Phi-3 Mini (muito leve, ~2GB)
ollama pull codellama       # especializado em código
ollama pull llama3:70b      # Llama 3 70B (pesado — provavelmente não cabe no VPS)
```

## Monitoramento de RAM

Com Llama 3 8B rodando, o VPS consome ~5GB de RAM. Monitorar:

```bash
free -h                  # RAM e swap disponíveis
top -p $(pgrep ollama)   # processo ollama
```

Se swap estiver sendo usado consistentemente, considerar modelo menor (llama3.2:3b ou phi3:mini).

## Contexto da instalação

Instalado enquanto créditos da Anthropic zeraram temporariamente (09/05/2026). Serve como alternativa local/gratuita para casos onde Claude não está disponível ou para tarefas que não precisam de qualidade Haiku+.
