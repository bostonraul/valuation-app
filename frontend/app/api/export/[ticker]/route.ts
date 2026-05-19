import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { backendHeaders, getBackendUrl } from "@/lib/server-api";

export async function POST(
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

  const body = await request.text();
  const url = `${base}/api/export/${encodeURIComponent(ticker.toUpperCase())}`;

  const res = await fetch(url, {
    method: "POST",
    headers: backendHeaders(),
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { detail: text || `Export failed (${res.status})` },
      { status: res.status }
    );
  }

  const blob = await res.arrayBuffer();
  const disposition =
    res.headers.get("Content-Disposition") ??
    `attachment; filename="${ticker.toUpperCase()}_valuation.xlsx"`;

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": disposition,
    },
  });
}
