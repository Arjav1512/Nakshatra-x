import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Starfield } from "@/components/nakshatra/sections";

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-black text-text-primary">
      <Starfield />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-4 pt-20 pb-10">
        <Suspense fallback={<div className="text-text-secondary font-mono text-sm">Loading mission console...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

