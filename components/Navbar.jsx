'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from './Sidebar'
import { LayoutDashboard, Brain, Ticket, Settings, MessageSquare, Shield, LogOut, Menu } from 'lucide-react'

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
                <Menu className="w-5 h-5 text-gray-400" />
                <img src="/logo-zazz.png" alt="Zazz" className="h-8 w-auto" />
              </button>
              <Link href="/dashboard">
                <span className="hover:text-gray-300 transition">Maluco da IA</span>
              </Link>
            </div>
            <div className="flex gap-1">
              <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </Link>
              <Link href="/chamados" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                <Ticket className="w-3.5 h-3.5" /> Chamados & Clientes
              </Link>
              {user?.role === 'admin' && (
                <>
                  <Link href="/treinamento" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    <Brain className="w-3.5 h-3.5" /> Treinamento & POPs
                  </Link>
                  <Link href="/system-prompt" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    <Settings className="w-3.5 h-3.5" /> System Prompt
                  </Link>
                  <Link href="/conversas" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    <MessageSquare className="w-3.5 h-3.5" /> Conversas
                  </Link>
                  <Link href="/admin" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    <Shield className="w-3.5 h-3.5" /> Admin
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{user?.nome || user?.email}</span>
            {user?.role === 'admin' ? (
              <span className="text-xs bg-green-900/50 text-green-300 border border-green-900 px-2 py-0.5 rounded">Admin</span>
            ) : (
              <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-900 px-2 py-0.5 rounded">Colaborador</span>
            )}
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </nav>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}
