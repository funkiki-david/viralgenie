import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Passcode",
      credentials: {
        passcode: { label: "Passcode", type: "password" },
      },
      async authorize(credentials) {
        const expected = process.env.AUTH_PASSWORD;
        if (!expected) return null;
        if (!credentials?.passcode) return null;
        if (credentials.passcode !== expected) return null;
        return { id: "default", name: "ViralGenie User" };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
};
