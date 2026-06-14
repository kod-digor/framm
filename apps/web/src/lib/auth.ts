import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { isDbUnavailableError } from "@/lib/auth-errors";
import { prisma } from "@/lib/prisma";
import { getDefaultMembership, getMembership } from "@/lib/tenant";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    organizationId: string | null;
    organizationStatus?: string | null;
    membershipRole?: UserRole | null;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      organizationId: string | null;
      organizationStatus?: string | null;
      membershipRole?: UserRole | null;
      mustChangePassword?: boolean;
    };
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.toLowerCase().trim();
        const password = credentials?.password as string;
        if (!email || !password) return null;

        try {
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          const membership = await getDefaultMembership(user.id);

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            organizationId: membership?.organizationId ?? null,
            organizationStatus: membership?.organization.status ?? null,
            membershipRole: membership?.role ?? null,
            mustChangePassword: user.mustChangePassword,
          };
        } catch (err) {
          if (isDbUnavailableError(err)) throw err;
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationStatus = user.organizationStatus;
        token.membershipRole = user.membershipRole;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }

      if (trigger === "update" && session?.user) {
        const orgId = session.user.organizationId as string | null;
        if (orgId && token.id) {
          const member = await getMembership(token.id as string, orgId);
          if (member) {
            token.organizationId = member.organizationId;
            token.organizationStatus = member.organization.status;
            token.membershipRole = member.role;
          }
        }
      }

      if (token.id && !user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { mustChangePassword: true },
          });
          if (dbUser) {
            token.mustChangePassword = dbUser.mustChangePassword;
          }
        } catch (err) {
          if (isDbUnavailableError(err)) throw err;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user) return session;

      const user = await prisma.user.findUnique({ where: { id: token.id as string } });
      if (!user) {
        session.user.organizationId = null;
        session.user.organizationStatus = null;
        session.user.membershipRole = null;
        return session;
      }

      session.user.id = user.id;
      session.user.email = user.email;
      session.user.role = user.role;
      session.user.mustChangePassword = user.mustChangePassword;

      const activeOrgId = (token.organizationId as string | null) ?? null;
      if (activeOrgId) {
        const member = await getMembership(user.id, activeOrgId);
        if (member) {
          session.user.organizationId = member.organizationId;
          session.user.organizationStatus = member.organization.status;
          session.user.membershipRole = member.role;
          return session;
        }
      }

      const fallback = await getDefaultMembership(user.id);
      session.user.organizationId = fallback?.organizationId ?? null;
      session.user.organizationStatus = fallback?.organization.status ?? null;
      session.user.membershipRole = fallback?.role ?? null;
      return session;
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path.startsWith("/change-password")) {
        return !!auth?.user;
      }
      if (path.startsWith("/bureau")) {
        return auth?.user?.role === "BUREAU";
      }
      if (path.startsWith("/dashboard")) {
        if (!auth?.user) return false;
        if (auth.user.mustChangePassword) return false;
        if (auth.user.role === "BUREAU") return !!auth.user.organizationId;
        return auth.user.membershipRole === "ASSOC_ADMIN";
      }
      return true;
    },
  },
  trustHost: true,
});
