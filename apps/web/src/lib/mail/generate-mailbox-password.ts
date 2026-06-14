import { randomBytes } from "crypto";

/** Mot de passe aléatoire pour boîtes partagées (jamais exposé à l'utilisateur). */
export function generateMailboxPassword(): string {
  return randomBytes(18).toString("base64url");
}
