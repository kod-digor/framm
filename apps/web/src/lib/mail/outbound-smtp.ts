import nodemailer from "nodemailer";
import { unsealSecret } from "@/lib/crypto/seal";

export type SmtpRelayConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

export type OutboundMailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
};

export function resolveSmtpRelayConfig(): SmtpRelayConfig | null {
  const host = process.env.OUTBOUND_SMTP_RELAY_HOST;
  const user = process.env.OUTBOUND_SMTP_RELAY_USER;
  const pass = process.env.OUTBOUND_SMTP_RELAY_SECRET;
  if (!host || !user || !pass) return null;

  return {
    host,
    port: Number(process.env.OUTBOUND_SMTP_RELAY_PORT ?? "2587"),
    user,
    pass,
  };
}

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

/** Envoi authentifié via Stalwart (port 465) — pour les adresses de boîtes avec mot de passe stocké. */
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

export async function sendOutboundMail(
  payload: OutboundMailPayload
): Promise<{ ok: true; messageId: string; via: string } | { ok: false; code: "smtp_not_configured" | "send_failed"; detail?: string }> {
  const relay = resolveSmtpRelayConfig();
  if (!relay) {
    return { ok: false, code: "smtp_not_configured" };
  }

  const label = `${relay.host}:${relay.port}`;
  const transport = nodemailer.createTransport({
    host: relay.host,
    port: relay.port,
    secure: false,
    auth: { user: relay.user, pass: relay.pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });

  try {
    const info = await transport.sendMail({
      from: payload.from,
      to: payload.to,
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

/** Déchiffre le mot de passe boîte pour envoi Stalwart (exporté pour org-mail-send). */
export function decryptMailboxPassword(credentialsEnc: string): string | null {
  return unsealSecret(credentialsEnc);
}
