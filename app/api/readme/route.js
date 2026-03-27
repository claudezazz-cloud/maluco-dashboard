import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const readmePath = join(process.cwd(), 'README.md')
    const content = readFileSync(readmePath, 'utf-8')
    return NextResponse.json({ content })
  } catch (e) {
    return NextResponse.json({ content: 'README.md não encontrado.' }, { status: 404 })
  }
}
