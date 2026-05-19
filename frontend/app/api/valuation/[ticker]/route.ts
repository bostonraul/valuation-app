import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { backendHeaders, getBackendUrl } from "@/lib/server-api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ detail: "Sign in required" }, { status: 401 });
  }

  const { ticker } = await context.params;
  const base = getBackendUrl();
  if (!base) {
    return NextResponse.json(
      { detail: "API_URL is not configured on the server" },
      { status: 500 }
    );
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const url = `${base}/api/valuation/${encodeURIComponent(
    ticker.toUpperCase()
  )}${refresh ? "?refresh=true" : ""}`;

  const res = await fetch(url, {
    headers: backendHeaders(),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { detail: text || `Backend error (${res.status})` },
      { status: res.status }
    );
  }

  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
