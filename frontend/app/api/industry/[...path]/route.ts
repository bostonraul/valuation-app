import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { backendHeaders, getBackendUrl } from "@/lib/server-api";

/** Allow longer industry agent runs (profile / batch news enrich). */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ detail: "Sign in required" }, { status: 401 });
  }

  const { path } = await context.params;
  const base = getBackendUrl();
  if (!base) {
    return NextResponse.json(
      { detail: "API_URL is not configured on the server" },
      { status: 500 }
    );
  }

  const suffix = path.map(encodeURIComponent).join("/");
  const query = request.nextUrl.searchParams.toString();
  const target = `${base}/api/industry/${suffix}${query ? `?${query}` : ""}`;

  let res: Response;
  try {
    res = await fetch(target, {
      method: "GET",
      headers: backendHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(110_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream request failed";
    return NextResponse.json(
      {
        detail:
          "Industry backend timed out or is unreachable. " +
          "Render may still be generating — refresh in 30s. " +
          `(${message})`,
      },
      { status: 504 }
    );
  }

  const text = await res.text();
  if (!res.ok) {
    // Avoid dumping Render/HTML error pages into the UI.
    let detail = text;
    if (text.trim().startsWith("<") || text.includes("Bad Gateway")) {
      detail =
        "Industry backend returned a gateway error (likely timeout while Claude was generating). " +
        "Refresh once; subsequent loads use cache.";
    } else {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.detail) detail = String(parsed.detail);
      } catch {
        detail = text.slice(0, 400);
      }
    }
    return NextResponse.json({ detail }, { status: res.status });
  }

  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
