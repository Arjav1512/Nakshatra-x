'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Orbit, LogOut, Users, Shield, ArrowLeft, RefreshCw } from 'lucide-react'
import { CyberRobotAvatar } from '@/components/auth/CyberRobotAvatar'


interface UserProfile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: string
  provider?: string
  created_at: string
}

export default function AdminProfilePage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!document.cookie.includes('admin_session=true')) {
      router.push('/admin/login')
      return
    }
    fetchUsers()
  }, [router])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/profiles')
      if (res.ok) {
        const data = await res.json()
        if (data.error) {
          setError(data.error)
        } else {
          setUsers(data.users || [])
        }
      } else {
        setError('Failed to fetch user profiles')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/admin/login')
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center border-b border-white/10 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-[#00FF88]" />
            <div>
              <h1 className="text-2xl font-bold tracking-widest text-[#00FF88]">USER DATABASE</h1>
              <p className="text-xs text-[#94A3B8] uppercase">Admin Only &bull; Mission Operator Registry</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button type="button"
              onClick={fetchUsers}
              className="flex items-center gap-2 bg-[#38BDF8]/20 text-[#38BDF8] px-4 py-2 rounded border border-[#38BDF8]/30 hover:bg-[#38BDF8]/30 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button type="button"
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 bg-white/5 text-white px-4 py-2 rounded border border-white/10 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/5 text-white px-4 py-2 rounded border border-white/10 hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Terminate
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[#FF2E63]/15 border border-[#FF2E63]/50 text-[#FF2E63] text-sm font-mono">
            {error}
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="text-[#38BDF8]" /> Registered Users ({users.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Orbit className="animate-spin text-[#38BDF8] h-8 w-8" />
            </div>
          ) : users.length === 0 ? (
            <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-12 text-center">
              <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-mono text-sm">
                No users found. Users will appear here after signing in with Google OAuth.
              </p>
            </div>
          ) : (
            <div className="bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 text-[#94A3B8] uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Avatar</th>
                    <th className="px-6 py-4">Full Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Provider</th>
                    <th className="px-6 py-4">User ID</th>
                    <th className="px-6 py-4">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <CyberRobotAvatar
                          size="sm"
                          className="h-9 w-9 shrink-0 border border-[#00FF88] shadow-[0_0_12px_rgba(0,255,136,0.35)]"
                        />
                      </td>

                      <td className="px-6 py-4 text-white font-bold">{user.full_name || 'N/A'}</td>
                      <td className="px-6 py-4 text-[#38BDF8]">{user.email || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-xs font-bold uppercase">
                          {user.role || 'operator'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#38BDF8] text-[11px] font-mono">
                          {user.provider || 'Supabase'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#94A3B8] text-xs max-w-[120px] truncate" title={user.id}>
                        {user.id?.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-[#94A3B8] text-xs">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        }) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
