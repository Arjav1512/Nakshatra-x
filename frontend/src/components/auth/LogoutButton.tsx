'use client'

import { useState } from 'react'
import { GlassButton } from '@/components/nakshatra/ui'
import { LogOut, Loader2 } from 'lucide-react'

export function LogoutButton() {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    try {
      setLoading(true)
      await fetch('/api/auth/session', { method: 'DELETE' })
      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
  }

  return (
    <GlassButton variant="ghost" onClick={handleLogout} disabled={loading} className="gap-2 text-xs">
      {loading ? <Loader2 size={14} className="animate-spin text-[#00FF88]" /> : <LogOut size={14} />}
      <span>Sign out</span>
    </GlassButton>
  )
}
