import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let markdown = '';
    
    if (contentType.includes('application/json')) {
      const data = await request.json();
      markdown = data.markdown;
    } else {
      markdown = await request.text();
    }

    if (!markdown) {
      return NextResponse.json({ error: 'Markdown ausente' }, { status: 400 })
    }

    // Gerar nomes de arquivos temporários
    const uniqueId = Date.now() + Math.random().toString(36).substring(7)
    const tmpDir = process.env.TMPDIR || '/tmp'
    const mdPath = path.join(tmpDir, `report_${uniqueId}.md`)
    const pdfPath = path.join(tmpDir, `report_${uniqueId}.pdf`)

    // Escrever o markdown
    fs.writeFileSync(mdPath, markdown, 'utf-8')

    // Chamar o script python
    const scriptPath = path.join(process.cwd(), 'generate_pdf.py')
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath} ${mdPath} ${pdfPath}`)
    
    if (stderr) {
      console.error('generate_pdf stderr:', stderr)
    }

    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: 'PDF nao foi gerado pelo script' }, { status: 500 })
    }

    // Ler o PDF gerado e retornar como binário puro (igual ao report-excel)
    const pdfBuffer = fs.readFileSync(pdfPath)

    // Limpar arquivos temporários
    try {
      fs.unlinkSync(mdPath)
      fs.unlinkSync(pdfPath)
    } catch(e) {}

    // Retorna o PDF como binário puro com content-type correto
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report.pdf"`,
      }
    })
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
