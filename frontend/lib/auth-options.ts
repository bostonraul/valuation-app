import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[auth] Missing required environment variable: ${name}`);
    return "";
  }
  return value;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  secret: requireEnv("NEXTAUTH_SECRET"),
  debug: process.env.NODE_ENV === "development",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn({ profile }) {
      const allowed = process.env.ALLOWED_EMAIL_DOMAINS?.trim();
      if (!allowed) return true;
      const email = profile?.email ?? "";
      return allowed
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .some((domain) => email.toLowerCase().endsWith(`@${domain}`));
    },
  },
};
