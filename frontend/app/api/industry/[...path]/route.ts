import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { backendHeaders, getBackendUrl } from "@/lib/server-api";

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

  const res = await fetch(target, {
    method: "GET",
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
