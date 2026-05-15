import type { WaccDetail } from "@/lib/types";
import { formatPct } from "@/lib/format";

export function WaccPanel({ wacc }: { wacc?: WaccDetail }) {
  if (!wacc) return null;

  const rows: { label: string; value?: number; asPct?: boolean }[] = [
    { label: "Risk-free rate", value: wacc.risk_free_rate, asPct: true },
    { label: "Beta", value: wacc.beta },
    { label: "Equity risk premium", value: wacc.equity_risk_premium, asPct: true },
    { label: "Cost of equity", value: wacc.cost_of_equity, asPct: true },
    { label: "Cost of debt", value: wacc.cost_of_debt, asPct: true },
    { label: "Tax rate", value: wacc.tax_rate, asPct: true },
    { label: "Debt weight", value: wacc.debt_weight, asPct: true },
    { label: "Equity weight", value: wacc.equity_weight, asPct: true },
    { label: "WACC", value: wacc.wacc, asPct: true },
  ];

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
        WACC build
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(({ label, value, asPct }) => (
          <div
            key={label}
            className="flex justify-between gap-4 border-b border-surface-border/50 py-2 text-sm"
          >
            <dt className="text-zinc-500">{label}</dt>
            <dd className="font-mono text-white">
              {value == null
                ? "—"
                : asPct
                  ? formatPct(value, 2)
                  : value.toFixed(2)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
