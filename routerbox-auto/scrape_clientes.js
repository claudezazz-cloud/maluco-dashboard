/**
 * routerbox-auto/scrape_clientes.js
 *
 * Loga no Routerbox, abre Clientes > Cadastro (app_menu_item_13), exporta a lista
 * completa via Opções > Excel, aguarda gerar, baixa o cons_clientes_geral.xls e
 * posta no dashboard (/api/clientes/auto-import). Roda 1x/dia (cron 20:30 BRT).
 *
 * Mesma lógica do scrape.js (chamados) até o login; muda a navegação e o botão de export.
 * Dependências: playwright, xlsx. Usa o mesmo .env do scrape.js.
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const XLSX = require('xlsx')

function loadEnv() {
  const envPath = path.join(__dirname, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m || m[1].startsWith('#')) continue
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const RB_LOGIN_URL = process.env.RB_LOGIN_URL || 'https://routerbox.zazzinternet.com/routerbox/app_login/'
const RB_USER = process.env.RB_USER
const RB_PASS = process.env.RB_PASS
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://dashboard.srv1537041.hstgr.cloud'
const TOKEN = process.env.CHAMADOS_AUTO_TOKEN || 'CHAMADOS_AUTO_2026'
const HEADLESS = process.env.HEADLESS !== '0'
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '120000', 10)
const DRY_RUN = process.env.DRY_RUN === '1'
const SCREENSHOT_ON_ERROR = process.env.SCREENSHOT_ON_ERROR !== '0'

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')
const DOWNLOAD_DIR = path.join(__dirname, 'downloads')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`)
function fail(m, e) { log(`ERRO: ${m}`); if (e) log(e.stack || e.message || String(e)); process.exit(1) }
async function dumpScreenshot(page, name) {
  if (!SCREENSHOT_ON_ERROR) return
  try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}-${Date.now()}.png`), fullPage: true }) } catch {}
}

async function login(page) {
  log(`Abrindo ${RB_LOGIN_URL}`)
  await page.goto(RB_LOGIN_URL, { waitUntil: 'networkidle', timeout: TIMEOUT_MS })
  const userSel = ['input[name="usuario"]', 'input[name="user"]', 'input[name="login"]', 'input[type="text"]']
  const passSel = ['input[name="senha"]', 'input[name="password"]', 'input[name="pass"]', 'input[type="password"]']
  let userField = null, passField = null
  for (const s of userSel) if (await page.locator(s).count()) { userField = s; break }
  for (const s of passSel) if (await page.locator(s).count()) { passField = s; break }
  if (!userField || !passField) { await dumpScreenshot(page, 'login-no-fields'); throw new Error('Campos de login não encontrados') }
  await page.fill(userField, RB_USER)
  await page.fill(passField, RB_PASS)
  const submit = ['button:has-text("Entrar")', 'button:has-text("Login")', 'input[type="submit"]', 'button[type="submit"]']
  let clicked = false
  for (const s of submit) if (await page.locator(s).count()) { await page.locator(s).first().click(); clicked = true; break }
  if (!clicked) await page.keyboard.press('Enter')
  try { await page.waitForURL(u => !u.toString().includes('app_login'), { timeout: 15000 }) } catch { await page.waitForTimeout(3000) }
  await page.waitForLoadState('networkidle', { timeout: TIMEOUT_MS }).catch(() => {})
  await page.waitForTimeout(1500)
  if (page.url().includes('app_login')) { await dumpScreenshot(page, 'login-failed'); throw new Error(`Login falhou: ${page.url()}`) }
  log(`Login OK (${page.url()})`)
}

async function dismissModalNovidades(page) {
  await page.waitForTimeout(2000)
  try {
    const x = page.locator('text=/^x$/').first()
    if (await x.count()) { await x.click({ timeout: 5000 }); await page.waitForTimeout(500); return }
  } catch {}
  try { await page.keyboard.press('Escape') } catch {}
}

async function navegarParaClientes(page) {
  if (!page.url().includes('app_menu.php')) {
    await page.goto('https://routerbox.zazzinternet.com/routerbox/app_menu/app_menu.php', { waitUntil: 'networkidle', timeout: 30000 })
  }
  await dismissModalNovidades(page)
  // app_menu_item_13 = Clientes > Cadastro (mesmo que o gerar_carne usa)
  log('Abrindo Clientes > Cadastro (openMenuItem app_menu_item_13)')
  await page.evaluate(() => { if (typeof openMenuItem === 'function') openMenuItem('app_menu_item_13') })
  await page.waitForTimeout(3000)
  const iframeHandle = page.locator('iframe#iframe_app_menu, iframe[name="app_menu_iframe"]').first()
  if (!(await iframeHandle.count())) { await dumpScreenshot(page, 'sem-iframe'); throw new Error('Iframe app_menu_iframe não encontrado') }
  await page.waitForTimeout(2000)
}

// Procura, em todos os frames, aquele que tem o texto dado (ex.: "Opções")
async function frameComTexto(page, regex) {
  for (const f of page.frames()) {
    try { if (await f.locator(`text=${regex}`).count()) return f } catch {}
  }
  return null
}

async function exportarExcel(page) {
  log('Procurando a grade de clientes (botão "Opções")…')
  let frame = null
  for (let i = 0; i < 6 && !frame; i++) {
    frame = await frameComTexto(page, '/Op[çc][õo]es/i')
    if (!frame) await page.waitForTimeout(3000)
  }
  if (!frame) { await dumpScreenshot(page, 'sem-opcoes'); throw new Error('Botão "Opções" não encontrado em nenhum frame') }
  log(`Grade encontrada (${frame.url() || 'sem url'})`)

  // Abre o dropdown "Opções"
  await frame.locator('text=/Op[çc][õo]es/i').first().click()
  await page.waitForTimeout(1000)

  // Clica em "Excel" (pode estar no mesmo frame ou em outro/portal)
  let excel = frame.locator('text=/^\\s*Excel\\s*$/i').first()
  if (!(await excel.count())) {
    const f2 = await frameComTexto(page, '/^\\s*Excel\\s*$/i')
    if (f2) excel = f2.locator('text=/^\\s*Excel\\s*$/i').first()
  }
  if (!(await excel.count())) { await dumpScreenshot(page, 'sem-excel'); throw new Error('Opção "Excel" não encontrada') }
  log('Clicando em Excel — aguardando Routerbox gerar o arquivo…')
  await excel.click()

  // Modal "Arquivo criado" com link "Baixar"
  let baixar = null
  const start = Date.now()
  while (Date.now() - start < TIMEOUT_MS) {
    for (const f of [page, ...page.frames()]) {
      const c = await f.locator('a:has-text("Baixar")').count().catch(() => 0)
      if (c > 0) { baixar = f.locator('a:has-text("Baixar")').first(); break }
    }
    if (baixar) break
    await page.waitForTimeout(1000)
  }
  if (!baixar) { await dumpScreenshot(page, 'sem-baixar'); throw new Error('Link "Baixar" não apareceu') }

  log('Link "Baixar" encontrado, baixando…')
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    baixar.click(),
  ])
  const filepath = path.join(DOWNLOAD_DIR, `clientes-${Date.now()}.xls`)
  await download.saveAs(filepath)
  log(`Arquivo salvo em ${filepath}`)
  return filepath
}

function parseExcel(filepath) {
  const wb = XLSX.readFile(filepath)
  const sheet = wb.Sheets[wb.SheetNames[wb.SheetNames.length > 1 ? 1 : 0]]
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (json.length < 2) throw new Error('Excel vazio')
  const headers = json[0].map(h => String(h || '').trim())
  const rows = json.slice(1).filter(r => r.some(c => c !== '' && c !== null && c !== undefined))
  return { headers, rows }
}

async function postClientes({ headers, rows }) {
  const url = `${DASHBOARD_URL.replace(/\/$/, '')}/api/clientes/auto-import`
  log(`POST ${url} (${rows.length} clientes)`)
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-auto-token': TOKEN },
    body: JSON.stringify({ headers, clientes: rows }),
  })
  const text = await r.text()
  let body; try { body = JSON.parse(text) } catch { body = { raw: text } }
  if (!r.ok) throw new Error(`Dashboard respondeu ${r.status}: ${JSON.stringify(body)}`)
  log(`OK: ${body.total} clientes (com CPF: ${body.com_cpf}, com grupo: ${body.com_grupo}), importado_em ${body.importado_em}`)
}

async function main() {
  if (!RB_USER || !RB_PASS) fail('Configure RB_USER/RB_PASS em routerbox-auto/.env')
  const browser = await chromium.launch({ headless: HEADLESS })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT_MS)

  let filepath
  try {
    await login(page)
    await navegarParaClientes(page)
    filepath = await exportarExcel(page)
  } catch (e) {
    await dumpScreenshot(page, 'erro-clientes')
    fail('Falha durante scraping de clientes', e)
  } finally {
    await browser.close()
  }

  let parsed
  try {
    parsed = parseExcel(filepath)
    log(`Parsed: ${parsed.rows.length} linhas, ${parsed.headers.length} colunas`)
  } catch (e) { fail(`Falha ao parsear ${filepath}`, e) }

  if (DRY_RUN) {
    log(`DRY_RUN — não vou postar. Headers: ${JSON.stringify(parsed.headers)}`)
    log(`Primeira linha: ${JSON.stringify(parsed.rows[0])}`)
    return
  }
  try { await postClientes(parsed) } catch (e) { fail('Falha ao postar no dashboard', e) }

  try {
    const cutoff = Date.now() - 3 * 86400 * 1000
    for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
      const full = path.join(DOWNLOAD_DIR, f)
      if (f.startsWith('clientes-') && fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full)
    }
  } catch {}
  log('Done.')
}

main()
