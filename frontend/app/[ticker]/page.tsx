"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CompsTable } from "@/components/CompsTable";
import { ExportButton } from "@/components/ExportButton";
import { FootballFieldChart } from "@/components/FootballFieldChart";
import { LoadingState } from "@/components/LoadingState";
import { ProjectionsTable } from "@/components/ProjectionsTable";
import { ScenarioCards } from "@/components/ScenarioCards";
import { UserMenu } from "@/components/UserMenu";
import { WaccPanel } from "@/components/WaccPanel";
import { fetchValuation } from "@/lib/api";
import { formatBn, formatUsd } from "@/lib/format";
import type { ValuationResult } from "@/lib/types";

export default function TickerPage() {
  const params = useParams();
  const ticker = String(params.ticker ?? "").toUpperCase();
  const [data, setData] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (refresh = false) => {
      if (!ticker) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchValuation(ticker, refresh);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load valuation");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [ticker]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  if (!ticker) {
    return (
      <main className="p-8 text-center text-zinc-400">
        Invalid ticker.{" "}
        <Link href="/" className="text-emerald-400 hover:underline">
          Go home
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-surface">
        <PageHeader ticker={ticker} />
        <LoadingState ticker={ticker} />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-surface px-4 py-16">
        <PageHeader ticker={ticker} onRefresh={() => load(true)} />
        <div className="mx-auto max-w-lg text-center">
          <p className="text-red-400">{error ?? "No data returned"}</p>
          <button
            type="button"
            onClick={() => load(true)}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm text-white"
          >
            Retry
          </button>
          <Link href="/" className="mt-4 block text-sm text-zinc-500 hover:text-white">
            ← Back to search
          </Link>
        </div>
      </main>
    );
  }

  const baseScenario = data.scenarios?.base;

  return (
    <main className="min-h-screen bg-surface pb-16">
      <PageHeader ticker={ticker} data={data} onRefresh={() => load(true)} />
      <DashboardContent>
        <section className="rounded-xl border border-surface-border bg-surface-card p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm text-zinc-500">
                {data.source === "cache" ? "Cached" : "Live"} ·{" "}
                {data.data_sources?.join(", ") ?? "FMP"}
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-white">
                {data.company_name ?? ticker}
              </h1>
              <p className="mt-2 max-w-3xl text-zinc-400">{data.summary}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500">Market price</p>
              <p className="text-3xl font-semibold text-amber-400">
                {formatUsd(data.current_price)}
              </p>
              {baseScenario?.implied_price != null && (
                <p className="mt-1 text-sm text-emerald-400">
                  Base implied {formatUsd(baseScenario.implied_price)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-6 text-sm text-zinc-500">
            <span>Market cap {formatBn(data.market_cap_bn)}</span>
            <span>EV {formatBn(data.enterprise_value_bn)}</span>
            {data.generated_at && (
              <span className="font-mono text-xs">
                Generated {new Date(data.generated_at).toLocaleString()}
              </span>
            )}
          </div>
        </section>

        <ScenarioCards data={data} />
        <FootballFieldChart
          rows={data.football_field}
          currentPrice={data.current_price}
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <WaccPanel wacc={data.wacc} />
          <ProjectionsTable base={data.projections?.base} />
        </div>
        <CompsTable comps={data.comps} />
      </DashboardContent>
    </main>
  );
}

function PageHeader({
  ticker,
  data,
  onRefresh,
}: {
  ticker: string;
  data?: ValuationResult;
  onRefresh?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-surface-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-sm text-zinc-500 transition hover:text-white">
          ← Search
        </Link>
        <span className="font-mono text-lg font-semibold text-white">{ticker}</span>
        <div className="flex items-center gap-2">
          <UserMenu />
          {data && <ExportButton ticker={ticker} data={data} />}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-surface-border px-3 py-2 text-xs text-zinc-400 hover:text-white"
            >
              Refresh
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6">{children}</div>
  );
}
