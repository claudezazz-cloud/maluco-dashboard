'use client'
import { useState, useEffect } from 'react'

function parseMarkdown(md) {
  const lines = md.split('\n')
  const elements = []
  let i = 0
  let codeBlock = null

  while (i < lines.length) {
    const line = lines[i]

    // Code block start/end
    if (line.trimStart().startsWith('```')) {
      if (codeBlock !== null) {
        elements.push({ type: 'code', content: codeBlock.join('\n'), id: elements.length })
        codeBlock = null
      } else {
        codeBlock = []
      }
      i++
      continue
    }
    if (codeBlock !== null) {
      codeBlock.push(line)
      i++
      continue
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      if (tableLines.length >= 2) {
        const headerCells = tableLines[0].split('|').filter(c => c.trim()).map(c => c.trim())
        const rows = tableLines.slice(2).map(r => r.split('|').filter(c => c.trim()).map(c => c.trim()))
        elements.push({ type: 'table', headers: headerCells, rows, id: elements.length })
      }
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push({ type: 'hr', id: elements.length })
      i++
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      elements.push({ type: `h${headingMatch[1].length}`, content: headingMatch[2], id: elements.length })
      i++
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++
      continue
    }

    // List items
    if (/^\s*[-*]\s/.test(line)) {
      const indent = line.search(/\S/)
      elements.push({ type: 'li', content: line.replace(/^\s*[-*]\s/, ''), indent, id: elements.length })
      i++
      continue
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      const indent = line.search(/\S/)
      elements.push({ type: 'oli', content: line.replace(/^\s*\d+\.\s/, ''), indent, id: elements.length })
      i++
      continue
    }

    // Regular paragraph
    elements.push({ type: 'p', content: line, id: elements.length })
    i++
  }

  return elements
}

function formatInline(text) {
  // Bold + Italic
  let result = text
  const parts = []
  let lastIndex = 0

  // Process bold **text** and `code`
  const regex = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
  let match

  while ((match = regex.exec(result)) !== null) {
    if (match.index > lastIndex) {
      parts.push(result.slice(lastIndex, match.index))
    }
    if (match[1]) {
      parts.push(<strong key={match.index} className="text-white font-semibold">{match[1]}</strong>)
    } else if (match[2]) {
      parts.push(<code key={match.index} className="bg-[#0f0f13] border border-gray-700 text-green-300 px-1.5 py-0.5 rounded text-xs font-mono">{match[2]}</code>)
    } else if (match[3] && match[4]) {
      parts.push(<a key={match.index} href={match[4]} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline">{match[3]}</a>)
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < result.length) {
    parts.push(result.slice(lastIndex))
  }

  return parts.length > 0 ? parts : result
}

function RenderedMarkdown({ elements }) {
  return (
    <div className="space-y-2">
      {elements.map((el) => {
        switch (el.type) {
          case 'h1':
            return <h1 key={el.id} className="text-2xl font-bold text-white mt-6 mb-2 flex items-center gap-2">{formatInline(el.content)}</h1>
          case 'h2':
            return <h2 key={el.id} className="text-xl font-bold text-white mt-5 mb-2 border-b border-gray-700 pb-2">{formatInline(el.content)}</h2>
          case 'h3':
            return <h3 key={el.id} className="text-lg font-semibold text-gray-200 mt-4 mb-1">{formatInline(el.content)}</h3>
          case 'h4':
            return <h4 key={el.id} className="text-base font-semibold text-gray-300 mt-3 mb-1">{formatInline(el.content)}</h4>
          case 'hr':
            return <hr key={el.id} className="border-gray-700 my-4" />
          case 'p':
            return <p key={el.id} className="text-gray-300 text-sm leading-relaxed">{formatInline(el.content)}</p>
          case 'li':
            return <div key={el.id} className="text-gray-300 text-sm leading-relaxed flex gap-2" style={{ paddingLeft: `${el.indent * 8 + 8}px` }}>
              <span className="text-green-400 shrink-0">•</span>
              <span>{formatInline(el.content)}</span>
            </div>
          case 'oli':
            return <div key={el.id} className="text-gray-300 text-sm leading-relaxed flex gap-2" style={{ paddingLeft: `${el.indent * 8 + 8}px` }}>
              <span>{formatInline(el.content)}</span>
            </div>
          case 'code':
            return (
              <pre key={el.id} className="bg-[#0f0f13] border border-gray-700 rounded-lg p-4 overflow-x-auto">
                <code className="text-green-300 text-xs font-mono whitespace-pre">{el.content}</code>
              </pre>
            )
          case 'table':
            return (
              <div key={el.id} className="overflow-x-auto my-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {el.headers.map((h, j) => (
                        <th key={j} className="text-left text-gray-300 font-semibold bg-[#0f0f13] border border-gray-700 px-3 py-2 text-xs">{formatInline(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {el.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k} className="text-gray-400 border border-gray-700 px-3 py-2 text-xs">{formatInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}

export default function Sidebar({ open, onClose }) {
  const [readme, setReadme] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && !readme) {
      setLoading(true)
      fetch('/api/readme')
        .then(r => r.json())
        .then(d => { setReadme(d.content); setLoading(false) })
        .catch(() => { setReadme('Erro ao carregar README.'); setLoading(false) })
    }
  }, [open, readme])

  const parsed = readme ? parseMarkdown(readme) : []

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 h-full w-[480px] max-w-[90vw] bg-[#1a1a24] border-r border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <img src="/logo-zazz.png" alt="Zazz" className="h-7 w-auto" />
            <h2 className="font-bold text-white text-lg">Sobre</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-gray-400 text-sm">Carregando...</span>
            </div>
          ) : (
            <RenderedMarkdown elements={parsed} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500 shrink-0">
          Maluco da IA 👽 — Zazz Internet
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </>
  )
}
