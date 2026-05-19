import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
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
