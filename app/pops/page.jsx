'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PopsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/treinamento') }, [router])
  return null
}
