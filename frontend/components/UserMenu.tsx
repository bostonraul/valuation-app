"use client";

import { signOut, useSession } from "next-auth/react";

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[180px] truncate text-sm text-zinc-400 sm:inline">
        {session.user.email}
      </span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-lg border border-surface-border px-3 py-2 text-xs text-zinc-400 transition hover:text-white"
      >
        Sign out
      </button>
    </div>
  );
}
