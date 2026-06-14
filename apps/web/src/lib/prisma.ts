import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Delegates that must exist after `prisma generate` (stale dev singletons omit new models). */
const REQUIRED_DELEGATES = [
  "platformPricing",
  "userMailbox",
  "sharedMailboxMember",
  "mailboxDelegation",
  "mailboxFilter",
] as const;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function hasDelegate(client: PrismaClient, key: string): boolean {
  const delegate = (client as unknown as Record<string, unknown>)[key];
  if (typeof delegate !== "object" || delegate === null) return false;
  return typeof (delegate as { findFirst?: unknown }).findFirst === "function";
}

function isStalePrismaClient(client: PrismaClient): boolean {
  if (process.env.NODE_ENV !== "development") return false;

  return REQUIRED_DELEGATES.some((key) => !hasDelegate(client, key));
}

function initPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;

  if (cached && !isStalePrismaClient(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }

  const client = createPrismaClient();

  if (isStalePrismaClient(client)) {
    throw new Error(
      "Prisma client missing required model delegates. Run `pnpm exec prisma generate` in apps/web, then restart the dev server."
    );
  }

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

/** Always resolves a client with required model delegates (recreates stale dev singletons). */
export function getPrisma(): PrismaClient {
  return initPrismaClient();
}

/**
 * Lazy proxy: every access re-validates the dev singleton so HMR cannot keep a stale
 * `const prisma` reference from a module loaded before a schema/client update.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = initPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
