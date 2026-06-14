import { connect } from "node:tls";

type ImapCredentials = {
  host: string;
  port: number;
  user: string;
  password: string;
};

function escapeImapString(value: string): string {
  if (/[\x00-\x1f\x7f"]/.test(value) || value.includes("\\")) {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return value.includes(" ") ? `"${value}"` : value;
}

function parseListLine(line: string): string | null {
  const match = /LIST\s+\([^)]*\)\s+"[^"]*"\s+"([^"]*)"/i.exec(line);
  if (match) return match[1];
  const match2 = /LIST\s+\([^)]*\)\s+[^\s]+\s+([^\s]+)/i.exec(line);
  return match2?.[1]?.replace(/^"|"$/g, "") ?? null;
}

function parseStatusMessages(line: string): number | null {
  const match = /MESSAGES\s+(\d+)/i.exec(line);
  return match ? Number(match[1]) : null;
}

async function imapCommand(
  socket: ReturnType<typeof connect>,
  tag: string,
  command: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? "";

      for (const line of parts) {
        lines.push(line);
        if (line.startsWith(`${tag} `)) {
          cleanup();
          if (line.includes(" OK")) resolve(lines);
          else reject(new Error(`IMAP ${line}`));
          return;
        }
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.on("error", onError);
    socket.write(`${tag} ${command}\r\n`);
  });
}

export async function discoverImapMailStats(
  creds: ImapCredentials,
  timeoutMs = 30_000
): Promise<{ messageCount: number; folderCount: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("IMAP timeout"));
    }, timeoutMs);

    let tagCounter = 10;

    const socket = connect(
      { host: creds.host, port: creds.port, rejectUnauthorized: true },
      async () => {
        try {
          await waitForGreeting(socket);
          await imapCommand(
            socket,
            "a1",
            `LOGIN ${escapeImapString(creds.user)} ${escapeImapString(creds.password)}`
          );
          const listLines = await imapCommand(socket, "a2", 'LIST "" "*"');
          const folders = listLines
            .map(parseListLine)
            .filter((f): f is string => Boolean(f));

          let messageCount = 0;
          for (const folder of folders) {
            tagCounter++;
            const statusLines = await imapCommand(
              socket,
              `s${tagCounter}`,
              `STATUS ${escapeImapString(folder)} (MESSAGES)`
            );
            for (const line of statusLines) {
              const count = parseStatusMessages(line);
              if (count !== null) messageCount += count;
            }
          }

          await imapCommand(socket, "a3", "LOGOUT");
          clearTimeout(timer);
          socket.end();
          resolve({ messageCount, folderCount: folders.length });
        } catch (err) {
          clearTimeout(timer);
          socket.destroy();
          reject(err);
        }
      }
    );

    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForGreeting(socket: ReturnType<typeof connect>): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (buffer.includes("* OK")) {
        socket.off("data", onData);
        socket.off("error", onError);
        resolve();
      }
    };
    const onError = (err: Error) => {
      socket.off("data", onData);
      reject(err);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}
