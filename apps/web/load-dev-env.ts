import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const ENV_LOCAL_PATH = path.resolve(process.cwd(), ".env.local");

/**
 * Charge apps/web/.env.local pour scripts CLI (seed, worker, vérifs).
 * Avec override:false, les variables déjà présentes (Next.js) ne sont pas écrasées.
 */
export function loadDevEnv(options?: { override?: boolean }): void {
  if (!fs.existsSync(ENV_LOCAL_PATH)) return;
  dotenv.config({ path: ENV_LOCAL_PATH, override: options?.override ?? false });
}
