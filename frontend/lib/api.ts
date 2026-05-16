import type { ValuationResult } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getApiBase(): string {
  return API_URL.replace(/\/$/, "");
}

export async function fetchValuation(
  ticker: string,
  refresh = false
): Promise<ValuationResult> {
  const url = `${getApiBase()}/api/valuation/${encodeURIComponent(
    ticker.toUpperCase()
  )}${refresh ? "?refresh=true" : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Valuation failed (${res.status})`);
  }
  return res.json();
}

export async function exportValuationExcel(
  ticker: string,
  data: ValuationResult
): Promise<Blob> {
  const res = await fetch(
    `${getApiBase()}/api/export/${encodeURIComponent(ticker.toUpperCase())}`,
    {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  return res.blob();
}
