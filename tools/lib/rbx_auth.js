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
  const context = await browser.newContext({ acceptDownloads: true });
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
  await page.fill(userField, RB_USER);
  await page.fill(passField, RB_PASS);

  const submitCandidates = ['button:has-text("Entrar")', 'button:has-text("Login")', 'input[type="submit"]', 'button[type="submit"]'];
  let clicked = false;
  for (const s of submitCandidates) {
    if (await page.locator(s).count()) {
      await page.locator(s).first().click();
      clicked = true;
      break;
    }
  }
  if (!clicked) await page.keyboard.press('Enter');

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
