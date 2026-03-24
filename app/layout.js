import './globals.css'

export const metadata = {
  title: 'Maluco da IA 👽 - Dashboard',
  description: 'Dashboard de monitoramento do assistente',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-gray-800 py-3 px-6 text-center">
          <p className="text-xs text-gray-600">
            Desenvolvido por <span className="text-gray-500">Franquelin Baldoria de Almeida</span>
            {' · '}
            <a href="https://instagram.com/Frank_almeida5" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition">@Frank_almeida5</a>
            {' · '}
            <a href="https://wa.me/5543991663335" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition">WhatsApp: (43) 99166-3335</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
