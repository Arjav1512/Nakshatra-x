'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Orbit,
  LogOut,
  Users,
  ShieldCheck,
  Lock,
  Search,
  RefreshCw,
  Download,
  Mail,
  Activity,
  ExternalLink,
  Copy,
  Check,
  Filter,
  Save,
  Pickaxe,
} from 'lucide-react'
import type { MineInfo } from '@/components/mission-control/types'
import { CyberRobotAvatar } from '@/components/auth/CyberRobotAvatar'


interface RegisteredUser {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: string
  provider?: string
  last_sign_in_at?: string | null
  created_at: string
}

export default function AdminDashboard() {
  const router = useRouter()

  // Tab State: 'users' or 'operations'
  const [activeTab, setActiveTab] = useState<'users' | 'operations'>('users')

  // Users State
  const [users, setUsers] = useState<RegisteredUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Mining Operations State
  const [mines, setMines] = useState<Record<string, MineInfo>>({})
  const [loadingMines, setLoadingMines] = useState(false)
  const [savingMines, setSavingMines] = useState(false)

  // Auth / Admin Status
  const [adminInfo, setAdminInfo] = useState<any>(null)

  // 1. Enforce Client-Side Authentication
  useEffect(() => {
    if (!document.cookie.includes('admin_session=true')) {
      router.push('/admin/login')
      return
    }
    fetchUserData()
    fetchMines()
    fetchAdminStatus()
  }, [router])

  const fetchAdminStatus = async () => {
    try {
      const res = await fetch('/api/admin/setup')
      const data = await res.json()
      setAdminInfo(data.adminUser || null)
    } catch {
      // Ignored
    }
  }

  const fetchUserData = async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/profiles')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error('Failed to fetch user profiles:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchMines = async () => {
    setLoadingMines(true)
    try {
      const res = await fetch('/api/admin/mines')
      if (res.ok) {
        const data = await res.json()
        setMines(data)
      }
    } catch {
      // Ignored
    } finally {
      setLoadingMines(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' })
    } catch {
      // Fall through
    }
    document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/admin/login')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 1800)
  }

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        u.full_name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.id?.toLowerCase().includes(query)

      const prov = (u.provider || '').toLowerCase()
      const matchesProvider =
        selectedProvider === 'all' ||
        (selectedProvider === 'google' && prov.includes('google')) ||
        (selectedProvider === 'email' && (prov.includes('email') || prov.includes('otp'))) ||
        (selectedProvider === 'guest' && prov.includes('guest')) ||
        (selectedProvider === 'admin' && (prov.includes('admin') || prov.includes('sealed') || prov.includes('master')))

      return matchesSearch && matchesProvider
    })
  }, [users, searchQuery, selectedProvider])

  // Analytics Metrics
  const googleCount = users.filter((u) => (u.provider || '').toLowerCase().includes('google')).length
  const emailCount = users.filter((u) => {
    const p = (u.provider || '').toLowerCase()
    return p.includes('email') || p.includes('otp')
  }).length
  const adminCount = users.filter((u) => {
    const p = (u.provider || '').toLowerCase()
    return p.includes('admin') || p.includes('sealed') || p.includes('master')
  }).length

  // Export Users as CSV
  const exportUsersCSV = () => {
    const headers = ['User ID', 'Full Name', 'Email', 'Role', 'Provider', 'Created At', 'Last Sign In']
    const rows = users.map((u) => [ `"${u.id}"`, `"${u.full_name || ''}"`, `"${u.email || ''}"`, `"${u.role || 'operator'}"`, `"${u.provider || 'Supabase'}"`, `"${u.created_at || ''}"`, `"${u.last_sign_in_at || ''}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `nakshatra_users_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSaveMines = async () => {
    setSavingMines(true)
    try {
      const res = await fetch('/api/admin/mines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mines),
      })
      if (res.ok) {
        alert('Mining telemetry and operations updated successfully.')
      } else {
        alert('Failed to save operations.')
      }
    } catch {
      alert('Error updating operations.')
    } finally {
      setSavingMines(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-text-primary p-4 sm:p-8 font-mono bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.1),rgba(255,255,255,0))]">
      <div className="max-w-7xl mx-auto">
        {/* ================= TOP COMMANDER HEADER ================= */}
        <header className="border-b border-border-default pb-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-md bg-accent/10 border border-accent/40 flex items-center justify-center text-accent">
              <Orbit size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-widest text-text-primary">
                  GLOBAL COMMAND CENTER
                </h1>
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-status-critical/15 border border-status-critical/40 text-status-critical">
                  LEVEL-5 OMEGA
                </span>
              </div>
              <p className="text-xs text-text-tertiary mt-0.5 flex items-center gap-2">
                <span>Primary Commander:</span>
                <span className="text-accent font-bold">
                  {adminInfo?.full_name || 'Commander Rupraj Datta'}
                </span>
                <span className="text-text-tertiary">&bull;</span>
                <span className="text-accent flex items-center gap-1">
                  <ShieldCheck size={12} /> Slot Sealed (1/1)
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => {
                fetchUserData()
                fetchMines()
              }}
              className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 text-text-primary px-3.5 py-2 rounded-md border border-border-default hover:border-accent/40 text-xs transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={loadingUsers ? 'animate-spin text-accent' : ''} />
              <span>Sync</span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary px-3.5 py-2 rounded-md border border-border-default text-xs transition-colors"
            >
              <ExternalLink size={13} />
              <span>Live Site</span>
            </Link>

            <button type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-status-critical/10 hover:bg-status-critical/20 text-status-critical px-4 py-2 rounded-md border border-status-critical/30 hover:border-status-critical text-xs transition-colors cursor-pointer shadow-sm"
            >
              <LogOut size={14} />
              <span>Terminate Session</span>
            </button>
          </div>
        </header>

        {/* ================= KEY METRICS GRID ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Total Registered */}
          <div className="p-5 rounded-md bg-surface-1/90 border border-border-default relative overflow-hidden ">
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-xs uppercase tracking-wider font-bold">Total Users</span>
              <Users size={16} className="text-accent" />
            </div>
            <div className="text-3xl font-semibold text-text-primary">{users.length}</div>
            <div className="text-xs text-accent mt-1 flex items-center gap-1">
              <Activity size={10} /> Live Supabase Registry Sync
            </div>
          </div>

          {/* Card 2: Google OAuth Users */}
          <div className="p-5 rounded-md bg-surface-1/90 border border-border-default relative overflow-hidden ">
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-xs uppercase tracking-wider font-bold">Google Sign-Ins</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div className="text-3xl font-semibold text-accent">{googleCount}</div>
            <div className="text-xs text-text-secondary mt-1">Verified Google OAuth Accounts</div>
          </div>

          {/* Card 3: Email OTP Logins */}
          <div className="p-5 rounded-md bg-surface-1/90 border border-border-default relative overflow-hidden ">
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-xs uppercase tracking-wider font-bold">Email Logins</span>
              <Mail size={16} className="text-accent" />
            </div>
            <div className="text-3xl font-semibold text-accent">{emailCount}</div>
            <div className="text-xs text-text-secondary mt-1">OTP Verified Inboxes</div>
          </div>

          {/* Card 4: Single Admin Lock Status */}
          <div className="p-5 rounded-md bg-surface-1/90 border border-accent/30 relative overflow-hidden ">
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-xs uppercase tracking-wider font-bold">Admin Slot</span>
              <Lock size={16} className="text-accent" />
            </div>
            <div className="text-2xl font-semibold text-accent">LOCKED 1/1</div>
            <div className="text-xs text-text-tertiary mt-1">Single Administrator Sealed</div>
          </div>
        </div>

        {/* ================= NAVIGATION TABS ================= */}
        <div className="flex items-center gap-2 border-b border-border-default pb-4 mb-6">
          <button type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-accent/20 border border-accent text-accent'
                : 'bg-surface-2 border border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            <Users size={14} />
            <span>User Sign-In Database ({users.length})</span>
          </button>

          <button type="button"
            onClick={() => setActiveTab('operations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'operations'
                ? 'bg-accent/20 border border-accent text-accent'
                : 'bg-surface-2 border border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            <Pickaxe size={14} />
            <span>Mining Operations CRUD</span>
          </button>
        </div>

        {/* ================= TAB 1: USERS DATABASE ================= */}
        {activeTab === 'users' && (
          <section className="space-y-4">
            {/* Search, Filter & Export Toolbar */}
            <div className="p-4 rounded-md bg-surface-1/90 border border-border-default flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search size={15} className="absolute left-3 top-3 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search by name, email, or user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surface-0/80 border border-border-default rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Provider Filter Buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <span className="text-xs uppercase text-text-tertiary mr-1 flex items-center gap-1">
                  <Filter size={11} /> Filter:
                </span>
                {[
                  { id: 'all', label: `All (${users.length})` },
                  { id: 'google', label: `Google (${googleCount})` },
                  { id: 'email', label: `Email (${emailCount})` },
                  { id: 'admin', label: `Admin (${adminCount})` },
                ].map((f) => (
                  <button type="button"
                    key={f.id}
                    onClick={() => setSelectedProvider(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer whitespace-nowrap ${
                      selectedProvider === f.id
                        ? 'bg-accent text-black'
                        : 'bg-surface-2 hover:bg-surface-3 text-text-secondary border border-border-default'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>


              {/* Export Button */}
              <button type="button"
                onClick={exportUsersCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="rounded-md bg-surface-1/90 border border-border-default overflow-hidden">
              {loadingUsers ? (
                <div className="p-16 flex flex-col items-center justify-center text-text-secondary">
                  <Orbit className="animate-spin text-accent h-8 w-8 mb-3" />
                  <p className="text-xs">Connecting to Supabase User Registry...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-16 text-center text-text-tertiary">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold uppercase tracking-widest">No matching users found</p>
                  <p className="text-xs text-text-tertiary mt-1">Users will appear here once they log in.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-2 text-text-secondary uppercase text-xs tracking-wider border-b border-border-default">
                      <tr>
                        <th className="px-5 py-3.5">Operator</th>
                        <th className="px-5 py-3.5">Email Address</th>
                        <th className="px-5 py-3.5">Auth Method</th>
                        <th className="px-5 py-3.5">Clearance Role</th>
                        <th className="px-5 py-3.5">User UUID</th>
                        <th className="px-5 py-3.5">Last Active</th>
                        <th className="px-5 py-3.5">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map((u) => {
                        const isGoogle = (u.provider || '').toLowerCase().includes('google')
                        const isEmail = (u.provider || '').toLowerCase().includes('email')

                        return (
                          <tr key={u.id} className="hover:bg-surface-2 transition-colors">
                            {/* Operator Name & 3D Robot DP */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <CyberRobotAvatar
                                  size="sm"
                                  className="h-8 w-8 shrink-0 border border-accent"
                                />
                                <div>
                                  <div className="font-bold text-text-primary text-xs">{u.full_name || 'Anonymous User'}</div>
                                  <div className="text-xs text-text-tertiary">Active Operator</div>
                                </div>
                              </div>
                            </td>



                            {/* Email */}
                            <td className="px-5 py-3.5 text-accent font-mono">
                              <a href={`mailto:${u.email}`} className="hover:underline flex items-center gap-1">
                                <Mail size={11} className="text-text-tertiary" />
                                {u.email}
                              </a>
                            </td>

                            {/* Provider */}
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                  isGoogle
                                    ? 'bg-accent/10 border-accent/30 text-accent'
                                    : isEmail
                                    ? 'bg-accent/10 border-accent/30 text-accent'
                                    : 'bg-surface-2 border-border-default text-text-secondary'
                                }`}
                              >
                                {isGoogle ? 'Google OAuth' : isEmail ? 'Email OTP' : u.provider || 'Session'}
                              </span>
                            </td>

                            {/* Role */}
                            <td className="px-5 py-3.5">
                              <span className="px-2 py-0.5 rounded bg-surface-2 border border-border-default text-text-secondary text-xs font-bold uppercase">
                                {u.role || 'Operator'}
                              </span>
                            </td>

                            {/* User ID & Copy */}
                            <td className="px-5 py-3.5 text-text-secondary font-mono text-xs">
                              <button type="button"
                                onClick={() => copyToClipboard(u.id)}
                                title="Click to copy ID"
                                className="flex items-center gap-1 hover:text-text-primary transition-colors cursor-pointer group"
                              >
                                <span>{u.id ? `${u.id.slice(0, 8)}...` : 'N/A'}</span>
                                {copiedId === u.id ? (
                                  <Check size={11} className="text-accent" />
                                ) : (
                                  <Copy size={11} className="text-text-tertiary group-hover:text-text-secondary" />
                                )}
                              </button>
                            </td>

                            {/* Last Active */}
                            <td className="px-5 py-3.5 text-text-secondary text-xs whitespace-nowrap">
                              {u.last_sign_in_at
                                ? new Date(u.last_sign_in_at).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Active Now'}
                            </td>

                            {/* Registered Date */}
                            <td className="px-5 py-3.5 text-text-tertiary text-xs whitespace-nowrap">
                              {u.created_at
                                ? new Date(u.created_at).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'N/A'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================= TAB 2: MINING OPERATIONS CRUD ================= */}
        {activeTab === 'operations' && (
          <section className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Pickaxe className="text-accent" size={18} /> Active Mining Operations Management
              </h2>
              <button type="button"
                onClick={handleSaveMines}
                disabled={savingMines}
                className="flex items-center gap-2 bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 rounded-md border border-accent/40 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <Save size={14} />
                <span>{savingMines ? 'Saving...' : 'Save Operations Target'}</span>
              </button>
            </div>

            <div className="bg-surface-1/90 border border-border-default rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-2 text-text-secondary uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">Site Name</th>
                      <th className="px-6 py-4">State</th>
                      <th className="px-6 py-4">Latitude</th>
                      <th className="px-6 py-4">Longitude</th>
                      <th className="px-6 py-4 text-right">Target (Tonnes/mo)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.values(mines).map((mine) => (
                      <tr key={mine.id} className="hover:bg-surface-2 transition-colors">
                        <td className="px-6 py-4 font-bold text-text-primary">{mine.name}</td>
                        <td className="px-6 py-4 text-text-secondary">{mine.state}</td>
                        <td className="px-6 py-4 text-text-secondary font-mono">{mine.lat}</td>
                        <td className="px-6 py-4 text-text-secondary font-mono">{mine.lng}</td>
                        <td className="px-6 py-4 text-right">
                          <input
                            type="number"
                            value={mine.targetTonnes}
                            onChange={(e) => {
                              // `parseFloat(value) || 0` turned an unparseable
                              // entry into a plan target of zero, which is a
                              // valid-looking number that every shortfall
                              // calculation downstream would use. An entry that
                              // is not a number is ignored instead.
                              const parsed = Number.parseFloat(e.target.value)
                              if (!Number.isFinite(parsed) || parsed < 0) return
                              setMines((prev) => ({
                                ...prev,
                                [mine.id]: { ...prev[mine.id], targetTonnes: parsed },
                              }))
                            }}
                            className="bg-surface-0/80 border border-border-default rounded-lg py-1.5 px-3 text-right text-xs font-mono text-accent focus:outline-none focus:border-accent w-36"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
