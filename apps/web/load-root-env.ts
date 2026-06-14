import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/** Chemin vers Framm/.env (deux niveaux au-dessus de apps/web). */
const REPO_ROOT_ENV = path.resolve(process.cwd(), "..", "..", ".env");

/**
 * Variables partagées avec Terraform / bin/framm — lues depuis le .env racine
 * uniquement si absentes de process.env (apps/web/.env.local garde la priorité).
 */
const ROOT_ENV_KEYS = [
  "GOOGLE_MIGRATION_CLIENT_ID",
  "GOOGLE_MIGRATION_CLIENT_SECRET",
  "MICROSOFT_MIGRATION_CLIENT_ID",
  "MICROSOFT_MIGRATION_CLIENT_SECRET",
  "AUTH_URL",
  "MIGRATION_STALWART_IMAP_HOST",
  "MIGRATION_STALWART_IMAP_PORT",
  "IMAPSYNC_PATH",
  "IMAPSYNC_MAX_BYTES_PER_SECOND",
  "MIGRATION_WORKER_CONCURRENCY",
] as const;

export function loadRootEnv(): void {
  if (!fs.existsSync(REPO_ROOT_ENV)) return;

  const parsed = dotenv.parse(fs.readFileSync(REPO_ROOT_ENV));
  for (const key of ROOT_ENV_KEYS) {
    if (process.env[key] === undefined && parsed[key] !== undefined) {
      process.env[key] = parsed[key];
    }
  }
}

loadRootEnv();
