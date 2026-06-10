import { loginToRouterbox } from '../lib/rbx_auth.js';

export async function faturarCliente(clienteIdOuNome, meses) {
  const { browser, context, page } = await loginToRouterbox({ headless: true });
  const TIMEOUT_EXECUCAO = 180000; // 3 minutos
  const MAX_TENTATIVAS_POR_MES = 2; // Mavis 10/06 08:50: reduzido de 3 → 2 pra caber no timeout N8N de 300s (60s × 2 tentativas × 2 meses = 240s)

  const resultado = {
    sucesso: false,
    mensagem: '',
    detalhes: {
      meses_gerados: [],
      erros: []
    }
  };

  const match = clienteIdOuNome.match(/^(\d+)[-\s]*(.*)/);
  const codigoCliente = match ? match[1] : clienteIdOuNome;
  const nomeCliente = match && match[2] ? match[2].trim() : clienteIdOuNome;
  
  const searchTerm = nomeCliente || codigoCliente;

  
  let alertaAceito = false;
  let dialogMessage = "";
  page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      console.log(`[DIALOG] Popup Nativo: ${dialogMessage}`);
      try {
         await dialog.accept();
         alertaAceito = true;
      } catch(e) {}
  });

  try {
    console.log(`[START] Iniciando geração de carnê para cliente: ${codigoCliente} - ${nomeCliente}`);
    console.log(`[NAV] Navegando para Cadastro de Clientes...`);

    // Abrir o menu se não estiver aberto e navegar
    await page.evaluate(() => {
      if (typeof window.openMenuItem === 'function') {
        // ID do menu Clientes -> Cadastro (Pode variar no RBX, vamos forçar navegação direta para garantir ou tentar clique)
        window.openMenuItem('app_menu_item_24'); // Exemplo, mas o seguro é clicar.
      }
    });

    // Vamos forçar a URL direta do Cadastro de Clientes para ser seguro no RBX se possível, 
    // mas o PROMPT pede clique nos menus.
    // Tentaremos ir para a URL de clientes ou iframe.
    const rbUrl = 'https://routerbox.zazzinternet.com/routerbox/app_menu/app_menu.php';
    if (!page.url().includes('app_menu.php')) {
        await page.goto(rbUrl, { waitUntil: 'networkidle', timeout: 30000 });
    }

    // Fechar modal de novidades se houver
    try {
      const closeX = page.locator('text=/^x$/').first();
      if (await closeX.count()) await closeX.click({ timeout: 2000 });
      await page.keyboard.press('Escape');
    } catch {}

    // Clicar no menu Hamburguer e depois em Empresa > Clientes > Cadastro
    const navBar = page.locator('.navbar-minimalize');
    if (await navBar.count()) {
      const isClosed = await page.evaluate(() => document.body.classList.contains('mini-navbar'));
      if (isClosed) await navBar.click();
    }
    
    console.log('[NAV] Navegando para Cadastro de Clientes...');
    await page.evaluate(() => {
      if (typeof openMenuItem === 'function') openMenuItem('app_menu_item_13');
    });
    await page.waitForTimeout(3000);

    const iframeHandle = await page.locator('iframe#iframe_app_menu, iframe[name="app_menu_iframe"]').first();
    const frame = await iframeHandle.contentFrame();

    // Tentar fechar modal de "Novidades" se existir
    console.log('[NAV] Fechando possíveis modais...');
    try {
      await page.keyboard.press('Escape');
      await frame.locator('button:has-text("X"), .close').first().click({ timeout: 2000 });
    } catch(e) {}
    await page.waitForTimeout(1000);

    console.log(`[SEARCH] Buscando cliente ${searchTerm}...`);
    // Buscar pelo termo (nome ou código)
    const searchInput = frame.locator('input[placeholder*="Busca"], input[placeholder*="Buscar"], input.form-control.input-sm').first();
    await searchInput.fill(searchTerm.toString());
    await searchInput.press('Enter');
    
    // Aguardar tabela carregar
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'after_search.png' });
    
    // Aguardar tabela carregar
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'after_search.png' });

    // Clicar em Editar o Registro (lápis) no TR exato do cliente
    await page.screenshot({ path: 'before_error.png' });
    // Tenta pegar o primeiro botão de edição da primeira linha da tabela (ignora formatação de ponto no código)
    const btnEditar = frame.locator(`a[title*="Editar"], a i.fa-pencil, a i.fa-edit, a i.fa-pencil-square-o, img[src*="edit"]`).first();
    if (!(await btnEditar.count())) {
      throw new Error(`Cliente ${codigoCliente} encontrado, mas sem botão de editar.`);
    }
    console.log(`[FOUND] Cliente exato encontrado. Abrindo edição...`);
    await btnEditar.click();
    await page.waitForTimeout(3000);
    
    // Refresh frame object in case of navigation
    const frame2 = await iframeHandle.contentFrame();
    await page.screenshot({ path: 'after_edit.png' });

    console.log(`[MODAL] Aguardando carregamento da edição...`);
    await page.waitForTimeout(3000);
    
    console.log(`[MODAL] Abrindo modal de faturamento via Javascript...`);
    const faturarUrl = `/routerbox/app_faturamento/app_faturamento.php?script_case_init=1&nmgp_url_saida=modal&nmgp_parms=vcodcli*scin${codigoCliente}*scout&nmgp_outra_jan=true&TB_iframe=true`;
    
    await frame2.locator('body').evaluate((body, url) => {
        // Tenta achar e clicar no link real primeiro para simular usuario
        const link = body.querySelector('a[onclick*="app_faturamento.php"]');
        if (link) {
            link.click();
        } else if (typeof window.clientsMenu !== 'undefined' && window.clientsMenu.openModal) {
            window.clientsMenu.openModal(url);
        } else if (typeof clientsMenu !== 'undefined' && clientsMenu.openModal) {
            clientsMenu.openModal(url);
        } else {
            console.error('clientsMenu.openModal não encontrado, fallback click');
        }
    }, faturarUrl);
    
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'after_open_modal.png' });
    
    // O modal geralmente é um div no body principal com um iframe dentro (ThickBox)
    const modalIframe = page.locator('iframe[src*="app_faturamento"], iframe#TB_iframeContent').first();
    let frameFaturamento = null;
    try {
      await modalIframe.waitFor({ state: 'visible', timeout: 5000 });
      frameFaturamento = await modalIframe.contentFrame();
    } catch (e) {
      console.log('Não achou TB_iframeContent na page principal, tentando dentro do frame2...');
      const modalIframe2 = frame2.locator('iframe[src*="app_faturamento"], iframe#TB_iframeContent').first();
      await modalIframe2.waitFor({ state: 'visible', timeout: 5000 });
      frameFaturamento = await modalIframe2.contentFrame();
    }

    if (!frameFaturamento) {
        throw new Error('Não foi possível localizar o frame de Faturamento.');
    }
    
    for (let i = 0; i < meses.length; i++) {
      const mes = meses[i];
      let tentativa = 1;
      let mesConcluido = false;

      while (tentativa <= MAX_TENTATIVAS_POR_MES) {
        try {
          alertaAceito = false;
          dialogMessage = "";
          console.log(`[MES] Processando ${mes}/2026 (${i+1}/${meses.length}) — tentativa ${tentativa}...`);
          
          // Selecionar Mês
          await frameFaturamento.locator('select[name="mes"]').selectOption({ label: mes });
          
          // Selecionar Ano: 2026
          await frameFaturamento.locator('select[name="ano"]').selectOption({ label: '2026' });

          // Selecionar Faturar: Contratos e Atendimentos
          await frameFaturamento.locator('select[name="composicao"]').selectOption({ label: 'Contratos e Atendimentos' });

          // Contratos: Não vamos desmarcar os contratos para evitar fatura de R$ 0,00!
          // Deixamos os checkboxes como vieram por padrão.

          // Selecionar Conta a Receber
          await frameFaturamento.locator('select[name="conta"]').selectOption({ label: '100-Contas a Receber - OFICIAL' });

          // Selecionar Histórico
          await frameFaturamento.locator('select[name="historico"]').selectOption({ label: 'Contas a Receber - LDL' });

          // Dia de Vencimento
          await frameFaturamento.locator('select[name="dia"]').selectOption({ label: '10' });

          // Enviar por e-mail
          await frameFaturamento.locator('select[name="enviarfaturamentoemail"]').selectOption({ label: 'Sim' });

          // Gateway de e-mail
          await frameFaturamento.locator('select[name="emailgateway"]').selectOption({ label: 'FATURAMENTO LDL' });

          // Clicar em "Executar"
          console.log(`[MES] ${mes}/2026: Clicando em Executar...`);
          const btnGerar = frameFaturamento.locator('a#sc_Executar_bot').first();
          await btnGerar.click();
          
          // Lidar com o alerta de confirmação e com a página carregada
          
          
          await page.waitForTimeout(1000);

          // === ESPERA ATIVA: Promise.race ===
          console.log(`[MES] Aguardando conclusão do faturamento de ${mes}...`);

          const SUCESSO_SEL = '.alert-success, .scFormMessageSuccess, .swal2-icon--success, .sweet-alert.showSweetAlert:has-text("Sucesso"), .sweet-alert.showSweetAlert:has-text("sucesso")';
          const ERRO_SEL = '.alert-danger, .scFormErrorMessage, .swal2-icon--error, .swal2-popup.swal2-icon-error, .sweet-alert.showSweetAlert:has-text("Erro")';
          const POPUP_TITULO_SEL = '.swal2-title, .sweet-alert h2';
          const POPUP_CORPO_SEL = '.swal2-html-container, .sweet-alert p';

          let resultadoMes = 'timeout';

          try {
            resultadoMes = await Promise.race([
              // 1. Caso de Sucesso
              frameFaturamento.waitForSelector(SUCESSO_SEL, { timeout: 60000, state: 'visible' }).then(() => 'sucesso'),
              page.waitForSelector(SUCESSO_SEL, { timeout: 60000, state: 'visible' }).then(() => 'sucesso'),

              // 2. Caso de Erro explícito
              frameFaturamento.waitForSelector(ERRO_SEL, { timeout: 60000, state: 'visible' }).then(async () => {
                  const titulo = await frameFaturamento.locator(ERRO_SEL).first().innerText().catch(() => '');
                  return 'erro:' + titulo.trim();
              }),
              page.waitForSelector(ERRO_SEL, { timeout: 60000, state: 'visible' }).then(async () => {
                  const titulo = await page.locator(ERRO_SEL).first().innerText().catch(() => '');
                  return 'erro:' + titulo.trim();
              }),

              // 3. Caso de SweetAlert (Confirmação ou Erro Genérico)
              frameFaturamento.waitForSelector(POPUP_TITULO_SEL, { timeout: 60000, state: 'visible' }).then(async () => {
                  const titulo = await frameFaturamento.locator(POPUP_TITULO_SEL).first().innerText().catch(() => '');
                  const corpo = await frameFaturamento.locator(POPUP_CORPO_SEL).first().innerText().catch(() => '');
                  const texto = (titulo + ' ' + corpo).replace(/\s+/g, ' ').trim();
                  
                  const btnOk = frameFaturamento.locator('.swal2-confirm, .sweet-alert button.confirm, button:has-text("Ok"), button:has-text("OK"), a:has-text("Ok"), a:has-text("OK"), #sc_b_ok_bot, #sc_b_ok_t').first();
                  if (await btnOk.count()) await btnOk.click().catch(() => {});
                  
                  if (texto.toLowerCase().includes('confirma a execuç') || texto.toLowerCase().includes('confirma a execuc')) return 'confirmacao';
                  if (texto.includes('0 documentos')) return 'erro:0 documentos gerados';
                  return 'popup_erro:' + texto;
              }),
              page.waitForSelector(POPUP_TITULO_SEL, { timeout: 60000, state: 'visible' }).then(async () => {
                  const titulo = await page.locator(POPUP_TITULO_SEL).first().innerText().catch(() => '');
                  const corpo = await page.locator(POPUP_CORPO_SEL).first().innerText().catch(() => '');
                  const texto = (titulo + ' ' + corpo).replace(/\s+/g, ' ').trim();
                  
                  const btnOk = page.locator('.swal2-confirm, .sweet-alert button.confirm, button:has-text("Ok"), button:has-text("OK"), a:has-text("Ok"), a:has-text("OK"), #sc_b_ok_bot, #sc_b_ok_t').first();
                  if (await btnOk.count()) await btnOk.click().catch(() => {});
                  
                  if (texto.toLowerCase().includes('confirma a execuç') || texto.toLowerCase().includes('confirma a execuc')) return 'confirmacao';
                  if (texto.includes('0 documentos')) return 'erro:0 documentos gerados';
                  return 'popup_erro:' + texto;
              })
            ]);
          } catch (e) {
            console.log(`[TIMEOUT] ${mes}/2026: 60s sem mensagem visível do Routerbox.`);
            resultadoMes = 'timeout';
          }

          await page.screenshot({ path: `erro_mes_${mes}_t${tentativa}.png` }).catch(() => {});

          if (resultadoMes === 'sucesso') {
            console.log(`[OK] ${mes}/2026 — concluído`);
            resultado.detalhes.meses_gerados.push(mes);
            mesConcluido = true;
            break;
          } else if (resultadoMes === 'confirmacao') {
            console.log(`[CONFIRMADO] ${mes}/2026: confirmação OK, esperando resultado real...`);
            alertaAceito = true;
            // Espera Routerbox processar e mostrar popup de resultado
            await page.waitForTimeout(10000);

            // SEGUNDO RACE: espera o popup de RESULTADO (sem re-clicar Executar)
            // BUG FIX v7 (Mavis 10/06 09:55): o v6+ reexecutava o `continue` que
            // re-clicava Executar, gerando carnês duplicados ou cancelando o anterior.
            // Agora após clicar Ok no "Confirma execução", esperamos APENAS pelo
            // popup de resultado (sucesso, erro, ou 0 documentos).
            // BUG FIX v8 (Mavis 10/06 10:20): timeout do segundo race aumentado
            // de 60s → 180s porque Routerbox tava demorando +60s pra processar
            // em horário de pico (teste real com 13543 José Antônio).
            try {
              const resultadoFinal = await Promise.race([
                frameFaturamento.waitForSelector(SUCESSO_SEL, { timeout: 180000, state: 'visible' }).then(() => 'sucesso'),
                page.waitForSelector(SUCESSO_SEL, { timeout: 180000, state: 'visible' }).then(() => 'sucesso'),
                frameFaturamento.waitForSelector(ERRO_SEL, { timeout: 180000, state: 'visible' }).then(async () => {
                  const titulo = await frameFaturamento.locator(ERRO_SEL).first().innerText().catch(() => '');
                  return 'erro:' + titulo.trim();
                }),
                page.waitForSelector(ERRO_SEL, { timeout: 180000, state: 'visible' }).then(async () => {
                  const titulo = await page.locator(ERRO_SEL).first().innerText().catch(() => '');
                  return 'erro:' + titulo.trim();
                }),
                frameFaturamento.waitForSelector(POPUP_TITULO_SEL, { timeout: 180000, state: 'visible' }).then(async () => {
                  const titulo = await frameFaturamento.locator(POPUP_TITULO_SEL).first().innerText().catch(() => '');
                  const corpo = await frameFaturamento.locator(POPUP_CORPO_SEL).first().innerText().catch(() => '');
                  const texto = (titulo + ' ' + corpo).replace(/\s+/g, ' ').trim();
                  const btnOk = frameFaturamento.locator('.swal2-confirm, .sweet-alert button.confirm, button:has-text("Ok"), button:has-text("OK"), a:has-text("Ok"), a:has-text("OK"), #sc_b_ok_bot, #sc_b_ok_t').first();
                  if (await btnOk.count()) await btnOk.click().catch(() => {});
                  if (texto.toLowerCase().includes('confirma a execuç') || texto.toLowerCase().includes('confirma a execuc')) return 'confirmacao';
                  if (texto.includes('0 documentos')) return 'erro:0 documentos gerados';
                  if (texto.toLowerCase().includes('gerado') || texto.toLowerCase().includes('sucesso')) return 'sucesso';
                  return 'popup_erro:' + texto;
                }),
                page.waitForSelector(POPUP_TITULO_SEL, { timeout: 180000, state: 'visible' }).then(async () => {
                  const titulo = await page.locator(POPUP_TITULO_SEL).first().innerText().catch(() => '');
                  const corpo = await page.locator(POPUP_CORPO_SEL).first().innerText().catch(() => '');
                  const texto = (titulo + ' ' + corpo).replace(/\s+/g, ' ').trim();
                  const btnOk = page.locator('.swal2-confirm, .sweet-alert button.confirm, button:has-text("Ok"), button:has-text("OK"), a:has-text("Ok"), a:has-text("OK"), #sc_b_ok_bot, #sc_b_ok_t').first();
                  if (await btnOk.count()) await btnOk.click().catch(() => {});
                  if (texto.toLowerCase().includes('confirma a execuç') || texto.toLowerCase().includes('confirma a execuc')) return 'confirmacao';
                  if (texto.includes('0 documentos')) return 'erro:0 documentos gerados';
                  if (texto.toLowerCase().includes('gerado') || texto.toLowerCase().includes('sucesso')) return 'sucesso';
                  return 'popup_erro:' + texto;
                })
              ]);

              await page.screenshot({ path: `erro_mes_${mes}_t${tentativa}_resultado.png` }).catch(() => {});

              if (resultadoFinal === 'sucesso') {
                console.log(`[OK] ${mes}/2026 — sucesso (após confirmação).`);
                resultado.detalhes.meses_gerados.push(mes);
                mesConcluido = true;
                break;
              } else if (resultadoFinal.startsWith('erro:') || resultadoFinal.startsWith('popup_erro:')) {
                const msg = resultadoFinal.replace(/^(erro|popup_erro):/, '').trim();
                throw new Error(`RouterBox Negou: ${msg}`);
              } else {
                // 'confirmacao' de novo (improvável) - sai e tenta do zero
                throw new Error(`RouterBox Negou: 2 confirmações seguidas (Routerbox em loop de confirmação?).`);
              }
            } catch (e) {
              if (e.message && e.message.startsWith('RouterBox Negou:')) throw e;
              throw new Error(`RouterBox Negou: Timeout esperando resultado (180s) após confirmação.`);
            }
          } else if (resultadoMes.startsWith('popup_erro:')) {
            throw new Error(`RouterBox Negou: ${resultadoMes.replace('popup_erro:', '').trim()}`);
          } else if (resultadoMes.startsWith('erro:')) {
            throw new Error(`RouterBox Negou: ${resultadoMes.replace('erro:', '').trim()}`);
          } else {
            throw new Error(`RouterBox Negou: Timeout de 60s sem mensagem de sucesso ou erro.`);
          }

        } catch (error) {
          console.log(`[RETRY] ${mes}/2026 — tentativa ${tentativa} falhou: ${error.message}`);
          if (error.message.includes('RouterBox Negou:')) {
             resultado.detalhes.erros.push(`${mes} falhou: ${error.message.replace('RouterBox Negou:', '').trim()}`);
             break; // Não tenta de novo se for um erro definitivo do RBX
          }
          await page.waitForTimeout(5000);
          tentativa++;
        }
      }

      if (!mesConcluido) {
        console.log(`[ERRO] Mês ${mes} — falhou após 3 tentativas`);
        resultado.detalhes.erros.push(`${mes} — falhou após 3 tentativas`);
      }
    }

    resultado.sucesso = resultado.detalhes.meses_gerados.length > 0;
    if (resultado.sucesso) {
        resultado.mensagem = `Sucesso parcial/total: ${resultado.detalhes.meses_gerados.length} meses gerados para cliente ${codigoCliente}.`;
    } else {
        resultado.mensagem = `Falha total: Nenhum mês foi gerado para cliente ${codigoCliente}.`;
    }
    
    if (resultado.detalhes.erros.length > 0) {
       resultado.mensagem += ` Detalhe dos erros: ` + resultado.detalhes.erros.join("; ");
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
