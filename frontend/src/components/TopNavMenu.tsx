'use client'

import React, { useState, } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Cpu,
  Activity,
  Layers,
  Menu,
  X,
  Box,
  Home,
  Sparkles,
  Info,
  CloudRain,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  shortLabel?: string
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  href: string
  badge?: string
  color?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'mission-control',
    label: 'Mission Control',
    shortLabel: 'Mission',
    icon: Home,
    href: '/',
    color: '#00FF88',
  },
  {
    id: 'evaluator',
    label: 'ML Studio',
    shortLabel: 'ML Studio',
    icon: Cpu,
    href: '/evaluator',
    color: '#FB923C',
  },
  {
    id: 'mine-twin',
    label: 'Mine Twin',
    shortLabel: 'Mine Twin',
    icon: Box,
    href: '/mine-twin',
    color: '#00FF88',
  },
  {
    id: 'flood-alert',
    label: 'Flood Alert',
    shortLabel: 'Flood Alert',
    icon: CloudRain,
    href: '/flood-alert',
    color: '#00E5FF',
  },
  {
    id: 'production',
    label: 'Production',
    shortLabel: 'Production',
    icon: Activity,
    href: '/production',
    color: '#38BDF8',
  },
  {
    id: 'blending',
    label: 'Ore Blending',
    shortLabel: 'Blending',
    icon: Layers,
    href: '/blending',
    color: '#FACC15',
  },
  {
    id: 'all-features',
    label: 'All Features',
    shortLabel: 'Features',
    icon: Sparkles,
    href: '/features',
    color: '#38BDF8',
  },
  {
    id: 'about',
    label: 'About',
    shortLabel: 'About',
    icon: Info,
    href: '/about',
    color: '#FF2E63',
  },
]

export default function TopNavMenu() {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const getActiveTab = () => {
    if (pathname === '/') return 'mission-control'
    if (pathname.startsWith('/evaluator')) return 'evaluator'
    if (pathname.startsWith('/mine-twin')) return 'mine-twin'
    if (pathname.startsWith('/flood-alert')) return 'flood-alert'
    if (pathname.startsWith('/production')) return 'production'
    if (pathname.startsWith('/blending')) return 'blending'
    if (pathname.startsWith('/features')) return 'all-features'
    if (pathname.startsWith('/about')) return 'about'
    return 'mission-control'
  }

  const activeTab = getActiveTab()

  const handleNavClick = (item: NavItem) => {
    setMobileMenuOpen(false)
    router.push(item.href)
  }

  return (
    <>
      {/* Desktop / Laptop Clean Liquid Glass Navigation Capsule */}
      <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-1.5 cyber-nav-pill px-2.5 lg:px-3 py-1.5 shadow-2xl max-w-full mx-auto flex-nowrap shrink border border-[#38BDF8]/40 bg-[#060C1B]/95 backdrop-blur-2xl rounded-full shadow-[0_0_25px_rgba(6,12,27,0.8)] overflow-hidden">
        {NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          const themeColor = item.color || '#38BDF8'
          const isSeparatorBefore = idx === 5

          return (
            <React.Fragment key={item.id}>
              {isSeparatorBefore && (
                <div className="h-3.5 w-px bg-white/20 mx-0.5 shrink-0" aria-hidden="true" />
              )}
              <button
                onClick={() => handleNavClick(item)}
                className={`px-2 lg:px-2.5 xl:px-3 py-1.5 rounded-full font-mono font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-white/15 text-white shadow-lg'
                    : 'bg-transparent text-slate-300 border-transparent hover:bg-white/10 hover:text-white'
                }`}
                style={
                  isActive
                    ? {
                        borderColor: themeColor,
                        boxShadow: `0 0 12px ${themeColor}50`,
                      }
                    : {}
                }
                type="button"
              >
                <Icon
                  size={13}
                  className="transition-colors duration-200 shrink-0"
                  style={{ color: isActive ? themeColor : '#38BDF8' }}
                />
                <span className="font-space text-[10.5px] lg:text-[11px] xl:text-[12px] font-extrabold uppercase tracking-wider">
                  <span className="xl:inline hidden">{item.label}</span>
                  <span className="xl:hidden inline">{item.shortLabel || item.label}</span>
                </span>
              </button>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Mobile / Small Tablet Hamburger Trigger */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden p-2 rounded-xl bg-[#081022]/90 border border-[#38BDF8]/40 text-[#38BDF8] hover:text-[#00FF88] shadow-lg transition-colors"
        aria-label="Toggle Menu"
        type="button"
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed top-[64px] md:top-[80px] left-0 right-0 p-4 bg-[#050914]/98 backdrop-blur-3xl border-b border-[#38BDF8]/30 shadow-2xl z-50 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[80vh] overflow-y-auto">
          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            const themeColor = item.color || '#38BDF8'
            const isSeparatorBefore = idx === 5

            return (
              <React.Fragment key={item.id}>
                {isSeparatorBefore && (
                  <div className="my-1 border-t border-white/10" aria-hidden="true" />
                )}
                <button
                  onClick={() => handleNavClick(item)}
                  className={`flex items-center justify-between p-3.5 rounded-xl transition-all duration-200 border cursor-pointer ${
                    isActive
                      ? 'bg-[#38BDF8]/20 text-white'
                      : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  }`}
                  style={isActive ? { borderColor: themeColor } : {}}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={16}
                      style={{ color: isActive ? themeColor : '#38BDF8' }}
                    />
                    <span className="font-space text-xs font-extrabold tracking-wider uppercase text-white">
                      {item.label}
                    </span>
                  </div>
                </button>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </>
  )
}

