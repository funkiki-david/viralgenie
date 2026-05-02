import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      locale: string;
      role: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    locale: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name?: string | null;
    locale: string;
    role: string;
  }
}
