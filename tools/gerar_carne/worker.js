// Worker do faturamento: roda no VPS, chamado por /api/faturar.
// 1) Resolve o cliente (código ou nome). 2) Gera o carnê (faturarCliente, grava vídeo).
// 3) Envia o vídeo 1.5x no grupo via Evolution. 4) Imprime o resultado em JSON.
//
// Config via ENV (setados no .env do dashboard no VPS):
//   RB_USER, RB_PASS         — conta Routerbox exclusiva do bot
//   RB_VIDEO_DIR             — pasta pra gravar o vídeo
//   DASH_BASE, DASH_TOKEN    — pra resolver nome->código de cliente
//   EVO_URL, EVO_KEY, EVO_INSTANCE — Evolution API (envio do vídeo)
//   CARNE_CHAT_DEFAULT       — grupo padrão se não vier chat_id
import fs from 'fs';
import { faturarCliente } from './faturar.js';

const DASH_BASE = process.env.DASH_BASE || 'http://localhost:3001';
const DASH_TOKEN = process.env.DASH_TOKEN || 'MALUCO_POPS_2026';
const EVO_URL = process.env.EVO_URL || 'https://lanlunar-evolution.cloudfy.live';
const EVO_KEY = process.env.EVO_KEY || '';
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'ZazzClaude';

// Resolve nome -> código via API de clientes do dashboard. Se já for número, retorna direto.
async function resolverCodigo(cliente) {
  if (/^\d+$/.test(String(cliente).trim())) return String(cliente).trim();
  try {
    const r = await fetch(`${DASH_BASE}/api/clientes/buscar?q=${encodeURIComponent(cliente)}&limit=10`, {
      headers: { 'x-token': DASH_TOKEN },
    });
    const data = await r.json().catch(() => ({}));
    const res = data.resultados || [];
    if (res.length === 0) return null;
    // Preferir match exato de nome; senão o primeiro
    const exato = res.find(c => (c.nome || '').trim().toLowerCase() === String(cliente).trim().toLowerCase());
    return String((exato || res[0]).cod);
  } catch {
    return null;
  }
}

// Envia o vídeo no grupo via Evolution (sendMedia, base64).
async function enviarVideo(chatId, videoPath, caption) {
  if (!chatId || !videoPath || !fs.existsSync(videoPath)) return { enviado: false, motivo: 'sem chatId/vídeo' };
  const ext = videoPath.toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm';
  const mimetype = ext === 'mp4' ? 'video/mp4' : 'video/webm';
  const base64 = fs.readFileSync(videoPath).toString('base64');
  try {
    const r = await fetch(`${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: chatId,
        mediatype: 'video',
        mimetype,
        fileName: `carne.${ext}`,
        caption,
        media: base64,
      }),
    });
    if (r.status >= 400) return { enviado: false, motivo: `Evolution HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e.message };
  }
}

(async () => {
  const clienteArg = process.argv[2];
  const mesesRaw = process.argv[3];
  const chatId = process.argv[4] || process.env.CARNE_CHAT_DEFAULT || '';

  if (!clienteArg || !mesesRaw) {
    console.log(JSON.stringify({ sucesso: false, mensagem: 'Parâmetros cliente ou meses faltando.' }));
    process.exit(1);
  }

  let meses = mesesRaw.split(',').map(m => m.trim()).filter(Boolean);

  // GUARDA DE NEGÓCIO: NUNCA faturar Dezembro — gera boleto com vencimento em 2027,
  // o que é proibido pelas normas da empresa (faturar.js fixa ano=2026).
  const PROIBIDOS = ['dezembro'];
  const bloqueados = meses.filter(m => PROIBIDOS.includes(m.toLowerCase()));
  meses = meses.filter(m => !PROIBIDOS.includes(m.toLowerCase()));
  if (bloqueados.length) {
    console.error(`[GUARDA] Meses bloqueados (geram boleto 2027, proibido): ${bloqueados.join(', ')}`);
  }
  if (meses.length === 0) {
    console.log(JSON.stringify({ sucesso: false, mensagem: `Nenhum mês permitido. ${bloqueados.length ? 'Dezembro/2027 é proibido pelas normas.' : ''}`.trim() }));
    process.exit(1);
  }

  // Garante gravação de vídeo
  if (!process.env.RB_VIDEO_DIR) process.env.RB_VIDEO_DIR = '/opt/zazz/dashboard/tools/gerar_carne/videos';
  try { fs.mkdirSync(process.env.RB_VIDEO_DIR, { recursive: true }); } catch {}

  // LOCK: só 1 faturamento por vez (mesma conta Routerbox = sessão única; 2 ao mesmo
  // tempo se chutam). Se já houver um rodando (PID vivo), aborta.
  const LOCK = '/tmp/faturamento_rbx.lock';
  try {
    if (fs.existsSync(LOCK)) {
      const oldPid = parseInt(fs.readFileSync(LOCK, 'utf-8').trim(), 10);
      let vivo = false;
      try { process.kill(oldPid, 0); vivo = true; } catch {} // PID morto -> kill lança
      if (vivo) {
        console.log(JSON.stringify({ sucesso: false, mensagem: `Já tem um faturamento rodando (PID ${oldPid}). Aguarde e tente de novo.` }));
        process.exit(1);
      }
    }
    fs.writeFileSync(LOCK, String(process.pid));
  } catch {}
  const liberarLock = () => { try { fs.unlinkSync(LOCK); } catch {} };
  process.on('exit', liberarLock);
  process.on('SIGTERM', () => { liberarLock(); process.exit(143); });
  process.on('SIGINT', () => { liberarLock(); process.exit(130); });

  try {
    const codigo = await resolverCodigo(clienteArg);
    if (!codigo) {
      console.log(JSON.stringify({ sucesso: false, mensagem: `Cliente não encontrado: "${clienteArg}".` }));
      process.exit(1);
    }

    const res = await faturarCliente(codigo, meses);

    // Monta legenda do vídeo a partir do resultado
    const g = res.detalhes?.meses_gerados || [];
    const j = res.detalhes?.ja_faturados || [];
    const partes = [];
    if (g.length) partes.push(`✅ Gerado: ${g.join(', ')}`);
    if (j.length) partes.push(`☑️ Já faturado: ${j.join(', ')}`);
    if ((res.detalhes?.erros || []).length) partes.push(`⚠️ Erros: ${res.detalhes.erros.join('; ')}`);
    const caption = `🧾 Carnê — cliente ${codigo}\n${partes.join('\n')}`;

    // Envia o vídeo no grupo
    if (res.video) {
      const envio = await enviarVideo(chatId, res.video, caption);
      res.video_enviado = envio.enviado;
      if (!envio.enviado) res.video_erro = envio.motivo;
    }

    console.log(JSON.stringify(res));
    process.exit(0);
  } catch (err) {
    console.log(JSON.stringify({ sucesso: false, erro: err.message }));
    process.exit(1);
  }
})();
