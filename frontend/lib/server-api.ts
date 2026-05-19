/** Server-only backend URL (Render). Never expose as NEXT_PUBLIC_. */
export function getBackendUrl(): string {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
  return url.replace(/\/$/, "");
}

export function backendHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.INTERNAL_API_KEY;
  if (key) {
    headers["X-Internal-Key"] = key;
  }
  return headers;
}
