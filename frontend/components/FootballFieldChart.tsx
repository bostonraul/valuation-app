"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FootballFieldRow } from "@/lib/types";
import { formatUsd } from "@/lib/format";

export function FootballFieldChart({
  rows,
  currentPrice,
}: {
  rows?: FootballFieldRow[];
  currentPrice?: number;
}) {
  if (!rows?.length) return null;

  const chartData = rows.map((r) => ({
    method: r.method,
    low: r.low,
    high: r.high,
    mid: r.mid,
    span: [r.low, r.high] as [number, number],
    range: r.high - r.low,
  }));

  const allValues = rows.flatMap((r) => [r.low, r.high]);
  if (currentPrice != null) allValues.push(currentPrice);
  const minX = Math.min(...allValues) * 0.92;
  const maxX = Math.max(...allValues) * 1.08;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-400">
        Valuation football field
      </h3>
      {currentPrice != null && (
        <p className="mb-4 text-xs text-zinc-500">
          Market price {formatUsd(currentPrice)} shown as vertical line
        </p>
      )}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 8, right: 24, left: 120, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
            <XAxis
              type="number"
              domain={[minX, maxX]}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <YAxis
              type="category"
              dataKey="method"
              width={110}
              tick={{ fill: "#d4d4d8", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
              }}
              formatter={(value: number, name: string) => [
                formatUsd(value),
                name === "low" ? "Low" : name === "high" ? "High" : name,
              ]}
            />
            <Bar dataKey="low" stackId="ff" fill="transparent" />
            <Bar dataKey="range" stackId="ff" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="#10b981" fillOpacity={0.35} />
              ))}
            </Bar>
            {currentPrice != null && (
              <ReferenceLine
                x={currentPrice}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: "Market",
                  position: "top",
                  fill: "#f59e0b",
                  fontSize: 11,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
