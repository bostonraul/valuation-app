"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <BackgroundGlow />
      <div className="relative z-10 w-full max-w-md text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-emerald-400/90">
          Valuation App
        </p>
        <h1 className="mb-2 text-3xl font-semibold text-white">Sign in to continue</h1>
        <p className="mb-8 max-w-sm text-zinc-400">
          Use your Google account. Only signed-in users can run valuations and export
          models.
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="flex w-full max-w-sm items-center justify-center gap-3 rounded-lg border border-zinc-600 bg-white px-6 py-3 text-base font-medium text-zinc-900 transition hover:bg-zinc-100"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </main>
  );
}

function BackgroundGlow() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
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
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
