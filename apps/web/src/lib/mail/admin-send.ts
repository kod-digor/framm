import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getPlatformEmailDomains } from "@/lib/platform-domains";
import { sendViaOutboundRelay, type OutboundSendResult } from "@/lib/mail/outbound-relay";

/** Tokens admin acceptés (plusieurs valeurs possibles, séparées par des virgules). */
function configuredTokens(): string[] {
  return (process.env.ADMIN_MAIL_TOKEN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAdminMailTokenConfigured(): boolean {
  return configuredTokens().length > 0;
}

/**
 * Compare `provided` aux tokens configurés en temps constant.
 * Le hachage SHA-256 uniformise la longueur avant `timingSafeEqual` (évite la fuite
 * de longueur et gère des tokens de tailles différentes).
 */
export function verifyAdminMailToken(provided: string | null | undefined): boolean {
  if (!provided) return false;
  const tokens = configuredTokens();
  if (tokens.length === 0) return false;

  const providedHash = createHash("sha256").update(provided).digest();
  let matched = false;
  for (const token of tokens) {
    const tokenHash = createHash("sha256").update(token).digest();
    if (timingSafeEqual(providedHash, tokenHash)) matched = true;
  }
  return matched;
}

/** Extrait l'adresse d'un champ From de la forme `Nom <a@b>` ou `a@b`. */
export function extractEmailAddress(input: string): string | null {
  const angle = input.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : input).trim().toLowerCase();
  const valid = z.string().email().safeParse(candidate);
  return valid.success ? candidate : null;
}

export function allowAnyFromDomain(): boolean {
  return process.env.ADMIN_MAIL_ALLOW_ANY_DOMAIN === "true";
}

/**
 * Autorise l'expéditeur si son domaine appartient à la plateforme.
 * Par défaut le From est restreint aux domaines gérés (les relais TEM ne signent
 * SPF/DKIM que pour ces domaines : envoyer depuis un autre domaine finirait en spam).
 * `ADMIN_MAIL_ALLOW_ANY_DOMAIN=true` lève la restriction.
 */
export function isFromAddressAllowed(from: string): boolean {
  const address = extractEmailAddress(from);
  if (!address) return false;
  if (allowAnyFromDomain()) return true;

  const domain = address.split("@")[1];
  if (!domain) return false;

  const platformDomains = getPlatformEmailDomains();
  return platformDomains.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
  );
}

const recipients = z.union([
  z.string().email(),
  z.array(z.string().email()).min(1),
]);

export const adminSendMailSchema = z
  .object({
    from: z.string().min(3),
    to: recipients,
    subject: z.string().min(1).max(998),
    text: z.string().optional(),
    html: z.string().optional(),
    cc: recipients.optional(),
    bcc: recipients.optional(),
    replyTo: z.string().email().optional(),
  })
  .refine((value) => Boolean(value.text ?? value.html), {
    message: "Le corps du message (text ou html) est requis.",
    path: ["text"],
  });

export type AdminSendMailInput = z.infer<typeof adminSendMailSchema>;

export type AdminSendMailResult =
  | { ok: true; via: string; messageId?: string }
  | { ok: false; code: "invalid_from" | "relay_error"; detail: string };

/** Valide l'expéditeur puis envoie via le relais sortant. */
export async function sendAdminMail(
  input: AdminSendMailInput
): Promise<AdminSendMailResult> {
  if (!isFromAddressAllowed(input.from)) {
    return {
      ok: false,
      code: "invalid_from",
      detail: allowAnyFromDomain()
        ? "Adresse expéditrice invalide."
        : "Le domaine de l'expéditeur n'appartient pas à la plateforme.",
    };
  }

  const result: OutboundSendResult = await sendViaOutboundRelay({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    cc: input.cc,
    bcc: input.bcc,
    replyTo: input.replyTo,
  });

  if (!result.ok) {
    return { ok: false, code: "relay_error", detail: result.detail };
  }
  return { ok: true, via: result.via, messageId: result.messageId };
}
