import { loginToRouterbox } from '../lib/rbx_auth.js';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

// Localiza um ffmpeg. Prioridade: FFMPEG_PATH env > ffmpeg do sistema (full, faz mp4)
// > ffmpeg embutido do Playwright (só VP8/webm). Retorna { bin, full }.
function acharFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH))
    return { bin: process.env.FFMPEG_PATH, full: true };
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'])
    if (fs.existsSync(p)) return { bin: p, full: true };
  // Fallback: ffmpeg do Playwright (encoder libvpx → só webm)
  const base = process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
    : path.join(process.env.HOME || '', '.cache', 'ms-playwright');
  try {
    for (const d of fs.readdirSync(base).filter(x => x.startsWith('ffmpeg-')))
      for (const c of ['ffmpeg-win64.exe', 'ffmpeg-linux', 'ffmpeg-mac'])
        if (fs.existsSync(path.join(base, d, c))) return { bin: path.join(base, d, c), full: false };
  } catch {}
  return null;
}

// Acelera o vídeo (default 1.5x) e, se houver ffmpeg completo, converte pra mp4 (WhatsApp).
async function processarVideo(webmPath, speed = 1.5) {
  const ff = acharFfmpeg();
  if (!ff) { console.log('[VIDEO] ffmpeg não encontrado — mantendo .webm original.'); return webmPath; }
  try {
    if (ff.full) {
      const mp4 = webmPath.replace(/\.webm$/i, '.mp4');
      await execFileAsync(ff.bin, ['-y', '-i', webmPath, '-vf', `setpts=PTS/${speed}`, '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
        { timeout: 300000 });
      try { fs.unlinkSync(webmPath); } catch {}
      console.log(`[VIDEO] mp4 ${speed}x gerado: ${mp4}`);
      return mp4;
    } else {
      const out = webmPath.replace(/\.webm$/i, `_${speed}x.webm`);
      await execFileAsync(ff.bin, ['-y', '-i', webmPath, '-vf', `setpts=PTS/${speed}`, '-an',
        '-c:v', 'libvpx', '-b:v', '1M', out], { timeout: 300000 });
      try { fs.unlinkSync(webmPath); } catch {}
      console.log(`[VIDEO] webm ${speed}x gerado (sem ffmpeg full p/ mp4): ${out}`);
      return out;
    }
  } catch (e) {
    console.log(`[VIDEO] Falha no ffmpeg (${e.message.slice(0, 120)}) — mantendo original.`);
    return webmPath;
  }
}

export async function faturarCliente(codigoCliente, meses) {
  // RB_HEADLESS=false abre navegador visível (útil pra rodar local e acompanhar)
  const HEADLESS = process.env.RB_HEADLESS !== 'false';
  const { browser, context, page } = await loginToRouterbox({ headless: HEADLESS });

  // Timeouts calibrados: curtos para UI, longos para Routerbox lento
  const TIMEOUT_NAV  = 30000;    // 30s — navegação de página
  const TIMEOUT_UI   = 60000;    // 60s — elemento aparecer na tela
  const TIMEOUT_AJAX = 120000;   // 2min — AJAX / carregamento de opções
  const TIMEOUT_EXEC = 1800000;  // 30min — resultado de execução (Routerbox muito lento)
  const MAX_TENTATIVAS_POR_MES = 2;

  page.setDefaultTimeout(TIMEOUT_EXEC);

  const resultado = {
    sucesso: false,
    mensagem: '',
    detalhes: { meses_gerados: [], ja_faturados: [], erros: [] },
  };

  // Declarado no escopo da função pra que os helpers (selectCampo etc.) o enxerguem
  let frameFaturamento = null;

  // Polling adaptativo: executa predicate a cada 1s até retornar truthy ou timeout
  async function waitUntil(predicate, label, timeoutMs = TIMEOUT_EXEC) {
    const start = Date.now();
    let iter = 0;
    while (Date.now() - start < timeoutMs) {
      iter++;
      const result = await predicate(iter).catch(() => null);
      if (result) {
        console.log(`[WAIT] ${label} OK em ${Math.round((Date.now() - start) / 1000)}s`);
        return result;
      }
      if (iter % 30 === 0) {
        console.log(`[WAIT] ${label}: aguardando... ${Math.round((Date.now() - start) / 1000)}s`);
      }
      await page.waitForTimeout(1000);
    }
    console.log(`[WAIT] ${label} TIMEOUT (${Math.round(timeoutMs / 1000)}s)`);
    return null;
  }

  // Busca texto em qualquer frame (page + iframes)
  async function findTextInAnyFrame(text) {
    for (const f of [page, ...page.frames()]) {
      try {
        const loc = f.locator(`text=${text}`);
        if (await loc.count() && await loc.first().isVisible().catch(() => false)) return loc.first();
      } catch {}
    }
    return null;
  }

  // Busca botão Ok/Confirmar em qualquer frame
  async function findOkButton() {
    for (const f of [page, ...page.frames()]) {
      for (const text of ['Ok', 'OK', 'Confirmar', 'Sim']) {
        try {
          const loc = f.locator(`button:has-text("${text}"), a:has-text("${text}")`).first();
          if (await loc.count() && await loc.isVisible().catch(() => false)) return loc;
        } catch {}
      }
    }
    return null;
  }

  // Detecta o banner "Já existe faturamento para o cliente no período informado"
  async function jaExisteFaturamento() {
    return (await findTextInAnyFrame('Já existe faturamento')) !== null;
  }

  // Seleciona opção de um <select>. Dropdowns dependentes (Histórico, Classificador,
  // Gateway) carregam as opções via AJAX — então ESPERAMOS a opção desejada aparecer
  // antes de selecionar, depois confirmamos e re-selecionamos se o form resetar.
  async function selectCampo(name, label, partial) {
    const sel = frameFaturamento.locator(`select[name="${name}"]`);
    await sel.waitFor({ state: 'visible', timeout: TIMEOUT_AJAX });

    // 1. Espera a opção desejada EXISTIR no dropdown (match exato, depois parcial)
    const acharOpcao = async () => {
      const opts = await sel.locator('option').allTextContents().catch(() => []);
      let alvo = opts.find(o => o.trim() === label);
      if (!alvo && partial) alvo = opts.find(o => o.toLowerCase().includes(partial.toLowerCase()));
      return alvo || null;
    };
    const labelReal = await waitUntil(() => acharOpcao(), `opcao-${name}`, TIMEOUT_AJAX);
    if (!labelReal) {
      const opts = await sel.locator('option').allTextContents().catch(() => []);
      throw new Error(`Opção '${label}' não apareceu em '${name}'. Disponíveis: ${opts.map(o => o.trim()).join(' | ')}`);
    }

    // 2. Seleciona e verifica (re-tenta se resetar)
    for (let t = 1; t <= 4; t++) {
      await sel.selectOption({ label: labelReal }).catch(() => {});
      await page.waitForTimeout(600); // deixa o AJAX disparado pela seleção assentar
      const txt = await sel.locator('option:checked').first().innerText().catch(() => '');
      if (txt.trim() === labelReal.trim()) {
        console.log(`[SEL] ${name} = "${txt.trim()}"`);
        return txt.trim();
      }
      await page.waitForTimeout(700);
    }
    throw new Error(`Campo '${name}' não fixou em '${labelReal}' após 4 tentativas.`);
  }

  try {
    // 1. Carregar app_menu
    console.log('[NAV] Carregando app_menu...');
    await page.goto('https://routerbox.zazzinternet.com/routerbox/app_menu/app_menu.php',
      { waitUntil: 'networkidle', timeout: TIMEOUT_NAV });

    // Dismiss modal de Novidades
    try {
      const closeX = page.locator('text=/^x$/').first();
      if (await closeX.count()) await closeX.click({ timeout: 2000 });
    } catch {}
    try { await page.keyboard.press('Escape'); } catch {}

    // 2. Abrir Clientes > Cadastro — aguarda iframe (adaptativo)
    console.log('[NAV] Abrindo Clientes > Cadastro...');
    await page.evaluate(() => { if (typeof openMenuItem === 'function') openMenuItem('app_menu_item_13'); });

    const iframeHandle = page.locator('iframe#iframe_app_menu, iframe[name="app_menu_iframe"]').first();
    await iframeHandle.waitFor({ state: 'attached', timeout: TIMEOUT_UI });
    let frame = await iframeHandle.contentFrame();
    if (!frame) throw new Error('contentFrame do iframe não disponível');

    // 3. Aguarda campo de busca ficar visível (adaptativo)
    const searchSel = 'input[placeholder*="Busca"], input[placeholder*="Buscar"], input.form-control.input-sm';
    console.log('[SEARCH] Aguardando campo de busca...');
    await frame.locator(searchSel).first().waitFor({ state: 'visible', timeout: TIMEOUT_UI });

    await frame.locator(searchSel).first().fill(String(codigoCliente));
    await frame.locator(searchSel).first().press('Enter');

    // 4. Aguarda botão Editar aparecer nos resultados (adaptativo)
    console.log(`[SEARCH] Buscando cliente ${codigoCliente}...`);
    const btnEditar = await waitUntil(async () => {
      const btn = frame.locator('a[title*="Editar"], a i.fa-pencil, a i.fa-edit, a i.fa-pencil-square-o').first();
      return (await btn.count()) ? btn : null;
    }, `botao-editar-${codigoCliente}`, 30000);

    if (!btnEditar) throw new Error(`Cliente ${codigoCliente} não encontrado (sem botão editar).`);
    console.log(`[FOUND] Cliente ${codigoCliente} encontrado.`);
    await btnEditar.click();

    // 5. Aguarda página de edição carregar — espera link de faturamento (adaptativo)
    let frame2 = null;
    await waitUntil(async () => {
      frame2 = await iframeHandle.contentFrame();
      if (!frame2) return null;
      const link = frame2.locator('a[onclick*="app_faturamento.php"]');
      return (await link.count()) ? true : null;
    }, 'edicao-carregada', TIMEOUT_AJAX);

    if (!frame2) throw new Error('frame2 não disponível após clicar Editar');

    // 6. Abrir modal de faturamento — retry até iframe aparecer (adaptativo)
    console.log('[MODAL] Abrindo modal de faturamento...');
    const modalLocator = page.locator('iframe[src*="app_faturamento"], iframe#TB_iframeContent').first();

    for (let openTry = 1; openTry <= 3 && !frameFaturamento; openTry++) {
      await frame2.locator('body').evaluate((body) => {
        const link = body.querySelector('a[onclick*="app_faturamento.php"]');
        if (link) link.click();
      });

      const found = await waitUntil(async () => {
        if (await modalLocator.count()) return true;
        const inner = frame2.locator('iframe[src*="app_faturamento"], iframe#TB_iframeContent').first();
        return (await inner.count()) ? true : null;
      }, `modal-try${openTry}`, 20000);

      if (found) {
        frameFaturamento = await modalLocator.count()
          ? await modalLocator.contentFrame()
          : await frame2.locator('iframe[src*="app_faturamento"], iframe#TB_iframeContent').first().contentFrame();
        console.log(`[MODAL] Modal abriu na tentativa ${openTry}`);
      } else {
        console.log(`[MODAL] Tentativa ${openTry} sem modal, retry...`);
      }
    }

    if (!frameFaturamento) throw new Error('Frame de Faturamento não encontrado');

    // Aguarda formulário estar pronto (select de Mês visível)
    await frameFaturamento.locator('select[name="mes"]').waitFor({ state: 'visible', timeout: TIMEOUT_AJAX });
    console.log('[FREADY] Formulário de faturamento pronto.');

    // 7. Loop pelos meses
    for (let i = 0; i < meses.length; i++) {
      const mes = meses[i];
      let tentativa = 1;
      let mesConcluido = false;

      while (tentativa <= MAX_TENTATIVAS_POR_MES) {
        console.log(`[MES] ${mes}/2026 (${i + 1}/${meses.length}) — tentativa ${tentativa}...`);

        try {
          // 1. Período: Mês + Ano (dispara a checagem de "Já existe faturamento")
          await selectCampo('mes', mes);
          await frameFaturamento.locator('select[name="ano"]').waitFor({ state: 'visible', timeout: TIMEOUT_AJAX });
          await selectCampo('ano', '2026');
          await page.waitForTimeout(2000); // deixa o Routerbox rodar a validação do período

          // 2. CHECAGEM: período já faturado? → pula pro próximo mês
          if (await jaExisteFaturamento()) {
            console.log(`[SKIP] ${mes}/2026 já está faturado — pulando.`);
            resultado.detalhes.ja_faturados.push(mes);
            mesConcluido = true; // não é erro: já existe
            break;
          }

          // 3. Demais campos (rótulos com fallback por match parcial)
          await selectCampo('composicao', 'Contratos e Atendimentos', 'atendimento');
          await selectCampo('conta', '100-Contas a Receber - OFICIAL', 'oficial');
          await selectCampo('historico', 'Contas a Receber - LDL', 'ldl'); // campo obrigatório

          // Classificador é OPCIONAL (sem asterisco). Espera curta (15s) só pra ver se
          // carrega opções via AJAX; se não vier, segue sem preencher.
          const classifSel = frameFaturamento.locator('select[name="classificador"]');
          const classifOk = await waitUntil(async () => {
            if (await jaExisteFaturamento()) return 'erro';
            const n = await classifSel.locator('option').count();
            return n > 1 ? true : null;
          }, 'classificador-loaded', 15000);

          if (classifOk === 'erro') {
            console.log(`[SKIP] ${mes}/2026 já faturado (detectado no classificador) — pulando.`);
            resultado.detalhes.ja_faturados.push(mes);
            mesConcluido = true;
            break;
          }

          const classifOpts = await classifSel.locator('option').allTextContents().catch(() => []);
          const firstReal = classifOpts.find(o => o.trim() && !o.toLowerCase().includes('selecione'));
          if (firstReal) {
            await classifSel.selectOption({ label: firstReal });
            console.log(`[MES] Classificador: ${firstReal}`);
          }

          await selectCampo('dia', '10');
          await selectCampo('enviarfaturamentoemail', 'Sim', 'sim');
          await selectCampo('emailgateway', 'FATURAMENTO LDL', 'ldl');

          // 4. Confirma Histórico ainda preenchido antes de Executar (pode ter resetado)
          const histTxt = await frameFaturamento.locator('select[name="historico"] option:checked').first().innerText().catch(() => '');
          if (/escolha|selecione/i.test(histTxt) || !histTxt.trim()) {
            console.log(`[MES] Histórico resetou — re-selecionando...`);
            await selectCampo('historico', 'Contas a Receber - LDL', 'ldl');
          }

          // 5. Executar
          console.log(`[MES] ${mes}/2026: Clicando Executar...`);
          const btnGerar = frameFaturamento.locator('a#sc_Executar_bot').first();
          await btnGerar.waitFor({ state: 'visible', timeout: TIMEOUT_UI });
          await btnGerar.click();

          // FASE 1: Popup de confirmação "Confirma execução da rotina de faturamento?"
          console.log(`[POLL] ${mes}/2026: Aguardando popup de confirmação...`);
          const confirmou = await waitUntil(
            () => findTextInAnyFrame('rotina de faturamento'),
            `confirmacao-${mes}`,
            TIMEOUT_EXEC
          );

          if (confirmou) {
            const okBtn = await findOkButton();
            if (okBtn) {
              await okBtn.click({ force: true }).catch(() => {});
              console.log(`[CONFIRMADO] ${mes}/2026 — clicou Ok`);
            } else {
              console.log(`[WARN] Confirmação apareceu mas botão Ok não encontrado`);
            }
          } else {
            console.log(`[POLL] Sem popup de confirmação — pode ter ido direto ao resultado`);
          }

          // FASE 2: Resultado. Sinal de SUCESSO = o formulário RESETA (Mês volta pro
          // placeholder "Escolha Mês") após o Routerbox processar. ERRO = banner vermelho.
          console.log(`[POLL] ${mes}/2026: Aguardando resultado...`);
          const mesSel = frameFaturamento.locator('select[name="mes"]');

          const resultadoMes = await waitUntil(async (iter) => {
            // ERRO: banner "já existe" ou mensagens de falha
            if (await jaExisteFaturamento())
              return { type: 'erro', text: 'Já existe faturamento para o cliente no período informado' };
            for (const t of ['0 documento', 'Nenhum documento', 'Nenhum contrato', 'não foi possível']) {
              const el = await findTextInAnyFrame(t);
              if (el) return { type: 'erro', text: (await el.innerText().catch(() => t)).trim().replace(/\s+/g, ' ').slice(0, 200) };
            }
            // SUCESSO: formulário resetou (campo Mês voltou ao placeholder)
            const mesTxt = await mesSel.locator('option:checked').first().innerText().catch(() => '');
            if (/escolha|selecione/i.test(mesTxt) || !mesTxt.trim())
              return { type: 'sucesso', text: 'Faturamento processado (formulário resetou)' };
            // Diagnóstico periódico
            if (iter % 15 === 0) await page.screenshot({ path: `result_${mes}_${iter}s.png` }).catch(() => {});
            return null;
          }, `resultado-${mes}`, TIMEOUT_EXEC);

          await page.screenshot({ path: `carne_${mes}_t${tentativa}.png`, fullPage: true }).catch(() => {});

          if (!resultadoMes) throw new Error(`Timeout aguardando resultado de ${mes}/2026`);
          console.log(`[RESULTADO] ${mes}/2026 → [${resultadoMes.type}] ${resultadoMes.text}`);

          if (resultadoMes.type === 'sucesso') {
            console.log(`[OK] ${mes}/2026 gerado (${resultadoMes.text})`);
            resultado.detalhes.meses_gerados.push(mes);
            mesConcluido = true;
            break;
          } else if (/já existe|ja existe/i.test(resultadoMes.text)) {
            // Apareceu só na fase 2 — também é "já faturado", não erro
            console.log(`[SKIP] ${mes}/2026 já faturado (resultado) — pulando.`);
            resultado.detalhes.ja_faturados.push(mes);
            mesConcluido = true;
            break;
          } else if (resultadoMes.type === 'desconhecido') {
            // Resultado não reconhecido: NÃO re-tenta (evita carnê duplicado).
            // Registra pra revisão manual com o texto exato.
            console.log(`[REVISAR] ${mes}/2026 — resultado desconhecido: "${resultadoMes.text}"`);
            resultado.detalhes.erros.push(`${mes} REVISAR (resultado desconhecido): ${resultadoMes.text}`);
            mesConcluido = true; // não re-processa pra não duplicar
            break;
          } else {
            throw new Error(`RouterBox Negou: ${resultadoMes.text}`);
          }

        } catch (err) {
          console.log(`[RETRY] ${mes}/2026 tentativa ${tentativa} falhou: ${err.message}`);
          await page.screenshot({ path: `erro_mes_${mes}_t${tentativa}.png` }).catch(() => {});
          if (err.message.includes('RouterBox Negou:')) {
            resultado.detalhes.erros.push(`${mes} falhou: ${err.message.replace('RouterBox Negou:', '').trim()}`);
            break; // Erro definitivo do Routerbox, não tenta de novo
          }
          await page.waitForTimeout(5000);
          tentativa++;
        }
      }

      if (!mesConcluido) {
        resultado.detalhes.erros.push(`${mes} — falhou após ${MAX_TENTATIVAS_POR_MES} tentativas`);
      }
    }

    const nGer = resultado.detalhes.meses_gerados.length;
    const nJa = resultado.detalhes.ja_faturados.length;
    // Sucesso = gerou algo OU todos os meses já estavam faturados (nada falhou)
    resultado.sucesso = nGer > 0 || (nJa > 0 && resultado.detalhes.erros.length === 0);
    const partes = [];
    if (nGer > 0) partes.push(`${nGer} gerado(s): ${resultado.detalhes.meses_gerados.join(', ')}`);
    if (nJa > 0) partes.push(`${nJa} já faturado(s): ${resultado.detalhes.ja_faturados.join(', ')}`);
    if (resultado.detalhes.erros.length > 0) partes.push(`erros: ${resultado.detalhes.erros.join('; ')}`);
    resultado.mensagem = `Cliente ${codigoCliente} — ` + (partes.length ? partes.join(' | ') : 'nada processado') + '.';
    console.log(`[DONE] ${resultado.mensagem}`);

  } catch (err) {
    console.error('[FATAL]', err);
    resultado.sucesso = false;
    resultado.mensagem = `Falha ao gerar carnê para ${codigoCliente}`;
    resultado.erro = err.message;
  } finally {
    // Finaliza o vídeo (se gravando) ANTES de fechar o browser, e processa (1.5x + mp4)
    try {
      const vid = page.video && page.video();
      if (vid) {
        await context.close();              // flush do .webm
        const raw = await vid.path();
        // Renomeia pra algo legível: carne_<cliente>_<timestamp>.webm
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const destino = path.join(path.dirname(raw), `carne_${codigoCliente}_${ts}.webm`);
        let videoFinal = raw;
        try { fs.renameSync(raw, destino); videoFinal = destino; } catch {}
        // Acelera 1.5x (e converte pra mp4 se houver ffmpeg completo)
        const speed = parseFloat(process.env.RB_VIDEO_SPEED || '1.5');
        resultado.video = await processarVideo(videoFinal, speed);
        console.log(`[VIDEO] Final: ${resultado.video}`);
      }
    } catch (e) {
      console.log(`[VIDEO] Falha ao salvar vídeo: ${e.message}`);
    }
    await browser.close();
  }

  return resultado;
}
