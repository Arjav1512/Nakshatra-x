import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-[1200px] items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-sm text-text-secondary">Loading sign-in…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
