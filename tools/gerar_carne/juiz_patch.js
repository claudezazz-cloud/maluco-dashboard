// ============================================================
// GERAR CARNE - Juiz de sucesso REESCRITO (Mavis patch v4 - 09/06/2026)
//
// v4: agora este patch SUBSTITUI do `try {` ATÉ o `} catch (error) {` completo.
// Ou seja, ele contém o try + todo o conteúdo + o catch. O break final
// é parte do catch (do try externo, igual ao código original).
// ============================================================

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

  // Pequena pausa pra popup de confirmação renderizar
  await page.waitForTimeout(1000);

  // === ESPERA ATIVA: Promise.race ===
  console.log(`[MES] Aguardando conclusão do faturamento de ${mes}...`);

  const SUCESSO_SEL = '.alert-success, .scFormMessageSuccess, .swal2-icon--success, .sweet-alert.showSweetAlert.visible';
  const ERRO_SEL = '.alert-danger, .scFormErrorMessage, .swal2-icon--error, .swal2-popup.swal2-icon-error, .sweet-alert:has-text("Erro"):visible';
  const POPUP_TITULO_SEL = '.swal2-title, .sweet-alert h2';
  const POPUP_CORPO_SEL = '.swal2-html-container, .sweet-alert p';

  let resultadoMes = 'timeout';

  try {
    resultadoMes = await Promise.race([
      page.waitForSelector(SUCESSO_SEL, { timeout: 60000, state: 'visible' })
        .then(() => 'sucesso'),

      page.waitForSelector(ERRO_SEL, { timeout: 60000, state: 'visible' })
        .then(async () => {
          const titulo = await page.locator(ERRO_SEL).first().innerText().catch(() => '');
          return 'erro:' + titulo.trim();
        }),

      page.waitForSelector(POPUP_TITULO_SEL, { timeout: 60000, state: 'visible' })
        .then(async () => {
          const titulo = await page.locator(POPUP_TITULO_SEL).first().innerText().catch(() => '');
          const corpo = await page.locator(POPUP_CORPO_SEL).first().innerText().catch(() => '');
          const texto = (titulo + ' ' + corpo).replace(/\s+/g, ' ').trim();
          console.log(`[DIALOG] Popup interceptado: "${texto}"`);

          const btnOk = page.locator(
            '.swal2-confirm, .sweet-alert button.confirm, ' +
            'button:has-text("Ok"), button:has-text("OK"), ' +
            'a:has-text("Ok"), a:has-text("OK"), ' +
            '#sc_b_ok_bot, #sc_b_ok_t'
          ).first();
          if (await btnOk.count()) {
            await btnOk.click().catch(() => {});
          }

          if (texto.toLowerCase().includes('confirma a execução') ||
              texto.toLowerCase().includes('confirma a execucao')) {
            return 'confirmacao';
          }

          return 'popup_erro:' + texto;
        })
    ]);
  } catch (e) {
    // Timeout dos 60s sem nada aparecer
    console.log(`[TIMEOUT] ${mes}/2026: 60s sem mensagem visível do Routerbox.`);
    resultadoMes = 'timeout';
  }

  // SCREENSHOT SEMPRE — cena do crime, mesmo no caminho feliz
  await page.screenshot({ path: `erro_mes_${mes}_t${tentativa}.png` }).catch(() => {});

  if (resultadoMes === 'sucesso') {
    console.log(`[OK] ${mes}/2026 — sucesso detectado.`);
    resultado.detalhes.meses_gerados.push(mes);
    mesConcluido = true;
    break;
  }

  if (resultadoMes === 'confirmacao') {
    console.log(`[CONFIRMADO] ${mes}/2026: confirmação aceita, reentrando no juíz...`);
    alertaAceito = true;
    // não incrementa tentativa, reentra no while
  } else if (resultadoMes.startsWith('popup_erro:')) {
    const msg = resultadoMes.replace('popup_erro:', '').trim();
    throw new Error(`RouterBox Negou: ${msg}`);
  } else if (resultadoMes.startsWith('erro:')) {
    const msg = resultadoMes.replace('erro:', '').trim();
    throw new Error(`RouterBox Negou: ${msg}`);
  } else {
    // timeout
    throw new Error(`RouterBox Negou: Timeout de 60s sem mensagem de sucesso ou erro (servidor lento ou silenciou).`);
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
