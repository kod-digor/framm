"use client";

import { ExternalLink, Inbox, Loader2, Mail, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/t";
import type { JmapEmailDetail, JmapEmailListItem } from "@/lib/mail/jmap-types";

type InboxResponse = {
  emails: JmapEmailListItem[];
  mailboxId: string | null;
};

type MailErrorCode =
  | "load_failed"
  | "no_credentials"
  | "credentials_invalid"
  | "auth_failed"
  | "auth_mfa"
  | "auth_upstream"
  | "unconfigured"
  | "unauthorized"
  | "forbidden"
  | "not_found";

function formatAddress(addr?: { name?: string; email: string }[] | null): string {
  if (!addr?.length) return "";
  const first = addr[0];
  return first.name ? `${first.name} <${first.email}>` : first.email;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function isUnread(keywords?: Record<string, boolean>): boolean {
  return !keywords?.["$seen"];
}

function extractBody(email: JmapEmailDetail): { html?: string; text?: string } {
  const values = email.bodyValues ?? {};
  const htmlPart = email.htmlBody?.[0]?.partId;
  const textPart = email.textBody?.[0]?.partId;
  return {
    html: htmlPart ? values[htmlPart]?.value : undefined,
    text: textPart ? values[textPart]?.value : email.preview ?? undefined,
  };
}

function MailMessagePane({ email }: { email: JmapEmailDetail | null }) {
  const t = useT("mail");

  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-zinc-500">
        <Mail className="size-8 text-zinc-300" />
        <p>{t("selectMessage")}</p>
      </div>
    );
  }

  const body = extractBody(email);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-zinc-200 px-4 py-3">
        <h2 className="text-base font-semibold text-zinc-900">
          {email.subject?.trim() || t("noSubject")}
        </h2>
        <div className="space-y-1 text-xs text-zinc-600 sm:text-sm">
          <p>
            <span className="font-medium text-zinc-500">{t("from")}</span>{" "}
            {formatAddress(email.from)}
          </p>
          {email.to?.length ? (
            <p>
              <span className="font-medium text-zinc-500">{t("to")}</span>{" "}
              {formatAddress(email.to)}
            </p>
          ) : null}
          <p className="text-zinc-400">{formatDate(email.receivedAt)}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {body.html ? (
          <iframe
            title={t("messageBody")}
            sandbox=""
            srcDoc={body.html}
            className="h-full min-h-[20rem] w-full rounded-md border border-zinc-200 bg-white"
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-800">
            {body.text || t("emptyBody")}
          </pre>
        )}
      </div>
    </div>
  );
}

function MailInboxList({
  emails,
  selectedId,
  onSelect,
}: {
  emails: JmapEmailListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT("mail");

  if (emails.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-zinc-500">
        <Inbox className="size-8 text-zinc-300" />
        <p>{t("inboxEmpty")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {emails.map((email) => {
        const active = email.id === selectedId;
        const unread = isUnread(email.keywords);
        return (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => onSelect(email.id)}
              className={`w-full px-3 py-3 text-left transition-colors hover:bg-zinc-50 ${
                active ? "bg-zinc-100" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={`min-w-0 truncate text-sm ${
                    unread ? "font-semibold text-zinc-900" : "text-zinc-700"
                  }`}
                >
                  {formatAddress(email.from) || t("unknownSender")}
                </p>
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {formatDate(email.receivedAt)}
                </span>
              </div>
              <p
                className={`mt-0.5 truncate text-sm ${
                  unread ? "font-medium text-zinc-800" : "text-zinc-600"
                }`}
              >
                {email.subject?.trim() || t("noSubject")}
              </p>
              {email.preview ? (
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{email.preview}</p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function BulwarkMail({
  mailboxId,
  address,
  externalUrl,
}: {
  mailboxId: string;
  address: string;
  externalUrl: string;
}) {
  const t = useT("mail");
  const [emails, setEmails] = useState<JmapEmailListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<MailErrorCode | null>(null);

  const selectedEmail = emails.find((e) => e.id === selectedId) as JmapEmailDetail | undefined;

  const loadInbox = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const res = await fetch(`/api/mail/${mailboxId}/jmap`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as InboxResponse & { error?: string };

      if (!res.ok) {
        setError((data.error as MailErrorCode) ?? "load_failed");
        setEmails([]);
        setSelectedId(null);
      } else {
        setEmails(data.emails ?? []);
        setSelectedId((current) => current ?? data.emails?.[0]?.id ?? null);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [mailboxId]
  );

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const errorMessage = error ? t(`errors.${error}` as "errors.load_failed") : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 bg-zinc-50/80 px-3 py-2 sm:px-4">
        <p className="min-w-0 truncate text-xs text-zinc-500 sm:text-sm">
          {t("connectedHint", { address })}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || refreshing}
            onClick={() => void loadInbox(true)}
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {t("refresh")}
          </Button>
          {externalUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                {t("openExternal")}
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      ) : errorMessage ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(14rem,20rem)_1fr]">
          <div className="min-h-0 overflow-auto border-b border-zinc-200 md:border-b-0 md:border-r">
            <MailInboxList
              emails={emails}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="min-h-[min(50vh,24rem)] min-w-0 md:min-h-0">
            <MailMessagePane email={selectedEmail ?? null} />
          </div>
        </div>
      )}
    </div>
  );
}
