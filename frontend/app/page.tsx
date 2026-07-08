"use client";

import { UserMenu } from "@/components/UserMenu";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    router.push(`/${symbol}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <MotionBackgroundGlow />
      <div className="absolute right-4 top-4 z-20">
        <UserMenu />
      </div>
      <div className="relative z-10 w-full max-w-xl text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-emerald-400/90">
          Claude × FMP
        </p>
        <h1 className="mb-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Valuation App
        </h1>
        <p className="mb-10 text-zinc-400">
          Enter a ticker to run an agentic DCF model with live financial data.
        </p>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="flex-1 rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-lg text-white outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-6 py-3 text-lg font-medium text-white transition hover:bg-accent-muted"
          >
            Value
          </button>
        </form>
        <p className="mt-8 text-xs text-zinc-600">
          Outputs are analyst drafts for review — not investment advice.
        </p>
        <div className="mt-10 rounded-xl border border-surface-border bg-surface-card/80 p-4 text-left">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Browse by Industry</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["banking", "Banking"],
              ["pharma", "Pharma"],
              ["technology", "Technology"],
              ["automobiles", "Automobiles"],
              ["energy", "Energy"],
              ["real-estate", "Real Estate"],
            ].map(([slug, label]) => (
              <Link
                key={slug}
                href={`/industry/${slug}`}
                className="rounded-full border border-surface-border px-3 py-1.5 text-xs text-zinc-300 transition hover:border-amber-500/60 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function MotionBackgroundGlow() {
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
