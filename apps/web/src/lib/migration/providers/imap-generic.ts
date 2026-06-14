import type { ImapPreset } from "@/lib/migration/types";

export const ICLOUD_IMAP_PRESET: ImapPreset = {
  host: "imap.mail.me.com",
  port: 993,
  label: "iCloud",
};

export const GENERIC_IMAP_DEFAULTS = {
  port: 993,
  useSsl: true,
} as const;

export function validateImapHost(host: string): boolean {
  const trimmed = host.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253) return false;
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(trimmed);
}

export function validateImapPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function normalizeImapCredentials(
  host: string,
  port: number,
  user: string,
  password: string
) {
  return {
    host: host.trim().toLowerCase(),
    port,
    user: user.trim(),
    password,
  };
}
