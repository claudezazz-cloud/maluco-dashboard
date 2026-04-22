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

  // Espera redirecionamento (URL muda de /app_login/ pra outra coisa)
  try {
    await page.waitForURL(url => !url.toString().includes('app_login'), { timeout: 15000 })
  } catch {
    // Se não mudou URL em 15s, capricha mais
    await page.waitForTimeout(3000)
  }
  await page.waitForLoadState('networkidle', { timeout: TIMEOUT_MS }).catch(() => {})
  await page.waitForTimeout(1500) // dar tempo pra SPA renderizar

  // Heurística mais robusta: se URL ainda contem app_login, falhou
  if (page.url().includes('app_login')) {
    await dumpScreenshot(page, 'login-failed')
    throw new Error(`Login falhou — URL ainda em app_login: ${page.url()}`)
  }
  log(`Login OK (URL: ${page.url()})`)
}

async function dismissModalNovidades(page) {
  log('Tentando fechar modal de Novidades (se aparecer)...')
  await page.waitForTimeout(2000)
  try {
    // O modal tem um "x" clicável no canto superior direito
    const closeX = page.locator('text=/^x$/').first()
    if (await closeX.count()) {
      await closeX.click({ timeout: 5000 })
      log('  Modal fechado via "x"')
      await page.waitForTimeout(500)
      return
    }
  } catch {}
  try {
    await page.keyboard.press('Escape')
    log('  Modal fechado via Escape')
  } catch {}
}

async function navegarParaAtendimentos(page) {
  // Vai pra app_menu.php (já estamos logados)
  if (!page.url().includes('app_menu.php')) {
    log('Navegando pra app_menu.php')
    await page.goto('https://routerbox.zazzinternet.com/routerbox/app_menu/app_menu.php', { waitUntil: 'networkidle', timeout: 30000 })
  }
  await dismissModalNovidades(page)

  // Trigger o item "Atendimentos > Execução" via JS exposto pelo Routerbox.
  // item_59 = Execução (descoberto inspecionando o HTML do menu).
  log('Disparando openMenuItem(app_menu_item_59) — Atendimentos > Execução')
  await page.evaluate(() => {
    if (typeof openMenuItem === 'function') openMenuItem('app_menu_item_59')
  })
  await page.waitForTimeout(2500)

  // O conteúdo principal carrega dentro do iframe app_menu_iframe.
  const iframeHandle = await page.locator('iframe#iframe_app_menu, iframe[name="app_menu_iframe"]').first()
  if (!(await iframeHandle.count())) {
    await dumpScreenshot(page, 'sem-iframe')
    throw new Error('Iframe app_menu_iframe não encontrado')
  }
  const frame = await iframeHandle.contentFrame()
  if (!frame) {
    await dumpScreenshot(page, 'iframe-sem-frame')
    throw new Error('Não consegui pegar contentFrame do app_menu_iframe')
  }

  // Espera o iframe ter carregado (URL não vazia + body com algo)
  await page.waitForTimeout(2000)
  try { log(`Iframe URL: ${frame.url()}`) } catch { log('Iframe carregado (URL indisponível)') }
  return frame
}

async function findFrameWithBotoes(page) {
  // Espera tabela carregar
  await page.waitForTimeout(3000)
  const allFrames = page.frames()
  log(`Pagina tem ${allFrames.length} frames; procurando "Botões"…`)
  for (const f of allFrames) {
    try {
      const url = f.url()
      const count = await f.locator('text="Botões"').count().catch(() => 0)
      log(`  frame: ${url || '(sem url)'} — matches: ${count}`)
      if (count > 0) return f
    } catch {}
  }
  return null
}

async function clicarVerTodos(frame, page) {
  log('Procurando botão "Ver Todos" (carrega todos os chamados)')
  const candidatos = [
    'button:has-text("Ver Todos")',
    'a:has-text("Ver Todos")',
    'input[value="Ver Todos" i]',
    'button:has-text("VER TODOS")',
    'a:has-text("VER TODOS")',
    'text=/Ver\\s*Todos/i',
  ]
  let clicado = false
  for (const sel of candidatos) {
    try {
      const loc = frame.locator(sel).first()
      if (await loc.count()) {
        await loc.click({ timeout: 5000 })
        log(`  "Ver Todos" clicado (selector: ${sel})`)
        clicado = true
        break
      }
    } catch {}
  }
  if (!clicado) {
    // Pode não existir sempre (se já carregou tudo por padrão); só avisa
    log('  "Ver Todos" não encontrado — seguindo (pode já estar listado)')
    return
  }
  // Aguarda recarregar a tabela
  await page.waitForTimeout(3500)
}

async function setar180PorPagina(frame, page) {
  // Observação (abr/2026): o Excel do Routerbox já exporta TODOS os registros
  // da query atual — a paginação "1 2 3" é só visual. O clique em "Ver Todos"
  // remove filtros e o Excel pega tudo de uma vez. Deixo a tentativa pra caso
  // algum dia o comportamento mude.
  try {
    const selects = frame.locator('select')
    const n = await selects.count()
    for (let i = 0; i < n; i++) {
      const s = selects.nth(i)
      const opts = await s.locator('option').allTextContents().catch(() => [])
      if (opts.some(o => /^\s*180\s*$/.test(o))) {
        await s.selectOption({ label: '180' }).catch(() => s.selectOption('180'))
        log(`  Paginação setada em 180`)
        await page.waitForTimeout(2500)
        return
      }
    }
  } catch {}
  // Sem erro — Excel exporta tudo de qualquer forma
}

async function exportarExcel(page, _topFrame) {
  log('Procurando botão "Botões" em todos os frames')

  let frame = await findFrameWithBotoes(page)
  if (!frame) {
    // Aguarda mais um pouco e tenta de novo (tabela pode estar carregando)
    log('Não achei na primeira tentativa, aguardando mais 5s…')
    await page.waitForTimeout(5000)
    frame = await findFrameWithBotoes(page)
  }
  if (!frame) {
    await dumpScreenshot(page, 'sem-botoes-em-nenhum-frame')
    throw new Error('Botão "Botões" não encontrado em nenhum frame')
  }
  log(`Achei "Botões" no frame: ${frame.url() || '(sem url)'}`)

  // Antes de exportar: clicar em "Ver Todos" e setar 180 por página
  // (padrão do sistema mostra poucos — sem isso, o Excel sai parcial)
  await clicarVerTodos(frame, page)
  await setar180PorPagina(frame, page)

  const botoesDropdown = frame.locator('text="Botões"').first()
  await botoesDropdown.click()
  await page.waitForTimeout(800)

  // Excel pode estar no mesmo frame ou em outro (tooltip pode ser portal)
  let excelOption = frame.locator('text="Excel"').first()
  if (!(await excelOption.count())) {
    // Tenta nos outros frames também
    for (const f of page.frames()) {
      const c = await f.locator('text="Excel"').count().catch(() => 0)
      if (c > 0) { excelOption = f.locator('text="Excel"').first(); break }
    }
  }
  if (!(await excelOption.count())) {
    await dumpScreenshot(page, 'sem-opcao-excel')
    throw new Error('Opção "Excel" não encontrada após abrir dropdown')
  }

  log('Clicando em Excel — Routerbox vai processar e mostrar modal "Arquivo criado"…')
  await excelOption.click()

  // O Routerbox NÃO baixa direto — ele processa e mostra modal com link "Baixar"
  log('Aguardando modal "Arquivo criado" aparecer…')
  let baixarLink = null
  const start = Date.now()
  while (Date.now() - start < TIMEOUT_MS) {
    for (const f of [page, ...page.frames()]) {
      const c = await f.locator('a:has-text("Baixar")').count().catch(() => 0)
      if (c > 0) {
        baixarLink = f.locator('a:has-text("Baixar")').first()
        break
      }
    }
    if (baixarLink) break
    await page.waitForTimeout(1000)
  }
  if (!baixarLink) {
    await dumpScreenshot(page, 'sem-link-baixar')
    throw new Error('Modal "Arquivo criado" / link "Baixar" não apareceu')
  }
  log('Link "Baixar" encontrado, clicando…')

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    baixarLink.click(),
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
    const frame = await navegarParaAtendimentos(page)
    xlsxPath = await exportarExcel(page, frame)
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
