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

  // Defensivo: RBX/ScriptCase pode disparar dialog NATIVO (confirm/alert/beforeunload) que
  // BLOQUEIA a thread do renderer. Sem handler o Playwright auto-descarta, mas registramos
  // e aceitamos pra não pendurar caminhos que esperam o "Ok".
  page.on('dialog', async (d) => {
    console.log(`[DIALOG] ${d.type()}: ${(d.message() || '').slice(0, 140)}`);
    try { await d.accept(); } catch {}
  });

  // Timeouts calibrados: curtos para UI, longos para Routerbox lento
  const TIMEOUT_NAV  = 30000;    // 30s — navegação de página
  const TIMEOUT_UI   = 60000;    // 60s — elemento aparecer na tela
  const TIMEOUT_AJAX = 120000;   // 2min — AJAX / carregamento de opções
  // FAIL-FAST: espera de confirmação/resultado por mês. Antes era 30min, o que fazia
  // um mês preso (sessão chutada) gerar órfão de horas. 3min: falha rápido.
  const TIMEOUT_MES  = parseInt(process.env.RB_TIMEOUT_MES || '180000', 10); // 3min
  const TIMEOUT_EXEC = TIMEOUT_MES; // compat
  // Popup de confirmação aparece em segundos após Executar; 45s é folga. Curto de propósito
  // pra não inflar o tempo por mês (pior caso/mês cai p/ ~210s; lote de 6 cabe no teto da fila).
  const TIMEOUT_CONFIRM = parseInt(process.env.RB_TIMEOUT_CONFIRM || '45000', 10);
  const MAX_TENTATIVAS_POR_MES = 2;

  page.setDefaultTimeout(TIMEOUT_AJAX);

  const resultado = {
    sucesso: false,
    mensagem: '',
    detalhes: { meses_gerados: [], ja_faturados: [], erros: [] },
  };

  // Declarado no escopo da função pra que os helpers (selectCampo etc.) o enxerguem
  let frameFaturamento = null;

  // Polling adaptativo: executa predicate a cada 1s até retornar truthy ou timeout.
  // CADA chamada do predicate corre num Promise.race contra um timer (PRED_TICK_MAX). Sem
  // isso, uma op do Playwright que trava num renderer MORTO (ex.: locator.evaluate via CDP,
  // que NÃO respeita setDefaultTimeout) pendurava o `await` pra sempre — o deadline do
  // waitUntil nunca era re-checado e o mês ficava preso até o killer externo de 25min.
  // Com o race, o tick vence, o loop volta a checar o relógio e o wedge falha em <= timeoutMs.
  const PRED_TICK_MAX = 12000;
  const TICK = Symbol('tick');
  async function waitUntil(predicate, label, timeoutMs = TIMEOUT_EXEC) {
    const start = Date.now();
    let iter = 0;
    while (Date.now() - start < timeoutMs) {
      iter++;
      const remaining = timeoutMs - (Date.now() - start);
      const result = await Promise.race([
        Promise.resolve().then(() => predicate(iter)).catch(() => null),
        new Promise(res => setTimeout(() => res(TICK), Math.min(remaining, PRED_TICK_MAX))),
      ]).catch(() => null);
      if (result && result !== TICK) {
        console.log(`[WAIT] ${label} OK em ${Math.round((Date.now() - start) / 1000)}s`);
        return result;
      }
      if (iter % 30 === 0) {
        console.log(`[WAIT] ${label}: aguardando... ${Math.round((Date.now() - start) / 1000)}s`);
      }
      await page.waitForTimeout(1000).catch(() => {});
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

  // Detecta que a SESSÃO CAIU (Routerbox voltou pra tela de login). Causa nº1 do travamento:
  // a conta é compartilhada — outro login derruba a sessão do bot e a SPA congela. Lê só URLs
  // (sync/cacheado), nunca trava mesmo com o renderer morto.
  function sessaoCaiu() {
    try {
      for (const f of [page, ...page.frames()]) {
        const u = (typeof f.url === 'function' ? f.url() : '') || '';
        if (/app_login/i.test(u)) return true;
      }
    } catch {}
    return false;
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

    // 4. PROBLEMA do ScriptCase: todos os links da grade referenciam a "linha 1", então
    // clicar (programaticamente) em qualquer linha fatura o 1º RESULTADO. Se a busca por
    // código retorna VÁRIOS clientes, fatura o errado. Solução: re-buscar pelo CPF (único)
    // pra isolar o cliente certo como ÚNICO resultado (= linha 1).
    console.log(`[SEARCH] Buscando cliente ${codigoCliente}...`);
    const codigoNum = String(codigoCliente).replace(/\D/g, ''); // "51.875" -> "51875"
    const fatLinkSel = 'a[href*="app_faturamento.php"], a[onclick*="app_faturamento"]';
    const cpfRe = /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/; // CPF ou CNPJ

    const codFmt = codigoNum.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // 51875 -> 51.875
    const codRe = new RegExp(`(^|\\s)(${codigoNum}|${codFmt.replace(/\./g, '\\.')})(\\s|$)`);

    async function buscar(termo) {
      const inp = frame.locator(searchSel).first();
      await inp.fill(String(termo));
      await inp.press('Enter');
      await page.waitForTimeout(2500);
    }
    // Itera os LINKS de faturamento (1 por resultado) e pega o texto da linha de cada um
    // via closest('tr') — rápido e preciso. Devolve { link, cpf } da linha do código exato.
    async function acharLinha() {
      const links = frame.locator(fatLinkSel);
      const nL = await links.count();
      for (let i = 0; i < Math.min(nL, 25); i++) {
        const link = links.nth(i);
        // timeout explícito: locator.evaluate via CDP NÃO herda setDefaultTimeout; num
        // renderer travado pendurava pra sempre. 8s aborta e o waitUntil segue.
        const rowTxt = (await link.evaluate(a => { const tr = a.closest('tr'); return tr ? tr.innerText : ''; }, undefined, { timeout: 8000 }).catch(() => '')).replace(/\s+/g, ' ');
        if (codRe.test(rowTxt)) {
          const mc = rowTxt.match(cpfRe);
          return { link, cpf: mc ? mc[0] : '', idx: i };
        }
      }
      return null;
    }

    let achado = await waitUntil(() => acharLinha(), `linha-${codigoCliente}`, 30000);
    if (!achado) {
      if (sessaoCaiu()) throw new Error(`Sessão do Routerbox caiu na conta '${process.env.RB_USER}' (provável conflito — conta compartilhada). Use uma conta DEDICADA do bot.`);
      throw new Error(`Cliente ${codigoCliente} não encontrado nos resultados — abortado.`);
    }

    // SEMPRE re-busca pelo CPF (único) pra garantir o cliente certo como ÚNICO resultado.
    // O ScriptCase fatura o 1º resultado, então isolar pelo CPF evita faturar o errado.
    if (achado.cpf) {
      console.log(`[SEARCH] Isolando o cliente pelo CPF/CNPJ ${achado.cpf}...`);
      await buscar(achado.cpf.replace(/\D/g, ''));
      achado = await waitUntil(() => acharLinha(), `linha-cpf-${codigoCliente}`, 30000);
      if (!achado) throw new Error(`Cliente ${codigoCliente} não encontrado após re-busca por CPF — abortado.`);
    } else {
      console.log(`[SEARCH] Sem CPF na linha — seguindo (a verificação de segurança protege).`);
    }

    // #7: se o código pedido NÃO é a linha 1 (idx>0), a grade do ScriptCase faturaria a
    // LINHA 1 (cadastro errado — caso de CPF compartilhado por 2+ cadastros). Aí abrimos o
    // faturamento por URL DIRETA com o código. O [VERIFY] adiante garante segurança (aborta
    // se vier o cliente errado), então nunca fatura errado mesmo se a URL falhar.
    let abriuPorUrl = false;
    if (achado.idx > 0) {
      console.log(`[DUAL] ${codigoCliente} não é a linha 1 (idx ${achado.idx}) — CPF compartilhado. Abrindo por URL direta...`);
      const urlFat = `https://routerbox.zazzinternet.com/routerbox/app_faturamento/app_faturamento.php?script_case_init=1&nmgp_url_saida=modal&nmgp_parms=vcodcli*scin${codigoNum}*scout&nmgp_outra_jan=true&TB_iframe=true`;
      try {
        await page.goto(urlFat, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_NAV });
        abriuPorUrl = true;
      } catch (e) {
        console.log(`[DUAL] Falha na URL direta: ${e.message}`);
      }
    }
    if (!abriuPorUrl) {
      console.log(`[FOUND] Cliente ${codigoCliente} isolado. Abrindo faturamento.`);
      await achado.link.click();
    }

    // 5. Aguarda o FORMULÁRIO de faturamento aparecer em qualquer frame (flexível —
    // o link pode navegar no próprio iframe OU abrir um modal).
    console.log('[MODAL] Aguardando formulário de faturamento...');
    await waitUntil(async () => {
      for (const f of page.frames()) {
        const mesSel = f.locator('select[name="mes"]');
        if (await mesSel.count().catch(() => 0) && await mesSel.first().isVisible().catch(() => false)) {
          frameFaturamento = f;
          return true;
        }
      }
      return null;
    }, 'form-faturamento', TIMEOUT_AJAX);

    if (!frameFaturamento) {
      if (sessaoCaiu()) throw new Error(`Sessão do Routerbox caiu na conta '${process.env.RB_USER}' antes do modal (provável conflito — conta compartilhada). Use uma conta DEDICADA do bot.`);
      if (abriuPorUrl) throw new Error(`Cliente ${codigoCliente} compartilha CPF com outro cadastro e o Routerbox fatura a linha 1; a abertura por URL direta não trouxe o formulário — faturar este cadastro MANUALMENTE.`);
      throw new Error('Formulário de faturamento não apareceu após clicar o link.');
    }
    console.log('[MODAL] Formulário de faturamento aberto.');

    // Aguarda formulário estar pronto (select de Mês visível)
    await frameFaturamento.locator('select[name="mes"]').waitFor({ state: 'visible', timeout: TIMEOUT_AJAX });
    console.log('[FREADY] Formulário de faturamento pronto.');

    // VERIFICAÇÃO DE SEGURANÇA (rede final): o modal aberto é mesmo do cliente certo?
    // O form mostra "Cliente 13.543 Nome...". Confere o código antes de qualquer Executar.
    try {
      const formText = await frameFaturamento.locator('body').innerText().catch(() => '');
      const m = formText.match(/Cliente\s*([\d.\s]+)/i);
      const formCod = m ? m[1].replace(/\D/g, '') : '';
      if (formCod && formCod !== codigoNum) {
        throw new Error(`SEGURANÇA: modal aberto é do cliente ${formCod}, mas pedido era ${codigoNum}. Abortado para NÃO faturar o cliente errado.`);
      }
      console.log(`[VERIFY] Modal confirmado do cliente ${codigoNum}.`);
    } catch (e) {
      if (String(e.message).includes('SEGURANÇA')) throw e;
      // se não conseguiu ler o texto, segue (não bloqueia por falha de leitura)
    }

    // Modo dry-run: para AQUI (cliente verificado) sem faturar nada. RB_DRY_RUN=true
    if (process.env.RB_DRY_RUN === 'true') {
      console.log(`[DRY-RUN] Cliente ${codigoNum} aberto e verificado. NÃO vou faturar (dry-run).`);
      resultado.sucesso = true;
      resultado.mensagem = `DRY-RUN ok: modal do cliente ${codigoNum} aberto corretamente (sem faturar).`;
      resultado.dry_run = true;
      return resultado;
    }

    // 7. Loop pelos meses
    for (let i = 0; i < meses.length; i++) {
      const mes = meses[i];
      let tentativa = 1;
      let mesConcluido = false;

      while (tentativa <= MAX_TENTATIVAS_POR_MES) {
        console.log(`[MES] ${mes}/2026 (${i + 1}/${meses.length}) — tentativa ${tentativa}...`);
        let executou = false; // vira true ao clicar Executar — pós-Executar NÃO re-tenta (anti-duplicado)

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
          executou = true; // daqui pra frente, um timeout é INCERTO — re-clicar duplicaria o boleto

          // FASE 1: Popup de confirmação "Confirma execução da rotina de faturamento?"
          console.log(`[POLL] ${mes}/2026: Aguardando popup de confirmação...`);
          const confirmou = await waitUntil(
            () => findTextInAnyFrame('rotina de faturamento'),
            `confirmacao-${mes}`,
            TIMEOUT_CONFIRM
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
            // SUCESSO: formulário resetou (campo Mês voltou ao placeholder "Escolha Mês").
            // Exige o sinal POSITIVO do placeholder — leitura vazia (.catch '') NÃO conta como
            // sucesso (era falso-sucesso: marcava gerado sem faturar). Vazio → segue polando.
            const mesTxt = await mesSel.locator('option:checked').first().innerText().catch(() => '');
            if (/escolha|selecione/i.test(mesTxt))
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
          } else {
            throw new Error(`RouterBox Negou: ${resultadoMes.text}`);
          }

        } catch (err) {
          console.log(`[ERRO] ${mes}/2026 tentativa ${tentativa} falhou: ${err.message}`);
          await page.screenshot({ path: `erro_mes_${mes}_t${tentativa}.png` }).catch(() => {});
          if (err.message.includes('RouterBox Negou:')) {
            // Erro definitivo do Routerbox (ex.: "0 documentos") — NÃO faturou, não re-tenta.
            resultado.detalhes.erros.push(`${mes} falhou: ${err.message.replace('RouterBox Negou:', '').trim()}`);
            mesConcluido = true;
            break;
          }
          if (executou) {
            // Falha/timeout DEPOIS de clicar Executar: pode ter faturado ou não. NUNCA re-clica
            // (duplicaria o boleto). Settle + re-checa "já existe"; senão marca REVISAR p/ manual.
            console.log(`[INCERTO] ${mes}/2026 — falha pós-Executar; checando se faturou...`);
            await page.waitForTimeout(8000);
            if (await jaExisteFaturamento().catch(() => false)) {
              console.log(`[OK] ${mes}/2026 — confirmado faturado após o timeout.`);
              resultado.detalhes.ja_faturados.push(mes);
            } else {
              resultado.detalhes.erros.push(`${mes} REVISAR: timeout pós-Executar — verificar manualmente se faturou (NÃO re-faturado p/ não duplicar)`);
            }
            mesConcluido = true;
            break;
          }
          // Falhou ANTES do Executar (preenchimento do form) — re-tentar é seguro.
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
