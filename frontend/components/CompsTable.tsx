import type { CompRow } from "@/lib/types";
import { formatMultiple, formatPct } from "@/lib/format";

export function CompsTable({ comps }: { comps?: CompRow[] }) {
  if (!comps?.length) return null;

  return (
    <section className="overflow-x-auto rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
        Trading comps
      </h3>
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-zinc-500">
            <th className="py-2 pr-4">Ticker</th>
            <th className="py-2 px-2">EV/EBITDA</th>
            <th className="py-2 px-2">P/E</th>
            <th className="py-2 px-2">Rev growth</th>
            <th className="py-2 px-2">EBITDA margin</th>
          </tr>
        </thead>
        <tbody>
          {comps.map((c) => (
            <tr key={c.ticker} className="border-b border-surface-border/50">
              <td className="py-2 pr-4 font-medium text-white">{c.ticker}</td>
              <td className="py-2 px-2 font-mono">{formatMultiple(c.ev_ebitda)}</td>
              <td className="py-2 px-2 font-mono">{formatMultiple(c.pe)}</td>
              <td className="py-2 px-2 font-mono">{formatPct(c.revenue_growth)}</td>
              <td className="py-2 px-2 font-mono">{formatPct(c.ebitda_margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
