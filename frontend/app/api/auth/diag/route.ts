import { NextResponse } from "next/server";

/** Safe auth config check — never exposes secrets. */
export async function GET() {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() ?? "";
  const hasGoogleId = Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
  const hasGoogleSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());
  const hasNextAuthSecret = Boolean(process.env.NEXTAUTH_SECRET?.trim());
  const hasApiUrl = Boolean(
    (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL)?.trim()
  );

  const expectedCallback =
    nextAuthUrl.replace(/\/$/, "") + "/api/auth/callback/google";

  const issues: string[] = [];

  if (!hasGoogleId) issues.push("GOOGLE_CLIENT_ID is missing on Vercel.");
  if (!hasGoogleSecret) issues.push("GOOGLE_CLIENT_SECRET is missing on Vercel.");
  if (!hasNextAuthSecret) issues.push("NEXTAUTH_SECRET is missing on Vercel.");
  if (!nextAuthUrl) {
    issues.push("NEXTAUTH_URL is missing on Vercel.");
  } else if (!nextAuthUrl.startsWith("https://")) {
    issues.push("NEXTAUTH_URL should start with https:// in production.");
  } else if (
    !nextAuthUrl.includes("valueai.startupworth.online") &&
    nextAuthUrl.includes("vercel.app")
  ) {
    issues.push(
      `NEXTAUTH_URL is "${nextAuthUrl}" but you are using valueai.startupworth.online — they must match.`
    );
  }

  if (!hasApiUrl) issues.push("API_URL is missing (valuation API proxy will fail after login).");

  return NextResponse.json({
    ok: issues.length === 0,
    issues,
    checks: {
      GOOGLE_CLIENT_ID: hasGoogleId,
      GOOGLE_CLIENT_SECRET: hasGoogleSecret,
      NEXTAUTH_SECRET: hasNextAuthSecret,
      NEXTAUTH_URL: nextAuthUrl || null,
      expectedGoogleRedirectUri: expectedCallback,
      API_URL: hasApiUrl,
    },
    googleConsole: {
      javascriptOrigin: "https://valueai.startupworth.online",
      redirectUri: "https://valueai.startupworth.online/api/auth/callback/google",
    },
  });
}
