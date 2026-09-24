import type React from 'react'

export const metadata = {
  title: 'Global Command Admin | Nakshatra-X',
  description: 'Restricted Orbital Commander Console & User Telemetry Registry',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen bg-[var(--color-surface-0)] text-white selection:bg-[var(--color-status-nominal)] selection:text-black">{children}</div>
}
