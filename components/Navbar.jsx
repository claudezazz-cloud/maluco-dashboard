'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Sidebar from './Sidebar'
import { LayoutDashboard, Brain, Ticket, Settings, MessageSquare, MessageCircle, Shield, LogOut, Menu, ChevronDown } from 'lucide-react'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chamados', label: 'Chamados', icon: Ticket },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
]

const adminLinks = [
  { href: '/treinamento', label: 'Treinamento', icon: Brain },
  { href: '/system-prompt', label: 'Prompt', icon: Settings },
  { href: '/conversas', label: 'Conversas', icon: MessageSquare },
  { href: '/admin', label: 'Admin', icon: Shield },
]

export default function Navbar({ user }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const allLinks = user?.role === 'admin' ? [...navLinks, ...adminLinks] : navLinks

  return (
    <>
      <nav className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        {/* Accent line on top */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.04] transition-colors duration-200"
                title="Menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <img src="/logo-zazz.png" alt="Zazz" className="h-7 w-auto opacity-90 group-hover:opacity-100 transition-opacity" />
                <span className="font-display font-semibold text-[15px] text-white/90 tracking-tight group-hover:text-white transition-colors">
                  Maluco da IA
                </span>
              </Link>
            </div>

            {/* Nav Links */}
            <div className="flex items-center gap-0.5">
              {allLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'text-white bg-white/[0.06]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand' : ''}`} />
                    {label}
                    {isActive && (
                      <span className="absolute -bottom-[9px] left-3 right-3 h-[2px] bg-brand rounded-full shadow-[0_0_8px_rgba(0,200,83,0.4)]" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right: User info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
              {/* Avatar placeholder */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                user?.role === 'admin'
                  ? 'bg-brand/15 text-brand ring-1 ring-brand/20'
                  : 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20'
              }`}>
                {(user?.nome || user?.email || '?')[0].toUpperCase()}
              </div>
              <span className="text-[13px] text-gray-400 font-medium max-w-[120px] truncate">
                {user?.nome || user?.email}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                user?.role === 'admin'
                  ? 'text-brand/80 bg-brand/10'
                  : 'text-blue-400/80 bg-blue-500/10'
              }`}>
                {user?.role === 'admin' ? 'Admin' : 'User'}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-200"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}
