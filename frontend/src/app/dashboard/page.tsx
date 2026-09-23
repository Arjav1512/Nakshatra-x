import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Starfield } from "@/components/nakshatra/sections";
import { GlassCard } from "@/components/nakshatra/ui";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { CyberRobotAvatar } from "@/components/auth/CyberRobotAvatar";
import Link from "next/link";
import { Shield, Key, Database, ArrowLeft, Cpu, Activity, Satellite } from "lucide-react";

export const dynamic = 'force-dynamic';


export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = user.full_name || "Orbital Operator";
  const avatarUrl = user.avatar_url;
  const role = user.role || "operator";
  const provider = user.provider || "Google OAuth";

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-black text-white">
      <Starfield />

      <main className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6 pt-24 md:pt-28 pb-16">
        {/* Header Breadcrumb */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#38BDF8]">
              <Link href="/" className="hover:underline flex items-center gap-1">
                <ArrowLeft size={12} /> Home
              </Link>
              <span>/</span>
              <span className="text-[#00FF88]">Commander Section</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-4xl font-black text-white tracking-tight">
              Orbital Operator Console
            </h1>
          </div>
          <LogoutButton />
        </div>

        {/* User Card & Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Commander Profile Card */}
          <GlassCard className="md:col-span-1 flex flex-col items-center text-center p-6 sm:p-8">
            {/* 3D Cyber Robot Avatar */}
            <div className="relative mb-4 flex items-center justify-center">
              <CyberRobotAvatar size="lg" className="h-24 w-24 border-2 border-[#00FF88] shadow-[0_0_30px_rgba(0,255,136,0.5)]" />
            </div>



            <h2 className="text-xl font-bold text-white">{fullName}</h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{user.email}</p>

            <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-xs font-mono font-bold uppercase tracking-wider">
              <Shield size={12} />
              <span>Role: {role}</span>
            </div>

            <div className="mt-6 w-full pt-6 border-t border-white/10 text-left space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>User ID:</span>
                <span className="text-slate-200 truncate max-w-[140px]">{user.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Auth Protocol:</span>
                <span className="text-[#38BDF8] font-bold">{provider}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>DP System:</span>
                <span className="text-[#00FF88] font-bold">Technical Rotating Robot</span>
              </div>
            </div>
          </GlassCard>

          {/* System Telemetry & Mission Controls */}
          <div className="md:col-span-2 space-y-6">
            <GlassCard className="p-6">
              <h3 className="text-base font-bold font-mono text-[#00FF88] uppercase tracking-wider flex items-center gap-2 mb-4">
                <Activity size={18} /> Authenticated Telemetry Access
              </h3>
              <p className="text-sm text-slate-300 mb-6">
                Your session is verified with a secure HTTP-only cookie. User access policies are enforced across all NAKSHATRA-X telemetry APIs.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#38BDF8] mb-1">
                    <Satellite size={14} /> Satellite Feed
                  </div>
                  <div className="text-lg font-bold text-white">Active</div>
                  <div className="text-[10px] text-slate-400 font-mono">Orbital Grid 04</div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#00FF88] mb-1">
                    <Database size={14} /> Profile Status
                  </div>
                  <div className="text-lg font-bold text-white">Authenticated</div>
                  <div className="text-[10px] text-slate-400 font-mono">Verified Session</div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#FACC15] mb-1">
                    <Key size={14} /> Session Token
                  </div>
                  <div className="text-lg font-bold text-white">Secure</div>
                  <div className="text-[10px] text-slate-400 font-mono">HTTP-Only Cookie</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu size={16} className="text-[#38BDF8]" /> Return to NAKSHATRA-X Main Command
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Access 3D GIS maps, ore blending ML modules, and live telemetry feeds on the main dashboard.
                </p>
              </div>
              <Link
                href="/#mission-control"
                className="px-5 py-2.5 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/50 text-[#00FF88] hover:bg-[#00FF88]/25 font-mono text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors shadow-[0_0_15px_rgba(0,255,136,0.25)]"
              >
                Launch Console
              </Link>
            </GlassCard>
          </div>
        </div>
      </main>
    </div>
  );
}
