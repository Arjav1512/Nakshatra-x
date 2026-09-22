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
    const rows = users.map((u) => [
      `"${u.id}"`,
      `"${u.full_name || ''}"`,
      `"${u.email || ''}"`,
      `"${u.role || 'operator'}"`,
      `"${u.provider || 'Supabase'}"`,
      `"${u.created_at || ''}"`,
      `"${u.last_sign_in_at || ''}"`,
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
    <div className="min-h-screen bg-[#030712] text-white p-4 sm:p-8 font-mono bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.1),rgba(255,255,255,0))]">
      <div className="max-w-7xl mx-auto">
        {/* ================= TOP COMMANDER HEADER ================= */}
        <header className="border-b border-white/10 pb-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8] shadow-[0_0_30px_rgba(56,189,248,0.25)]">
              <Orbit size={26} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white">
                  GLOBAL COMMAND CENTER
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#FF2E63]/15 border border-[#FF2E63]/40 text-[#FF2E63]">
                  LEVEL-5 OMEGA
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-2">
                <span>Primary Commander:</span>
                <span className="text-[#38BDF8] font-bold">
                  {adminInfo?.full_name || 'Commander Rupraj Datta'}
                </span>
                <span className="text-slate-600">&bull;</span>
                <span className="text-[#00FF88] flex items-center gap-1">
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
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-200 px-3.5 py-2 rounded-xl border border-white/10 hover:border-[#38BDF8]/40 text-xs transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loadingUsers ? 'animate-spin text-[#38BDF8]' : ''} />
              <span>Sync</span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 px-3.5 py-2 rounded-xl border border-white/10 text-xs transition-colors"
            >
              <ExternalLink size={13} />
              <span>Live Site</span>
            </Link>

            <button type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-[#FF2E63]/10 hover:bg-[#FF2E63]/20 text-[#FF2E63] px-4 py-2 rounded-xl border border-[#FF2E63]/30 hover:border-[#FF2E63] text-xs transition-all cursor-pointer shadow-sm"
            >
              <LogOut size={14} />
              <span>Terminate Session</span>
            </button>
          </div>
        </header>

        {/* ================= KEY METRICS GRID ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Total Registered */}
          <div className="p-5 rounded-2xl bg-[#090D16]/90 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] uppercase tracking-wider font-bold">Total Users</span>
              <Users size={16} className="text-[#38BDF8]" />
            </div>
            <div className="text-3xl font-black text-white">{users.length}</div>
            <div className="text-[10px] text-[#00FF88] mt-1 flex items-center gap-1">
              <Activity size={10} /> Live Supabase Registry Sync
            </div>
          </div>

          {/* Card 2: Google OAuth Users */}
          <div className="p-5 rounded-2xl bg-[#090D16]/90 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] uppercase tracking-wider font-bold">Google Sign-Ins</span>
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
            <div className="text-3xl font-black text-[#38BDF8]">{googleCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">Verified Google OAuth Accounts</div>
          </div>

          {/* Card 3: Email OTP Logins */}
          <div className="p-5 rounded-2xl bg-[#090D16]/90 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] uppercase tracking-wider font-bold">Email Logins</span>
              <Mail size={16} className="text-[#00FF88]" />
            </div>
            <div className="text-3xl font-black text-[#00FF88]">{emailCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">OTP Verified Inboxes</div>
          </div>

          {/* Card 4: Single Admin Lock Status */}
          <div className="p-5 rounded-2xl bg-[#090D16]/90 border border-[#00FF88]/30 shadow-[0_0_30px_rgba(0,255,136,0.1)] relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] uppercase tracking-wider font-bold">Admin Slot</span>
              <Lock size={16} className="text-[#00FF88]" />
            </div>
            <div className="text-2xl font-black text-[#00FF88]">LOCKED 1/1</div>
            <div className="text-[10px] text-[#94A3B8] mt-1">Single Administrator Sealed</div>
          </div>
        </div>

        {/* ================= NAVIGATION TABS ================= */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-6">
          <button type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#38BDF8]/20 border border-[#38BDF8] text-[#38BDF8] shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>User Sign-In Database ({users.length})</span>
          </button>

          <button type="button"
            onClick={() => setActiveTab('operations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'operations'
                ? 'bg-[#00FF88]/20 border border-[#00FF88] text-[#00FF88] shadow-[0_0_20px_rgba(0,255,136,0.2)]'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
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
            <div className="p-4 rounded-2xl bg-[#090D16]/90 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search size={15} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, email, or user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-black/60 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] transition-colors"
                />
              </div>

              {/* Provider Filter Buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <span className="text-[10px] uppercase text-slate-500 mr-1 flex items-center gap-1">
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
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors cursor-pointer whitespace-nowrap ${
                      selectedProvider === f.id
                        ? 'bg-[#38BDF8] text-black'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>


              {/* Export Button */}
              <button type="button"
                onClick={exportUsersCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00FF88]/15 hover:bg-[#00FF88]/25 border border-[#00FF88]/40 text-[#00FF88] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-[#090D16]/90 border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden">
              {loadingUsers ? (
                <div className="p-16 flex flex-col items-center justify-center text-slate-400">
                  <Orbit className="animate-spin text-[#38BDF8] h-8 w-8 mb-3" />
                  <p className="text-xs">Connecting to Supabase User Registry...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-16 text-center text-slate-500">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold uppercase tracking-widest">No matching users found</p>
                  <p className="text-[11px] text-slate-600 mt-1">Users will appear here once they log in.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/5 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
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
                          <tr key={u.id} className="hover:bg-white/5 transition-colors">
                            {/* Operator Name & 3D Robot DP */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <CyberRobotAvatar
                                  size="sm"
                                  className="h-8 w-8 shrink-0 border border-[#00FF88] shadow-[0_0_12px_rgba(0,255,136,0.35)]"
                                />
                                <div>
                                  <div className="font-bold text-white text-xs">{u.full_name || 'Anonymous User'}</div>
                                  <div className="text-[10px] text-slate-500">Active Operator</div>
                                </div>
                              </div>
                            </td>



                            {/* Email */}
                            <td className="px-5 py-3.5 text-[#38BDF8] font-mono">
                              <a href={`mailto:${u.email}`} className="hover:underline flex items-center gap-1">
                                <Mail size={11} className="text-slate-500" />
                                {u.email}
                              </a>
                            </td>

                            {/* Provider */}
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  isGoogle
                                    ? 'bg-blue-500/10 border-blue-500/30 text-[#38BDF8]'
                                    : isEmail
                                    ? 'bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]'
                                    : 'bg-white/5 border-white/10 text-slate-300'
                                }`}
                              >
                                {isGoogle ? 'Google OAuth' : isEmail ? 'Email OTP' : u.provider || 'Session'}
                              </span>
                            </td>

                            {/* Role */}
                            <td className="px-5 py-3.5">
                              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 text-[10px] font-bold uppercase">
                                {u.role || 'Operator'}
                              </span>
                            </td>

                            {/* User ID & Copy */}
                            <td className="px-5 py-3.5 text-slate-400 font-mono text-[10px]">
                              <button type="button"
                                onClick={() => copyToClipboard(u.id)}
                                title="Click to copy ID"
                                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer group"
                              >
                                <span>{u.id ? `${u.id.slice(0, 8)}...` : 'N/A'}</span>
                                {copiedId === u.id ? (
                                  <Check size={11} className="text-[#00FF88]" />
                                ) : (
                                  <Copy size={11} className="text-slate-600 group-hover:text-slate-300" />
                                )}
                              </button>
                            </td>

                            {/* Last Active */}
                            <td className="px-5 py-3.5 text-slate-400 text-[11px] whitespace-nowrap">
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
                            <td className="px-5 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
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
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Pickaxe className="text-[#38BDF8]" size={18} /> Active Mining Operations Management
              </h2>
              <button type="button"
                onClick={handleSaveMines}
                disabled={savingMines}
                className="flex items-center gap-2 bg-[#00FF88]/20 hover:bg-[#00FF88]/30 text-[#00FF88] px-4 py-2 rounded-xl border border-[#00FF88]/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_20px_rgba(0,255,136,0.2)]"
              >
                <Save size={14} />
                <span>{savingMines ? 'Saving...' : 'Save Operations Target'}</span>
              </button>
            </div>

            <div className="bg-[#090D16]/90 border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/5 text-slate-400 uppercase text-[10px]">
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
                      <tr key={mine.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-white">{mine.name}</td>
                        <td className="px-6 py-4 text-slate-400">{mine.state}</td>
                        <td className="px-6 py-4 text-slate-400 font-mono">{mine.lat}</td>
                        <td className="px-6 py-4 text-slate-400 font-mono">{mine.lng}</td>
                        <td className="px-6 py-4 text-right">
                          <input
                            type="number"
                            value={mine.targetTonnes}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setMines((prev) => ({
                                ...prev,
                                [mine.id]: { ...prev[mine.id], targetTonnes: val },
                              }))
                            }}
                            className="bg-black/60 border border-white/15 rounded-lg py-1.5 px-3 text-right text-xs font-mono text-[#00FF88] focus:outline-none focus:border-[#00FF88] w-36"
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
