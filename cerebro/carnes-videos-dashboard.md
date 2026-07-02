# Carnês gerados na aba Clientes (nome + vídeo) — 02/07/2026

A página **/clientes** ganhou a aba **"Carnês gerados"**: lista TODOS os carnês que o bot gerou no Routerbox (nome do cliente, código, meses, data, status) e o **vídeo da geração** (player embutido — prova de cada boleto emitido).

## Peças
| Peça | Onde | Função |
|---|---|---|
| `GET /api/carnes` | `app/api/carnes/route.js` (sessão) | lista `fila_jobs` tipo `carne` (payload: nome/cliente/meses; resultado: mensagem + caminho do vídeo) e casa com os arquivos no disco |
| `GET /api/carnes/video?f=carne_*.mp4` | `app/api/carnes/video/route.js` (sessão) | **streama o mp4** com suporte a **Range/206** (seek no player). Filename validado por regex estrita `^carne_[A-Za-z0-9]+_[0-9T\-]+\.mp4$` — anti path-traversal (testado: `?f=../../.env` → 400) |
| Aba na página /clientes | `app/clientes/page.jsx` | toggle "Clientes" / "Carnês gerados"; cada carnê expande com `<video controls preload="none">` |

## Dados (onde vive o quê)
- **Jobs:** `fila_jobs` com `tipo='carne'` — `payload = {nome, cliente(código), meses[]}`, `status` (feito/erro), `resultado` JSON com `mensagem` e **`video`** (caminho absoluto do mp4).
- **Vídeos:** `RB_VIDEO_DIR` = `/opt/zazz/dashboard/tools/gerar_carne/videos/`, arquivos `carne_<código>_<timestamp>.mp4` (~0.5–3.5MB). Sem purge automático (~372MB hoje) — se crescer demais, criar cron de limpeza (>60d) e a UI já mostra "vídeo não disponível" pros limpos.
- **Match job↔vídeo:** 1º `basename(resultado.video)` se o arquivo existe; fallback: arquivo mais recente `carne_<código>_*`.

Ver: [[historico-cliente]] · [[gerar-carne-bugs-popup]] · [[IMPLEMENTACAO_GERAR_CARNE]]
