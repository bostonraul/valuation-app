import type { ValuationResult } from "@/lib/types";
import { formatPct, formatUsd } from "@/lib/format";

const SCENARIOS = [
  { key: "bear" as const, label: "Bear", border: "border-red-500/30", accent: "text-red-400" },
  { key: "base" as const, label: "Base", border: "border-zinc-500/30", accent: "text-zinc-300" },
  { key: "bull" as const, label: "Bull", border: "border-emerald-500/30", accent: "text-emerald-400" },
];

export function ScenarioCards({ data }: { data: ValuationResult }) {
  const scenarios = data.scenarios ?? {};

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SCENARIOS.map(({ key, label, border, accent }) => {
        const s = scenarios[key];
        const upside = s?.upside_pct ?? 0;
        const positive = upside >= 0;
        return (
          <div
            key={key}
            className={`rounded-xl border bg-surface-card p-5 ${border}`}
          >
            <p className={`text-sm font-medium uppercase tracking-wide ${accent}`}>
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {formatUsd(s?.implied_price)}
            </p>
            <p
              className={`mt-1 text-sm font-medium ${
                positive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatPct(upside)} vs market
            </p>
            {s?.revenue_cagr != null && (
              <p className="mt-3 text-xs text-zinc-500">
                Rev CAGR {formatPct(s.revenue_cagr, 1)} · Terminal g{" "}
                {formatPct(s.terminal_growth, 1)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
