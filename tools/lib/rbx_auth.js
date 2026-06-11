import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

// Função para carregar .env caso necessário
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'routerbox-auto', '.env'),
    '/opt/zazz/routerbox-auto/.env'
  ];
  
  let content = null;
  for (const ep of envPaths) {
    if (fs.existsSync(ep)) {
      content = fs.readFileSync(ep, 'utf-8');
      break;
    }
  }
  
  if (!content) return;

  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (m[1].startsWith('#')) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export async function loginToRouterbox({ timeoutMs = 120000, headless = true, screenshotOnError = false } = {}) {
  loadEnv();

  const RB_LOGIN_URL = process.env.RB_LOGIN_URL || 'https://routerbox.zazzinternet.com/routerbox/app_login/';
  const RB_USER = process.env.RB_USER;
  const RB_PASS = process.env.RB_PASS;

  if (!RB_USER || !RB_PASS) {
    throw new Error('Configure RB_USER e RB_PASS nas variáveis de ambiente.');
  }

  const browser = await chromium.launch({ headless });
  // Gravação de vídeo: se RB_VIDEO_DIR estiver setado, grava a sessão em .webm
  const contextOpts = { acceptDownloads: true };
  if (process.env.RB_VIDEO_DIR) {
    contextOpts.recordVideo = { dir: process.env.RB_VIDEO_DIR, size: { width: 1280, height: 720 } };
    console.log(`[RBX_AUTH] Gravando vídeo em ${process.env.RB_VIDEO_DIR}`);
  }
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  console.log(`[RBX_AUTH] Abrindo ${RB_LOGIN_URL}`);
  await page.goto(RB_LOGIN_URL, { waitUntil: 'networkidle', timeout: timeoutMs });

  const userSel = ['input[name="usuario"]', 'input[name="user"]', 'input[name="login"]', 'input[type="text"]'];
  const passSel = ['input[name="senha"]', 'input[name="password"]', 'input[name="pass"]', 'input[type="password"]'];

  let userField = null;
  for (const s of userSel) {
    if (await page.locator(s).count()) { userField = s; break; }
  }
  let passField = null;
  for (const s of passSel) {
    if (await page.locator(s).count()) { passField = s; break; }
  }

  if (!userField || !passField) {
    if (screenshotOnError) await page.screenshot({ path: `screenshots/login-no-fields-${Date.now()}.png`, fullPage: true });
    throw new Error('Campos de login não encontrados.');
  }

  console.log(`[RBX_AUTH] Preenchendo credenciais para usuário ${RB_USER}`);

  // Preenchimento robusto: espera o campo, clica, preenche e VERIFICA o valor.
  // Routerbox às vezes não registra o fill se for rápido demais (campo com JS/máscara).
  async function fillVerified(selector, value, label) {
    const field = page.locator(selector).first();
    await field.waitFor({ state: 'visible', timeout: 30000 });
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      await field.click();
      await field.fill('');                 // limpa qualquer resíduo
      await field.fill(value);
      await page.waitForTimeout(300);
      const atual = await field.inputValue().catch(() => '');
      if (atual === value) {
        console.log(`[RBX_AUTH] ${label} preenchido (tentativa ${tentativa}).`);
        return;
      }
      // Fallback: digita tecla por tecla (campos teimosos)
      console.log(`[RBX_AUTH] ${label} não registrou (got "${atual.length} chars"), digitando manualmente...`);
      await field.click();
      await field.fill('');
      await field.pressSequentially(value, { delay: 50 });
      await page.waitForTimeout(300);
      const atual2 = await field.inputValue().catch(() => '');
      if (atual2 === value) {
        console.log(`[RBX_AUTH] ${label} preenchido via teclado (tentativa ${tentativa}).`);
        return;
      }
    }
    throw new Error(`Não consegui preencher o campo ${label} após 3 tentativas.`);
  }

  await fillVerified(userField, RB_USER, 'Usuário');
  await fillVerified(passField, RB_PASS, 'Senha');

  // Garantia final: confirma que AMBOS os campos têm valor antes de submeter
  const userVal = await page.locator(userField).first().inputValue().catch(() => '');
  const passVal = await page.locator(passField).first().inputValue().catch(() => '');
  if (!userVal || !passVal) {
    if (screenshotOnError) await page.screenshot({ path: `screenshots/login-empty-${Date.now()}.png`, fullPage: true });
    throw new Error(`Campos vazios antes de submeter (user=${userVal.length}c, pass=${passVal.length}c).`);
  }

  // Botão de login do Routerbox é um <a> do ScriptCase (a#sub_form_b.scButton_ok),
  // não um <button>. Por isso priorizamos esses seletores.
  const submitCandidates = [
    'a#sub_form_b',
    'a.scButton_ok',
    'a:has-text("Entrar")',
    'button:has-text("Entrar")',
    'button:has-text("Login")',
    'input[type="submit"]',
    'button[type="submit"]',
  ];
  let clicked = false;
  for (const s of submitCandidates) {
    const loc = page.locator(s).first();
    if (await loc.count()) {
      console.log(`[RBX_AUTH] Clicando botão de login: ${s}`);
      await loc.click().catch(() => {});
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    console.log('[RBX_AUTH] Nenhum botão encontrado — disparando login via JS/Enter');
    // Fallback: chama a função do ScriptCase direto, depois Enter
    await page.evaluate(() => { if (typeof scBtnFn_sys_format_ok === 'function') scBtnFn_sys_format_ok(); }).catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
  }

  try {
    await page.waitForURL(url => !url.toString().includes('app_login'), { timeout: 15000 });
  } catch {
    await page.waitForTimeout(3000);
  }
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
  await page.waitForTimeout(1500);

  if (page.url().includes('app_login')) {
    if (screenshotOnError) await page.screenshot({ path: `screenshots/login-failed-${Date.now()}.png`, fullPage: true });
    throw new Error(`Login falhou — URL ainda em app_login: ${page.url()}`);
  }

  console.log(`[RBX_AUTH] Login OK (URL: ${page.url()})`);

  return { browser, context, page };
}
