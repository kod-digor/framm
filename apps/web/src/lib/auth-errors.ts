import { AuthError, CredentialsSignin } from "next-auth";
import { Prisma } from "@prisma/client";

const DB_ERROR_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1008",
  "P1010",
  "P1017",
  "P2021",
  "P2022",
]);

export function isDbUnavailableError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return DB_ERROR_CODES.has(err.code);
  }
  if (err instanceof Prisma.PrismaClientInitializationError) return true;

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("econnrefused") ||
      msg.includes("connect timeout") ||
      msg.includes("can't reach database") ||
      msg.includes("connection terminated") ||
      msg.includes("too many clients") ||
      msg.includes("too many database connections")
    ) {
      return true;
    }
  }

  return false;
}

function getAuthErrorRootCause(err: unknown): unknown {
  if (!(err instanceof AuthError)) return err;

  const cause = err.cause;
  if (cause && typeof cause === "object" && "err" in cause) {
    const inner = cause.err;
    if (inner instanceof Error) return inner;
  }

  return err;
}

/** Erreur de query string pour login/signup après échec signIn (redirect: false lève). */
export function resolveSignInRedirectError(err: unknown): "invalid" | "db" {
  if (err instanceof CredentialsSignin) return "invalid";

  const root = getAuthErrorRootCause(err);
  if (isDbUnavailableError(root) || isDbUnavailableError(err)) return "db";

  if (err instanceof AuthError) {
    if (err.type === "CredentialsSignin") return "invalid";
    return "invalid";
  }

  return "invalid";
}
