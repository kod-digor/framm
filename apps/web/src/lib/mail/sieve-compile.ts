import type { MailboxFilterAction } from "@prisma/client";

export type SieveFilterRule = {
  id: string;
  name: string;
  fromAddress?: string | null;
  subjectContains?: string | null;
  action: MailboxFilterAction;
  targetFolder?: string | null;
};

function escapeSieveString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildCondition(rule: SieveFilterRule): string | null {
  const parts: string[] = [];
  if (rule.fromAddress?.trim()) {
    parts.push(`address :is "From" "${escapeSieveString(rule.fromAddress.trim())}"`);
  }
  if (rule.subjectContains?.trim()) {
    parts.push(`header :contains "subject" "${escapeSieveString(rule.subjectContains.trim())}"`);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return `allof (${parts.join(", ")})`;
}

function buildAction(rule: SieveFilterRule): string[] {
  switch (rule.action) {
    case "MOVE_TO":
      return [`fileinto "${escapeSieveString(rule.targetFolder?.trim() || "Filtered")}";`];
    case "MARK_READ":
      return ['addflag "\\\\Seen";'];
    case "MARK_FLAGGED":
      return ['addflag "\\\\Flagged";'];
    case "DELETE":
      return ["discard;"];
    case "STOP":
      return ["stop;"];
    default:
      return ["stop;"];
  }
}

/** Compile les règles actives en un script Sieve unique (RFC 5228). */
export function compileSieveScript(rules: SieveFilterRule[]): string {
  const extensions = new Set<string>(["imap4flags"]);
  const blocks: string[] = [];

  for (const rule of rules) {
    const condition = buildCondition(rule);
    if (!condition) continue;

    if (rule.action === "MOVE_TO") extensions.add("fileinto");
    if (rule.action === "DELETE") extensions.add("reject");

    const actions = buildAction(rule);
    blocks.push(`if ${condition} {`);
    for (const line of actions) blocks.push(`  ${line}`);
    if (rule.action !== "STOP" && rule.action !== "DELETE") {
      blocks.push("  stop;");
    }
    blocks.push("}");
    blocks.push("");
  }

  const requireLine = `require [${[...extensions].map((e) => `"${e}"`).join(", ")}];`;
  if (blocks.length === 0) {
    return `${requireLine}\n\n# framm-empty\n`;
  }

  return `${requireLine}\n\n${blocks.join("\n")}`;
}
