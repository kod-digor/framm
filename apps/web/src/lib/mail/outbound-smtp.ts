import nodemailer from "nodemailer";
import { unsealSecret } from "@/lib/crypto/seal";

export type OutboundMailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

function resolveStalwartSubmissionHost(): string | null {
  const fromUrl = process.env.STALWART_URL?.trim();
  if (fromUrl) {
    try {
      return new URL(fromUrl).hostname;
    } catch {
      /* ignore */
    }
  }
  return process.env.MIGRATION_STALWART_IMAP_HOST?.trim() || null;
}

/** Envoi authentifié via le SMTP Stalwart de la plateforme (port 465). Jamais TEM Scaleway. */
export async function sendViaStalwartMailbox(
  mailboxAddress: string,
  mailboxPassword: string,
  payload: OutboundMailPayload
): Promise<{ ok: true; messageId: string; via: string } | { ok: false; code: "smtp_not_configured" | "send_failed"; detail?: string }> {
  const host = resolveStalwartSubmissionHost();
  if (!host) {
    return { ok: false, code: "smtp_not_configured", detail: "STALWART_URL non configuré" };
  }

  const label = `${host}:465`;
  const transport = nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: { user: mailboxAddress, pass: mailboxPassword },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });

  try {
    const info = await transport.sendMail({
      from: payload.from,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      replyTo: payload.replyTo,
    });
    transport.close();
    return {
      ok: true,
      messageId: info.messageId ?? "unknown",
      via: label,
    };
  } catch (err) {
    transport.close();
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "send_failed", detail };
  }
}

/** Déchiffre le mot de passe boîte pour envoi Stalwart. */
export function decryptMailboxPassword(credentialsEnc: string): string | null {
  return unsealSecret(credentialsEnc);
}
