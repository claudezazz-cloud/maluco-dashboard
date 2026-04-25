# Infraestrutura

← volta para [[Maluco da IA]] | tecnologias em [[Stack Tecnologica]]

## VPS Hostinger KVM 2

- **IP**: `195.200.7.239`
- **SSH**: `root@195.200.7.239`
- **OS**: Linux (Docker + PM2)

## Serviços

| Serviço | URL | Porta | Processo |
|---------|-----|-------|----------|
| Dashboard | `https://dashboard.srv1537041.hstgr.cloud` | 3001 | PM2 |
| N8N | `https://n8n.srv1537041.hstgr.cloud` | 5678 | Docker |
| Evolution API | `https://evolution.srv1537041.hstgr.cloud` | 8080 | Docker |
| PostgreSQL | `localhost:5432` | - | Docker |
| Redis | `localhost:6379` | - | Docker |

## Credenciais locais (servidor)

- **PostgreSQL** → user: `zazz`, banco: `zazzdb`
- **Redis** → auth: `ZazzRedis2026!`

## Caminhos no servidor

- `/docker/n8n/docker-compose.yml` — stack Docker (N8N + Postgres + Redis + Evolution)
- `/opt/zazz/dashboard/` — código da [[Dashboard]] (PM2)

## Acesso rápido

```bash
ssh root@195.200.7.239
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb
docker exec -it n8n-redis-1 redis-cli -a ZazzRedis2026!
```

Ver [[Deploy]] para o fluxo completo de publicação.
