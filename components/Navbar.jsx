'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from './Sidebar'

export default function Navbar({ user }) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      <nav className="bg-[#1a1a24] border-b border-gray-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-bold text-white">
              {/* Hamburger + Logo — abre sidebar */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2 hover:opacity-80 transition"
                title="Menu — Sobre"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                <img src="/logo-zazz.png" alt="Zazz" className="h-8 w-auto" />
              </button>
              <Link href="/dashboard">
                <span className="hover:text-gray-300 transition">Maluco da IA</span>
              </Link>
            </div>
            <div className="flex gap-1">
              <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                Dashboard
              </Link>
              {user?.role === 'admin' && (
                <>
                  <Link href="/treinamento" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    🧠 Treinamento & POPs
                  </Link>
                  <Link href="/chamados" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    🎫 Chamados & Clientes
                  </Link>
                  <Link href="/system-prompt" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    ⚙️ System Prompt
                  </Link>
                  <Link href="/conversas" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    💬 Conversas
                  </Link>
                  <Link href="/admin" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    Admin
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{user?.nome || user?.email}</span>
            {user?.role === 'admin' && (
              <span className="text-xs bg-green-900/50 text-green-300 border border-green-900 px-2 py-0.5 rounded">Admin</span>
            )}
            <button onClick={logout} className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
              Sair
            </button>
          </div>
        </div>
      </nav>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}
