"use client";

import { useState } from "react";
import { exportValuationExcel } from "@/lib/api";
import type { ValuationResult } from "@/lib/types";

export function ExportButton({
  ticker,
  data,
}: {
  ticker: string;
  data: ValuationResult;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const blob = await exportValuationExcel(ticker, data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ticker}_valuation.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="rounded-lg border border-surface-border bg-surface-raised px-4 py-2 text-sm font-medium text-white transition hover:border-emerald-500/40 hover:bg-surface-card disabled:opacity-50"
    >
      {loading ? "Exporting…" : "Export to Excel"}
    </button>
  );
}
