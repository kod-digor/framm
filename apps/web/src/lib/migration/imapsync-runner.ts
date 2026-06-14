import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { ImapSourceCredentials, MigrationProgress } from "@/lib/migration/types";
import { unsealSecret } from "@/lib/crypto/seal";
import { ICLOUD_IMAP_PRESET } from "@/lib/migration/providers/imap-generic";

export type ImapsyncRunOptions = {
  source: ImapSourceCredentials;
  targetHost: string;
  targetPort: number;
  targetUser: string;
  targetPassword: string;
  /** Total messages source (discovery) — sert au calcul du pourcentage mail. */
  totalMessages?: number;
  onProgress?: (progress: MigrationProgress, line: string) => void;
  onLog?: (line: string) => void;
};

export type ImapsyncRunResult = {
  ok: boolean;
  error?: string;
  progress: MigrationProgress;
};

/** Ancien format imapsync (rare) : « 42 / 100 msgs » */
const LEGACY_PROGRESS_RE = /(\d+)\s*\/\s*(\d+)\s+msgs/;
/** imapsync 2.323+ : « Host1: folder [INBOX] selected 42 messages, duplicates 0 » */
const HOST1_FOLDER_RE =
  /Host1:\s+folder\s+(.+?)\s+selected\s+(\d+)\s+messages?(?:,\s*duplicates\s+\d+)?/i;
/** imapsync 2.323+ : « msg INBOX/12 {1234} copied to INBOX/1 … » */
const MSG_COPIED_RE = /^msg\s+(.+?)\/(\d+)\s+\{/i;

function resolveImapsyncMaxBytesPerSecond(): number | null {
  const raw = process.env.IMAPSYNC_MAX_BYTES_PER_SECOND?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

type ImapsyncProgressState = {
  progress: MigrationProgress;
  copiedKeys: Set<string>;
  foldersSeen: Set<string>;
};

function computeMailPercent(messagesSynced: number, totalMessages?: number): number {
  if (totalMessages && totalMessages > 0) {
    return Math.min(99, Math.round((messagesSynced / totalMessages) * 100));
  }
  return 0;
}

export function parseImapsyncProgressLine(
  line: string,
  state: ImapsyncProgressState,
  totalMessages?: number
): ImapsyncProgressState {
  const trimmed = line.trim();
  const next: MigrationProgress = { ...state.progress, lastLogLine: trimmed };

  const legacyMatch = LEGACY_PROGRESS_RE.exec(trimmed);
  if (legacyMatch) {
    const done = Number(legacyMatch[1]);
    const total = Number(legacyMatch[2]);
    if (total > 0) {
      next.messagesSynced = done;
      next.percent = Math.min(99, Math.round((done / total) * 100));
    }
    return { ...state, progress: next };
  }

  const folderMatch = HOST1_FOLDER_RE.exec(trimmed);
  if (folderMatch) {
    const folderName = folderMatch[1].trim();
    next.currentFolder = folderName;
    if (!state.foldersSeen.has(folderName)) {
      const foldersSeen = new Set(state.foldersSeen);
      foldersSeen.add(folderName);
      next.foldersSynced = foldersSeen.size;
      state = { ...state, foldersSeen };
    }
    return { ...state, progress: next };
  }

  const copiedMatch = MSG_COPIED_RE.exec(trimmed);
  if (copiedMatch) {
    const key = `${copiedMatch[1]}/${copiedMatch[2]}`;
    if (!state.copiedKeys.has(key)) {
      const copiedKeys = new Set(state.copiedKeys);
      copiedKeys.add(key);
      const messagesSynced = copiedKeys.size;
      next.messagesSynced = messagesSynced;
      next.percent = computeMailPercent(messagesSynced, totalMessages);
      return { ...state, copiedKeys, progress: next };
    }
  }

  return { ...state, progress: next };
}

const SECRET_CLI_FLAG_RE =
  /--(?:oauthaccesstoken|password|refreshtoken|oauthrefreshtoken)[12](?:=\S+|\s+\S+)/gi;
/** Jetons OAuth Google (access) — ne jamais persister ni afficher. */
const GOOGLE_ACCESS_TOKEN_RE = /\bya29\.[A-Za-z0-9._-]+/g;
/** Jetons OAuth Google (refresh) — préfixe courant 1// */
const GOOGLE_REFRESH_TOKEN_RE = /\b1\/\/[A-Za-z0-9_-]+/g;

/** Masque secrets imapsync dans une ligne (logs, journal, erreurs). */
export function redactImapsyncLogLine(line: string): string {
  return line
    .replace(SECRET_CLI_FLAG_RE, (match) => {
      const eq = match.indexOf("=");
      if (eq !== -1) return `${match.slice(0, eq + 1)}<redacted>`;
      const space = match.lastIndexOf(" ");
      return space === -1 ? "<redacted>" : `${match.slice(0, space + 1)}<redacted>`;
    })
    .replace(GOOGLE_ACCESS_TOKEN_RE, "ya29.<redacted>")
    .replace(GOOGLE_REFRESH_TOKEN_RE, "1//<redacted>");
}

/** Journal migration : progression dossiers/messages, erreurs et fin uniquement. */
export function shouldLogImapsyncLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (HOST1_FOLDER_RE.test(trimmed)) return true;
  if (MSG_COPIED_RE.test(trimmed)) return true;
  if (LEGACY_PROGRESS_RE.test(trimmed)) return true;
  if (/\bERROR\b/i.test(trimmed)) return true;
  if (/\bFATAL\b/i.test(trimmed)) return true;
  if (/\bExiting with /i.test(trimmed)) return true;
  if (/^End of sync/i.test(trimmed)) return true;
  if (/^Messages transferred/i.test(trimmed)) return true;
  return false;
}

function resolveOAuthProvider(
  source: ImapSourceCredentials
): "google" | "microsoft" | null {
  if (source.oauthProvider) return source.oauthProvider;
  const host = source.host?.toLowerCase() ?? "";
  if (host === "imap.gmail.com" || host.endsWith(".gmail.com")) return "google";
  if (
    host === "outlook.office365.com" ||
    host === "imap-mail.outlook.com" ||
    host.includes("outlook.com")
  ) {
    return "microsoft";
  }
  return null;
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

const IMAPSYNC_SECRET_FLAGS = new Set([
  "--password1",
  "--password2",
  "--oauthaccesstoken1",
  "--oauthaccesstoken2",
]);

/** Args imapsync sans secrets — pour les logs migration. */
export function redactImapsyncArgsForLog(args: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (IMAPSYNC_SECRET_FLAGS.has(flag)) {
      parts.push(flag, "<redacted>");
      i++;
      continue;
    }
    parts.push(flag);
  }
  return parts.join(" ");
}

function buildSourceArgs(source: ImapSourceCredentials): string[] {
  const args: string[] = ["--user1", source.user];
  const provider = resolveOAuthProvider(source);

  // imapsync 2.323 : presets provider (--gmail1 / --office1), pas --oauthclientid1 ni --maxparallel.
  // --gmail1 active --skipcrossduplicates par défaut, incompatible avec --usecache (reprise).
  if (provider === "google") {
    args.unshift("--gmail1", "--noskipcrossduplicates");
  } else if (provider === "microsoft") {
    args.unshift("--office1");
  } else {
    args.unshift(
      "--host1",
      source.host,
      "--port1",
      String(source.port),
      "--ssl1",
      "--sslargs1",
      "SSL_verify_mode=1"
    );
  }

  if (source.oauthAccessToken) {
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
  let parseState: ImapsyncProgressState = {
    progress: { percent: 0 },
    copiedKeys: new Set(),
    foldersSeen: new Set(),
  };
  const commandPreview = `${binary} ${redactImapsyncArgsForLog(args)}`;
  options.onLog?.(commandPreview);
  parseState.progress = { ...parseState.progress, lastLogLine: commandPreview };

  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const handleStdout = (chunk: Buffer) => {
      const lines = chunk.toString("utf8").split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const safeLine = redactImapsyncLogLine(line);
        options.onLog?.(safeLine);
        parseState = parseImapsyncProgressLine(line, parseState, options.totalMessages);
        options.onProgress?.(parseState.progress, safeLine);
      }
    };

    const handleStderr = (chunk: Buffer) => {
      const lines = chunk.toString("utf8").split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        options.onLog?.(redactImapsyncLogLine(line));
      }
    };

    child.stdout?.on("data", handleStdout);
    child.stderr?.on("data", handleStderr);

    child.on("error", (err) => {
      const message =
        "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
          ? "imapsync_not_found"
          : err.message;
      resolve({
        ok: false,
        error: message,
        progress: parseState.progress,
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          ok: true,
          progress: { ...parseState.progress, percent: 100 },
        });
      } else {
        resolve({
          ok: false,
          error: parseState.progress.lastLogLine ?? `imapsync_exit_${code ?? "unknown"}`,
          progress: parseState.progress,
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
