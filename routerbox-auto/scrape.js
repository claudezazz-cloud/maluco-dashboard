/**
 * routerbox-auto/scrape.js
 *
 * Loga no Routerbox, baixa o XLSX de chamados em aberto, envia pro dashboard.
 * Roda via cron de hora em hora. Dependências: playwright, xlsx.
 *
 * Variáveis de ambiente (.env):
 *   RB_LOGIN_URL, RB_USER, RB_PASS
 *   DASHBOARD_URL, CHAMADOS_AUTO_TOKEN
 *   HEADLESS=1|0, SCREENSHOT_ON_ERROR=1|0, TIMEOUT_MS, DRY_RUN=1|0
 */

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const XLSX = require('xlsx')

// Carregamento simples de .env (sem dependência extra)
function loadEnv() {
  const envPath = path.join(__dirname, '.env')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    if (m[1].startsWith('#')) continue
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

function log(msg) {
  const ts = new Date().toISOString()
  console.log(`[${ts}] ${msg}`)
}

function fail(msg, err) {
  log(`ERRO: ${msg}`)
  if (err) log(err.stack || err.message || String(err))
  process.exit(1)
}

async function dumpScreenshot(page, name) {
  if (!SCREENSHOT_ON_ERROR) return
  try {
    const file = path.join(SCREENSHOT_DIR, `${name}-${Date.now()}.png`)
    await page.screenshot({ path: file, fullPage: true })
    log(`Screenshot salvo em ${file}`)
  } catch (e) {
    log(`(falha ao salvar screenshot: ${e.message})`)
  }
}

async function login(page) {
  log(`Abrindo ${RB_LOGIN_URL}`)
  await page.goto(RB_LOGIN_URL, { waitUntil: 'networkidle', timeout: TIMEOUT_MS })

  // Tentamos identificar campos de login pelos atributos mais comuns.
  // Se o Routerbox usar nomes diferentes, ajuste aqui.
  const userSel = ['input[name="usuario"]', 'input[name="user"]', 'input[name="login"]', 'input[type="text"]']
  const passSel = ['input[name="senha"]', 'input[name="password"]', 'input[name="pass"]', 'input[type="password"]']

  let userField = null
  for (const s of userSel) {
    if (await page.locator(s).count()) { userField = s; break }
  }
  let passField = null
  for (const s of passSel) {
    if (await page.locator(s).count()) { passField = s; break }
  }
  if (!userField || !passField) {
    await dumpScreenshot(page, 'login-no-fields')
    throw new Error('Campos de login não encontrados — abra screenshots/login-no-fields-*.png e ajuste seletores')
  }

  log(`Preenchendo login (usuário=${RB_USER})`)
  await page.fill(userField, RB_USER)
  await page.fill(passField, RB_PASS)

  // Submit: tenta botão por texto, depois Enter
  const submitCandidates = ['button:has-text("Entrar")', 'button:has-text("Login")', 'input[type="submit"]', 'button[type="submit"]']
  let clicked = false
  for (const s of submitCandidates) {
    if (await page.locator(s).count()) {
      await page.locator(s).first().click()
      clicked = true
      break
    }
  }
  if (!clicked) await page.keyboard.press('Enter')

  await page.waitForLoadState('networkidle', { timeout: TIMEOUT_MS })

  // Heurística: se ainda existe campo de senha, login falhou
  if (await page.locator(passField).count()) {
    await dumpScreenshot(page, 'login-failed')
    throw new Error('Login parece ter falhado — screenshot salvo, confira credenciais')
  }
  log('Login OK')
}

async function navegarParaAtendimentos(page) {
  // Caminho conhecido pela screenshot
  const url = 'https://routerbox.zazzinternet.com/routerbox/app_menu/app_menu.php?menu=atendimentos'
  log(`Navegando pra ${url}`)
  await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT_MS })

  // Confirma que carregou tabela de chamados
  const hint = page.locator('text=/Atendimentos|Chamados|Botões/i').first()
  if (!(await hint.count())) {
    await dumpScreenshot(page, 'atendimentos-nao-carregou')
    throw new Error('Página de Atendimentos não carregou como esperado')
  }
}

async function exportarExcel(page, context) {
  log('Procurando botão "Botões" → "Excel"')

  // 1. Clica no dropdown "Botões"
  const botoesDropdown = page.locator('button:has-text("Botões"), a:has-text("Botões")').first()
  if (!(await botoesDropdown.count())) {
    await dumpScreenshot(page, 'sem-botoes')
    throw new Error('Dropdown "Botões" não encontrado')
  }
  await botoesDropdown.click()

  // 2. Aguarda menu abrir e procura "Excel"
  await page.waitForTimeout(500)
  const excelOption = page.locator('a:has-text("Excel"), button:has-text("Excel"), li:has-text("Excel")').first()
  if (!(await excelOption.count())) {
    await dumpScreenshot(page, 'sem-opcao-excel')
    throw new Error('Opção "Excel" não encontrada no dropdown')
  }

  // 3. Captura o download
  log('Clicando em Excel e aguardando download…')
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: TIMEOUT_MS }),
    excelOption.click(),
  ])

  const filename = `chamados-${Date.now()}.xlsx`
  const filepath = path.join(DOWNLOAD_DIR, filename)
  await download.saveAs(filepath)
  log(`XLSX salvo em ${filepath}`)
  return filepath
}

function parseXLSX(filepath) {
  const wb = XLSX.readFile(filepath)
  // O dashboard usa SheetNames[1] se houver, senão SheetNames[0]
  const sheetName = wb.SheetNames.length > 1 ? wb.SheetNames[1] : wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (json.length < 2) throw new Error('XLSX vazio ou sem dados (planilha esperada não tem linhas)')
  const headers = json[0].map(h => String(h || '').trim())
  const rows = json.slice(1).filter(r => r.some(c => c !== '' && c !== null && c !== undefined))
  return { headers, rows }
}

async function postChamados({ headers, rows }) {
  const url = `${DASHBOARD_URL.replace(/\/$/, '')}/api/chamados/auto-import`
  log(`POST ${url} (${rows.length} chamados)`)
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-auto-token': TOKEN },
    body: JSON.stringify({ headers, chamados: rows }),
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text } }
  if (!r.ok) throw new Error(`Dashboard respondeu ${r.status}: ${JSON.stringify(body)}`)
  log(`OK: ${body.total} chamados aceitos, expira em ${body.expira_em}`)
}

async function main() {
  if (!RB_USER || !RB_PASS) fail('Configure RB_USER/RB_PASS em .env')

  const browser = await chromium.launch({ headless: HEADLESS })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT_MS)

  let xlsxPath
  try {
    await login(page)
    await navegarParaAtendimentos(page)
    xlsxPath = await exportarExcel(page, context)
  } catch (e) {
    await dumpScreenshot(page, 'erro')
    fail('Falha durante scraping', e)
  } finally {
    await browser.close()
  }

  let parsed
  try {
    parsed = parseXLSX(xlsxPath)
    log(`Parsed: ${parsed.rows.length} linhas, ${parsed.headers.length} colunas`)
  } catch (e) {
    fail(`Falha ao parsear XLSX (${xlsxPath})`, e)
  }

  if (DRY_RUN) {
    log(`DRY_RUN ativo — não vou postar. Headers: ${JSON.stringify(parsed.headers)}`)
    log(`Primeira linha: ${JSON.stringify(parsed.rows[0])}`)
    return
  }

  try {
    await postChamados(parsed)
  } catch (e) {
    fail('Falha ao postar no dashboard', e)
  }

  // Limpa downloads antigos (>3 dias) pra não encher o disco
  try {
    const cutoff = Date.now() - 3 * 86400 * 1000
    for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
      const full = path.join(DOWNLOAD_DIR, f)
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full)
    }
  } catch {}

  log('Done.')
}

main()
