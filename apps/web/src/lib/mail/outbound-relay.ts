import nodemailer from "nodemailer";

export type OutboundRelayConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure: boolean;
};

/**
 * Configuration du relais SMTP sortant (Scaleway TEM en prod).
 * `user`/`pass` sont optionnels : certains relais internes n'exigent pas d'auth.
 * Retourne `null` si aucun hôte n'est configuré.
 */
export function resolveOutboundRelay(): OutboundRelayConfig | null {
  const host = process.env.OUTBOUND_SMTP_RELAY_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.OUTBOUND_SMTP_RELAY_PORT ?? "2587");
  const user = process.env.OUTBOUND_SMTP_RELAY_USER?.trim() || undefined;
  const pass = process.env.OUTBOUND_SMTP_RELAY_SECRET?.trim() || undefined;

  return {
    host,
    port,
    user,
    pass,
    secure: port === 465,
  };
}

export type OutboundMessage = {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

export type OutboundSendResult =
  | { ok: true; via: string; messageId?: string }
  | { ok: false; detail: string };

/** Envoie un message via le relais sortant configuré. Un seul appel externe, encadré. */
export async function sendViaOutboundRelay(
  message: OutboundMessage
): Promise<OutboundSendResult> {
  const relay = resolveOutboundRelay();
  if (!relay) {
    return {
      ok: false,
      detail:
        "Relais SMTP sortant non configuré (OUTBOUND_SMTP_RELAY_HOST manquant).",
    };
  }

  const label = `${relay.host}:${relay.port}`;
  const transport = nodemailer.createTransport({
    host: relay.host,
    port: relay.port,
    secure: relay.secure,
    auth: relay.user && relay.pass ? { user: relay.user, pass: relay.pass } : undefined,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });

  try {
    const info = await transport.sendMail({
      from: message.from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    transport.close();
    return { ok: true, via: label, messageId: info.messageId };
  } catch (err) {
    transport.close();
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `${label}: ${detail}` };
  }
}
