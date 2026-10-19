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
  return <div className="min-h-[calc(100dvh-3.5rem)] bg-surface-0 text-text-primary">{children}</div>
}
