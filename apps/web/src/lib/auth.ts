import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    organizationId: string | null;
    organizationStatus?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      organizationId: string | null;
      organizationStatus?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          organizationStatus: user.organization?.status ?? null,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationStatus = user.organizationStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.organizationId = (token.organizationId as string) ?? null;
        session.user.organizationStatus = (token.organizationStatus as string) ?? null;
      }
      return session;
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path.startsWith("/bureau")) {
        return auth?.user?.role === "BUREAU";
      }
      if (path.startsWith("/dashboard")) {
        const role = auth?.user?.role;
        const status = auth?.user?.organizationStatus;
        if (!auth) return false;
        if (role === "BUREAU") return !!auth.user.organizationId;
        return (
          (role === "ASSOC_ADMIN" || role === "ASSOC_MEMBER") && status === "APPROVED"
        );
      }
      return true;
    },
  },
  trustHost: true,
});
