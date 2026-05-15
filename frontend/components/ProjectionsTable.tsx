import type { ProjectionBase } from "@/lib/types";

function fmt(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${n.toFixed(0)}M`;
}

export function ProjectionsTable({ base }: { base?: ProjectionBase }) {
  if (!base?.years?.length) return null;

  const rows: { label: string; values: number[] | undefined }[] = [
    { label: "Revenue", values: base.revenue },
    { label: "EBITDA", values: base.ebitda },
    { label: "FCF", values: base.fcf },
  ];

  return (
    <section className="overflow-x-auto rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
        Base case projections ($M)
      </h3>
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-zinc-500">
            <th className="py-2 pr-4 font-medium">Line item</th>
            {base.years.map((y) => (
              <th key={y} className="py-2 px-2 font-mono font-medium">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(
            ({ label, values }) =>
              values?.length && (
                <tr key={label} className="border-b border-surface-border/50">
                  <td className="py-2 pr-4 text-zinc-400">{label}</td>
                  {values.map((v, i) => (
                    <td key={i} className="py-2 px-2 font-mono text-white">
                      {fmt(v)}
                    </td>
                  ))}
                </tr>
              )
          )}
        </tbody>
      </table>
    </section>
  );
}
