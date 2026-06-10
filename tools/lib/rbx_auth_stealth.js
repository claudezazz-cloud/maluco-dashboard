// ============================================================
// RBX_AUTH_STEALTH: versão com anti-detecção (playwright-extra + stealth)
// ============================================================
// 
// Por que este arquivo separado do rbx_auth.js?
// - O scrape.js (que FUNCIONA em produção) usa rbx_auth.js (Playwright puro)
// - O faturar.js precisa de anti-detecção porque o Routerbox tem anti-bot
//   que detecta Playwright headless e throttla/delay
// - playwright-extra + stealth plugin REMOVE/OFUSCA as características
//   que sites usam pra detectar Playwright (navigator.webdriver, plugins fake, etc)
//
// MUDANÇAS vs rbx_auth.js:
// - Importa playwright-extra em vez de playwright puro
// - Aplica stealth plugin (ESCONDE navigator.webdriver, plugins, etc)
// - User-Agent de Chrome 120 real (não o default do Playwright)
// - slowMo 200ms (Playwright espera 200ms entre comandos)
// - launch com args extras pra parecer mais humano
//
// v11.1 (Mavis 10/06 15:10): primeira versão com stealth.
// Resultado esperado: juíz passa pela detecção do Routerbox e processa normalmente.
// ============================================================

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';

const stealth = StealthPlugin();

// Função para carregar .env (igual rbx_auth.js)
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

export async function loginToRouterboxStealth({ timeoutMs = 120000, headless = true, screenshotOnError = false } = {}) {
  loadEnv();

  const RB_LOGIN_URL = process.env.RB_LOGIN_URL || 'https://routerbox.zazzinternet.com/routerbox/app_login/';
  const RB_USER = process.env.RB_USER;
  const RB_PASS = process.env.RB_PASS;

  if (!RB_USER || !RB_PASS) {
    throw new Error('Configure RB_USER e RB_PASS nas variáveis de ambiente.');
  }

  // ============================================================
  // STEALTH: aplica o plugin de anti-detecção
  // ============================================================
  // O plugin faz (entre outras coisas):
  // - Remove navigator.webdriver
  // - Adiciona plugins/chrome/headless chrome fake
  // - Mascara headless via window.chrome
  // - Corrige fingerprint de WebGL
  // - Adiciona languages realistas
  // ============================================================
  chromium.use(stealth);

  // ============================================================
  // STEALTH: User-Agent de Chrome 120 REAL
  // ============================================================
  // O Playwright default usa "HeadlessChrome" que é identificável.
  // Aqui usamos o User-Agent de Chrome 120 rodando em Windows 10.
  // ============================================================
  const REAL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // ============================================================
  // STEALTH: viewport realista
  // ============================================================
  const VIEWPORT = { width: 1920, height: 1080 };

  // ============================================================
  // STEALTH: args extras do Chromium
  // ============================================================
  // --disable-blink-features=AutomationControlled remove o flag de automação
  // --disable-features=IsolateOrigins,site-per-process ajuda a parecer mais humano
  // ============================================================
  const browser = await chromium.launch({
    headless,
    slowMo: 200, // 200ms entre cada comando do Playwright (imita humano)
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: REAL_USER_AGENT,
    viewport: VIEWPORT,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    }
  });

  // STEALTH: mascarar webdriver no nível do context também
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {}, loadTimes: () => {} };
  });

  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  console.log(`[RBX_AUTH_STEALTH] Abrindo ${RB_LOGIN_URL}`);
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
    if (screenshotOnError) await page.screenshot({ path: `screenshots/login-no-fields-stealth-${Date.now()}.png`, fullPage: true });
    throw new Error('Campos de login não encontrados.');
  }

  console.log(`[RBX_AUTH_STEALTH] Preenchendo credenciais para usuário ${RB_USER}`);
  // STEALTH: digita como humano (caractere por caractere com delay)
  await page.locator(userField).click();
  await page.locator(userField).type(RB_USER, { delay: 50 });
  await page.locator(passField).click();
  await page.locator(passField).type(RB_PASS, { delay: 50 });

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
    if (screenshotOnError) await page.screenshot({ path: `screenshots/login-failed-stealth-${Date.now()}.png`, fullPage: true });
    throw new Error(`Login falhou — URL ainda em app_login: ${page.url()}`);
  }

  console.log(`[RBX_AUTH_STEALTH] Login OK (URL: ${page.url()})`);

  return { browser, context, page };
}
