export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect all routes except login, auth callbacks, and static assets.
     * Includes /api/valuation and /api/export (session required).
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
