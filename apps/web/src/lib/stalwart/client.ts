const STALWART_URL = process.env.STALWART_URL ?? "";
const STALWART_API_KEY = process.env.STALWART_API_KEY ?? "";

type JmapRequest = {
  using: string[];
  methodCalls: [string, Record<string, unknown>, string][];
};

async function jmapCall(methodCalls: JmapRequest["methodCalls"]) {
  if (!STALWART_URL || !STALWART_API_KEY) {
    return { unavailable: true as const };
  }

  const body: JmapRequest = {
    using: ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
    methodCalls,
  };

  const res = await fetch(`${STALWART_URL}/jmap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STALWART_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { error: `Stalwart JMAP error: ${res.status}` };
  }

  return res.json();
}

export async function createDomain(fqdn: string) {
  const id = `domain-${Date.now()}`;
  return jmapCall([
    [
      "x:Domain/set",
      {
        create: {
          [id]: {
            name: fqdn,
          },
        },
      },
      "c1",
    ],
  ]);
}

export async function createAccount(email: string, domainId: string, password: string) {
  const id = `account-${Date.now()}`;
  return jmapCall([
    [
      "x:Account/set",
      {
        create: {
          [id]: {
            "@type": "User",
            name: email,
            domainId,
            secrets: [{ type: "password", value: password }],
          },
        },
      },
      "c1",
    ],
  ]);
}

export async function createAlias(source: string, destination: string) {
  const id = `alias-${Date.now()}`;
  return jmapCall([
    [
      "x:EmailAlias/set",
      {
        create: {
          [id]: {
            email: source,
            redirectTo: [destination],
          },
        },
      },
      "c1",
    ],
  ]);
}

export async function listAccounts() {
  return jmapCall([["x:Account/query", { filter: {} }, "q1"]]);
}

export function getMailConfig() {
  const host = STALWART_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    imapServer: host,
    smtpServer: host,
    imapPort: 993,
    smtpPort: 587,
    smtpPortSsl: 465,
    webmailUrl: process.env.WEBMAIL_URL ?? "",
  };
}
