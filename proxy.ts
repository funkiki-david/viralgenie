import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match every page route EXCEPT:
     * - /api/*       (API routes return 401 via getServerSession; never redirect)
     * - /login       (public login page)
     * - /_next/*     (Next.js internals: chunks, images, hmr, etc.)
     * - /favicon.ico
     */
    "/((?!api/|login|_next/|favicon.ico).*)",
  ],
};
