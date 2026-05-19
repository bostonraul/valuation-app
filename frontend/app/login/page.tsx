"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";

type Diag = {
  ok: boolean;
  issues: string[];
  checks: {
    GOOGLE_CLIENT_ID: boolean;
    GOOGLE_CLIENT_SECRET: boolean;
    NEXTAUTH_SECRET: boolean;
    NEXTAUTH_URL: string | null;
    expectedGoogleRedirectUri: string;
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin:
    "Google sign-in could not start. Usually NEXTAUTH_URL or Google redirect URIs do not match your site URL.",
  OAuthCallback:
    "Google returned an error. Check redirect URI and that your email is allowed (Google test mode).",
  OAuthCreateAccount: "Could not create your account.",
  AccessDenied:
    "Access denied. Your email domain may not be on the allow list (ALLOWED_EMAIL_DOMAINS).",
  Configuration:
    "Server misconfiguration: check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXTAUTH_SECRET on Vercel.",
  Default: "Sign-in failed. See checklist below.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default
    : null;
  const [diag, setDiag] = useState<Diag | null>(null);

  useEffect(() => {
    fetch("/api/auth/diag")
      .then((r) => r.json())
      .then(setDiag)
      .catch(() => null);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <BackgroundGlow />
      <div className="relative z-10 w-full max-w-md text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-emerald-400/90">
          Valuation App
        </p>
        <h1 className="mb-2 text-3xl font-semibold text-white">Sign in to continue</h1>
        <p className="mb-6 max-w-sm text-zinc-400">
          Use your Google account. Only signed-in users can run valuations and export
          models.
        </p>

        {diag && !diag.ok && (
          <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-left text-sm text-amber-100">
            <p className="font-medium">Server configuration issue</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-200/90">
              {diag.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            {diag.checks.NEXTAUTH_URL && (
              <p className="mt-2 text-xs text-amber-300/80">
                Server NEXTAUTH_URL:{" "}
                <code className="break-all">{diag.checks.NEXTAUTH_URL}</code>
              </p>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-left text-sm text-red-200">
            <p className="font-medium">Sign-in error{errorCode ? `: ${errorCode}` : ""}</p>
            <p className="mt-1 text-red-300/90">{errorMessage}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-lg border border-zinc-600 bg-white px-6 py-3 text-base font-medium text-zinc-900 transition hover:bg-zinc-100"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <details className="mt-8 max-w-sm text-left text-xs text-zinc-500">
          <summary className="cursor-pointer text-zinc-400">Fix checklist (OAuthSignin)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              Vercel <code className="text-zinc-400">NEXTAUTH_URL</code> must be exactly{" "}
              <code className="text-emerald-400/90">https://valueai.startupworth.online</code>{" "}
              (no trailing slash).
            </li>
            <li>
              Google Console → redirect URI:{" "}
              <code className="break-all text-emerald-400/90">
                https://valueai.startupworth.online/api/auth/callback/google
              </code>
            </li>
            <li>Google Console → JavaScript origin: https://valueai.startupworth.online</li>
            <li>Redeploy Vercel after changing env vars.</li>
            <li>If app is in Testing mode, add your Gmail under OAuth consent → Test users.</li>
          </ol>
        </details>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-zinc-400">
          Loading…
        </main>
      }
    >
      <LoginContent />
    </Suspense>
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
