import { loginToRouterbox } from '../lib/rbx_auth.js';

export async function faturarCliente(codigoCliente, meses) {
  const { browser, context, page } = await loginToRouterbox({ headless: true });
  const TIMEOUT_EXECUCAO = 600000; // 10 minutos
  page.setDefaultTimeout(TIMEOUT_EXECUCAO);
  const POLL_INTERVAL = 1000;
  const MAX_TENTATIVAS_POR_MES = 2;
  const resultado = {
    sucesso: false,
    mensagem: '',
    detalhes: {
      meses_gerados: [],
      erros: []
    }
  };

  // === Helpers baseados em TEXTO (mais robustos que classe) ===
  async function findByTextInAnyFrame(text, exact = false) {
    const allFrames = [page, ...page.frames()];
    for (const f of allFrames) {
      try {
        const loc = f.locator(exact ? `text="${text}"` : `text=${text}`);
        const count = await loc.count();
        if (count > 0) {
          const first = loc.first();
          if (await first.isVisible().catch(() => false)) {
            return first;
          }
        }
      } catch {}
    }
    return null;
  }

  async function findOkButtonInAnyFrame() {
    const allFrames = [page, ...page.frames()];
    for (const f of allFrames) {
      try {
        // Tenta diferentes textos do botão Ok
        for (const text of ['OK', 'Ok', 'Confirmar', 'Sim']) {
          const loc = f.locator(`button:has-text("${text}"), a:has-text("${text}")`).first();
          if (await loc.count() && await loc.isVisible().catch(() => false)) {
            return loc;
          }
        }
      } catch {}
    }
    return null;
  }

  async function pollFor(predicate, label, timeoutMs = TIMEOUT_EXECUCAO) {
    const start = Date.now();
    let iter = 0;
    while (Date.now() - start < timeoutMs) {
      iter++;
      const result = await predicate(iter);
      if (result) {
        console.log(`[POLL] ${label} achou após ${iter} iterações (${Math.round((Date.now() - start) / 1000)}s)`);
        return result;
      }
      if (iter % 30 === 0) {
        console.log(`[POLL] ${label}: ${iter} iterações, ${Math.round((Date.now() - start) / 1000)}s...`);
      }
      await page.waitForTimeout(POLL_INTERVAL);
    }
    console.log(`[POLL] ${label} TIMEOUT após ${iter} iterações (${Math.round(timeoutMs / 1000)}s)`);
    return null;
  }

  try {
    // 1. Acessar menu de Clientes
    console.log('[NAV] Acessando menu Clientes...');
    await page.goto('https://routerbox.zazzinternet.com/routerbox/app_menu/app_menu.php', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2. Dismiss modal de Novidades
    try {
      const closeX = page.locator('text=/^x$/').first();
      if (await closeX.count()) await closeX.click({ timeout: 2000 });
    } catch {}
    try { await page.keyboard.press('Escape'); } catch {}
    await page.waitForTimeout(1000);

    // 3. Abrir Clientes > Cadastro
    console.log('[NAV] Abrindo Clientes > Cadastro...');
    await page.evaluate(() => {
      if (typeof openMenuItem === 'function') openMenuItem('app_menu_item_13');
    });
    await page.waitForTimeout(3000);

    // 4. Achar iframe do cadastro
    const iframeHandle = await page.locator('iframe#iframe_app_menu, iframe[name="app_menu_iframe"]').first();
    if (!(await iframeHandle.count())) {
      throw new Error('Iframe app_menu_iframe não encontrado');
    }
    let frame = await iframeHandle.contentFrame();
    if (!frame) throw new Error('contentFrame do app_menu_iframe indisponível');
    await page.waitForTimeout(2000);

    // 5. Buscar cliente
    const searchInput = frame.locator('input[placeholder*="Busca"], input[placeholder*="Buscar"], input.form-control.input-sm').first();
    await searchInput.fill(String(codigoCliente));
    await searchInput.press('Enter');
    await page.waitForTimeout(4000);

    // 6. Clicar em Editar (lápis)
    const btnEditar = frame.locator('a[title*="Editar"], a i.fa-pencil, a i.fa-edit').first();
    if (!(await btnEditar.count())) {
      throw new Error(`Cliente ${codigoCliente} não encontrado ou sem botão de editar.`);
    }
    console.log(`[FOUND] Cliente ${codigoCliente} encontrado. Abrindo edição...`);
    await btnEditar.click();
    await page.waitForTimeout(3000);

    // 7. Refresh frame
    const frame2 = await iframeHandle.contentFrame();
    if (!frame2) throw new Error('contentFrame refresh falhou');
    await page.waitForTimeout(3000);

    // 8. Abrir modal de faturamento via JS
    console.log('[MODAL] Abrindo modal de faturamento via JS...');
    const faturarUrl = `/routerbox/app_faturamento/app_faturamento.php?script_case_init=1&nmgp_url_saida=modal&nmgp_parms=vcodcli*scin${codigoCliente}*scout&nmgp_outra_jan=true&TB_iframe=true`;
    await frame2.locator('body').evaluate((body, url) => {
      const link = body.querySelector('a[onclick*="app_faturamento.php"]');
      if (link) link.click();
    }, faturarUrl);
    await page.waitForTimeout(3000);

    // 9. Achar o frame de Faturamento
    let frameFaturamento = null;
    const modalIframe1 = page.locator('iframe[src*="app_faturamento"], iframe#TB_iframeContent').first();
    if (await modalIframe1.count()) {
      frameFaturamento = await modalIframe1.contentFrame();
    } else {
      const modalIframe2 = frame2.locator('iframe[src*="app_faturamento"], iframe#TB_iframeContent').first();
      if (await modalIframe2.count()) {
        frameFaturamento = await modalIframe2.contentFrame();
      }
    }
    if (!frameFaturamento) {
      throw new Error('Frame de Faturamento não encontrado');
    }
    console.log(`[FREADY] Frame de Faturamento carregado.`);

    // 10. Loop pelos meses
    for (let i = 0; i < meses.length; i++) {
      const mes = meses[i];
      let tentativa = 1;
      let mesConcluido = false;

      while (tentativa <= MAX_TENTATIVAS_POR_MES) {
        console.log(`[MES] Processando ${mes}/2026 (${i+1}/${meses.length}) — tentativa ${tentativa}...`);

        try {
          // Selecionar Mês + esperar AJAX do Histórico
          await frameFaturamento.locator('select[name="mes"]').selectOption({ label: mes });
          await page.waitForTimeout(4000);

          // Outros campos
          await frameFaturamento.locator('select[name="ano"]').selectOption({ label: '2026' });
          await frameFaturamento.locator('select[name="composicao"]').selectOption({ label: 'Contratos e Atendimentos' });
          await frameFaturamento.locator('select[name="conta"]').selectOption({ label: '100-Contas a Receber - OFICIAL' });
          await frameFaturamento.locator('select[name="historico"]').selectOption({ label: 'Contas a Receber - LDL' });
          await frameFaturamento.locator('select[name="dia"]').selectOption({ label: '10' });
          await frameFaturamento.locator('select[name="enviarfaturamentoemail"]').selectOption({ label: 'Sim' });
          await frameFaturamento.locator('select[name="emailgateway"]').selectOption({ label: 'FATURAMENTO LDL' });

          // Clicar Executar
          console.log(`[MES] ${mes}/2026: Clicando em Executar...`);
          const btnGerar = frameFaturamento.locator('a#sc_Executar_bot').first();
          await btnGerar.click();
          await page.waitForTimeout(1500);

          // === FASE 1: POLLING por popup de confirmação (texto "Confirma a execução") ===
          console.log(`[POLL] ${mes}/2026: Aguardando popup de confirmação...`);
          const confirmou = await pollFor(async () => {
            const loc = await findByTextInAnyFrame('Confirma a execução', false);
            return loc !== null;
          }, `confirmacao-${mes}`, TIMEOUT_EXECUCAO);

          if (!confirmou) {
            // Talvez já veio direto o resultado sem popup de confirmação
            console.log(`[POLL] Sem popup de confirmação. Procurando resultado direto...`);
          } else {
            // Clica Ok
            const okBtn = await findOkButtonInAnyFrame();
            if (okBtn) {
              console.log(`[CONFIRMADO] ${mes}/2026: confirmação OK, esperando resultado...`);
              await okBtn.click({ force: true }).catch(() => {});
            } else {
              console.log(`[WARN] Confirmação apareceu mas botão Ok não encontrado.`);
            }
            await page.waitForTimeout(5000); // Dar tempo do Routerbox processar
          }

          // === FASE 2: POLLING por popup de resultado (texto "gerado", "sucesso", "0 documentos") ===
          console.log(`[POLL] ${mes}/2026: Aguardando popup de resultado...`);
          const resultadoMes = await pollFor(async () => {
            // Verifica se apareceu popup de erro genérico
            for (const errText of ['RouterBox Negou', 'Já existe faturamento', '0 documentos', 'Erro']) {
              const errLoc = await findByTextInAnyFrame(errText, false);
              if (errLoc) {
                const fullText = await errLoc.innerText().catch(() => '');
                return { type: 'erro', text: fullText.trim() || errText };
              }
            }
            // Verifica se apareceu popup de sucesso
            for (const succText of ['gerado com sucesso', 'Incluídos', 'processado com sucesso']) {
              const succLoc = await findByTextInAnyFrame(succText, false);
              if (succLoc) {
                return { type: 'sucesso', text: succText };
              }
            }
            return null;
          }, `resultado-${mes}`, TIMEOUT_EXECUCAO);

          await page.screenshot({ path: `erro_mes_${mes}_t${tentativa}_resultado.png` }).catch(() => {});

          if (!resultadoMes) {
            throw new Error(`RouterBox Negou: Timeout (${TIMEOUT_EXECUCAO/1000}s) esperando resultado.`);
          }

          if (resultadoMes.type === 'sucesso') {
            console.log(`[OK] ${mes}/2026 — sucesso detectado (${resultadoMes.text}).`);
            resultado.detalhes.meses_gerados.push(mes);
            mesConcluido = true;
            break;
          } else {
            throw new Error(`RouterBox Negou: ${resultadoMes.text}`);
          }
        } catch (error) {
          console.log(`[RETRY] ${mes}/2026 — tentativa ${tentativa} falhou: ${error.message}`);
          await page.screenshot({ path: `erro_mes_${mes}_t${tentativa}.png` }).catch(() => {});
          if (error.message.includes('RouterBox Negou:')) {
            resultado.detalhes.erros.push(`${mes} falhou: ${error.message.replace('RouterBox Negou:', '').trim()}`);
            break;
          }
          await page.waitForTimeout(5000);
          tentativa++;
        }
      }

      if (!mesConcluido) {
        console.log(`[ERRO] Mês ${mes} — falhou após ${MAX_TENTATIVAS_POR_MES} tentativas`);
        resultado.detalhes.erros.push(`${mes} — falhou após ${MAX_TENTATIVAS_POR_MES} tentativas`);
      }
    }

    resultado.sucesso = resultado.detalhes.meses_gerados.length > 0;
    if (resultado.sucesso) {
      resultado.mensagem = `Sucesso parcial/total: ${resultado.detalhes.meses_gerados.length} meses gerados para cliente ${codigoCliente}.`;
    } else {
      resultado.mensagem = `Falha total: Nenhum mês foi gerado para cliente ${codigoCliente}.`;
    }
    if (resultado.detalhes.erros.length > 0) {
      resultado.mensagem += ` Detalhe dos erros: ` + resultado.detalhes.erros.join('; ');
    }
    console.log(`[DONE] ${resultado.mensagem}`);
  } catch (error) {
    console.error('[FATAL ERROR]', error);
    resultado.sucesso = false;
    resultado.mensagem = `Falha ao gerar carnê para cliente ${codigoCliente}`;
    resultado.erro = error.message;
  } finally {
    await browser.close();
  }

  return resultado;
}
