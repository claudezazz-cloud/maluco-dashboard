import { redirect } from 'next/navigation'

// Atalho: /feriados → /admin/feriados (a tela real fica sob o Admin).
export default function FeriadosRedirect() {
  redirect('/admin/feriados')
}
