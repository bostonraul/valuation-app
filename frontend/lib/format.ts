export function formatUsd(value: number | undefined | null, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatBn(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${value.toFixed(1)}B`;
}

export function formatPct(value: number | undefined | null, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const n = Math.abs(value) <= 1 ? value * 100 : value;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatMultiple(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}x`;
}
