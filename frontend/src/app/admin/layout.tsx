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
  return <div className="min-h-screen bg-[#030712] text-white selection:bg-[#00FF88] selection:text-black">{children}</div>
}
