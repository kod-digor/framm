import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { ImapSourceCredentials, MigrationProgress } from "@/lib/migration/types";
import { unsealSecret } from "@/lib/crypto/seal";
import { GOOGLE_IMAP } from "@/lib/migration/providers/google";
import { MICROSOFT_IMAP } from "@/lib/migration/providers/microsoft";
import { ICLOUD_IMAP_PRESET } from "@/lib/migration/providers/imap-generic";

export type ImapsyncRunOptions = {
  source: ImapSourceCredentials;
  targetHost: string;
  targetPort: number;
  targetUser: string;
  targetPassword: string;
  onProgress?: (progress: MigrationProgress, line: string) => void;
  onLog?: (line: string) => void;
};

export type ImapsyncRunResult = {
  ok: boolean;
  error?: string;
  progress: MigrationProgress;
};

const PROGRESS_RE = /(\d+)\s*\/\s*(\d+)\s+msgs/;
const FOLDER_RE = /Folder\s+(.+)/i;

function resolveImapsyncMaxBytesPerSecond(): number | null {
  const raw = process.env.IMAPSYNC_MAX_BYTES_PER_SECOND?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function parseProgressLine(line: string, current: MigrationProgress): MigrationProgress {
  const next = { ...current, lastLogLine: line.trim() };

  const msgMatch = PROGRESS_RE.exec(line);
  if (msgMatch) {
    const done = Number(msgMatch[1]);
    const total = Number(msgMatch[2]);
    if (total > 0) {
      next.messagesSynced = done;
      next.percent = Math.min(99, Math.round((done / total) * 100));
    }
  }

  const folderMatch = FOLDER_RE.exec(line);
  if (folderMatch) {
    next.currentFolder = folderMatch[1].trim();
  }

  return next;
}

function resolveImapBinary(): string | null {
  const candidates = [
    process.env.IMAPSYNC_PATH?.trim(),
    "/usr/local/bin/imapsync",
    "/usr/bin/imapsync",
    "/opt/imapsync/imapsync",
    "imapsync",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (candidate === "imapsync") return candidate;
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function buildSourceArgs(source: ImapSourceCredentials): string[] {
  const host =
    source.oauthProvider === "google"
      ? GOOGLE_IMAP.host
      : source.oauthProvider === "microsoft"
        ? MICROSOFT_IMAP.host
        : source.host;
  const port =
    source.oauthProvider === "google"
      ? GOOGLE_IMAP.port
      : source.oauthProvider === "microsoft"
        ? MICROSOFT_IMAP.port
        : source.port;

  const args = [
    "--host1",
    host,
    "--port1",
    String(port),
    "--user1",
    source.user,
    "--ssl1",
    "--sslargs1",
    "SSL_verify_mode=1",
  ];

  if (source.oauthAccessToken) {
    // imapsync 2.323 : --oauthaccesstoken1 suffit (pas de --oauthclientid1).
    args.push("--oauthaccesstoken1", source.oauthAccessToken);
  } else if (source.password) {
    args.push("--password1", source.password);
  }

  return args;
}

export function buildImapsyncArgs(options: ImapsyncRunOptions): string[] {
  const sourceArgs = buildSourceArgs(options.source);

  const args = [
    ...sourceArgs,
    "--host2",
    options.targetHost,
    "--port2",
    String(options.targetPort),
    "--user2",
    options.targetUser,
    "--password2",
    options.targetPassword,
    "--ssl2",
    "--sslargs2",
    "SSL_verify_mode=1",
    "--nofoldersizes",
    "--syncinternaldates",
    "--automap",
    "--useheader",
    "Message-Id",
    "--usecache",
    "--errorsmax",
    "100",
  ];

  const maxBytesPerSecond = resolveImapsyncMaxBytesPerSecond();
  if (maxBytesPerSecond) {
    args.push("--maxbytespersecond", String(maxBytesPerSecond));
  }

  return args;
}

export async function runImapsync(options: ImapsyncRunOptions): Promise<ImapsyncRunResult> {
  const binary = resolveImapBinary();
  if (!binary) {
    return {
      ok: false,
      error: "imapsync_not_found",
      progress: { percent: 0, lastLogLine: "imapsync binary not found" },
    };
  }

  const args = buildImapsyncArgs(options);
  let progress: MigrationProgress = { percent: 0 };

  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const handleLine = (chunk: Buffer) => {
      const lines = chunk.toString("utf8").split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        options.onLog?.(line);
        progress = parseProgressLine(line, progress);
        options.onProgress?.(progress, line);
      }
    };

    child.stdout?.on("data", handleLine);
    child.stderr?.on("data", handleLine);

    child.on("error", (err) => {
      const message =
        "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
          ? "imapsync_not_found"
          : err.message;
      resolve({
        ok: false,
        error: message,
        progress,
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          ok: true,
          progress: { ...progress, percent: 100 },
        });
      } else {
        resolve({
          ok: false,
          error: progress.lastLogLine ?? `imapsync_exit_${code ?? "unknown"}`,
          progress,
        });
      }
    });
  });
}

export function decodeSourceCredentials(
  sourceCredentialsEnc: string | null,
  oauthRefreshTokenEnc: string | null
): ImapSourceCredentials | null {
  if (!sourceCredentialsEnc) return null;

  const raw = unsealSecret(sourceCredentialsEnc);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ImapSourceCredentials;
    if (parsed.oauthAccessToken) return parsed;

    if (parsed.password) return parsed;

    if (oauthRefreshTokenEnc) {
      const refresh = unsealSecret(oauthRefreshTokenEnc);
      if (refresh) {
        return { ...parsed, password: refresh };
      }
    }

    return parsed;
  } catch {
    return {
      host: ICLOUD_IMAP_PRESET.host,
      port: ICLOUD_IMAP_PRESET.port,
      user: raw,
      password: oauthRefreshTokenEnc ? unsealSecret(oauthRefreshTokenEnc) ?? undefined : undefined,
    };
  }
}
