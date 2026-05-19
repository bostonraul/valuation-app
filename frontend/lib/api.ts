import type { ValuationResult } from "./types";

/** Browser calls same-origin Next.js API routes (auth-protected proxies). */
export function getApiBase(): string {
  if (typeof window !== "undefined") return "";
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
    /\/$/,
    ""
  );
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
    let detail = `Export failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) detail = String(err.detail);
    } catch {
      const text = await res.text();
      if (text) detail = text.slice(0, 200);
    }
    throw new Error(detail);
  }
  return res.blob();
}
