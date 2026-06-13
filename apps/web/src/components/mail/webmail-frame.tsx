"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/t";

export function WebmailFrame({
  mailboxId,
  address,
  externalUrl,
}: {
  mailboxId: string;
  address: string;
  externalUrl: string;
}) {
  const t = useT("mail");
  const src = `/webmail/${mailboxId}/`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 bg-zinc-50/80 px-3 py-2 sm:px-4">
        <p className="min-w-0 truncate text-xs text-zinc-500 sm:text-sm">
          {t("webmailFrameHint", { address })}
        </p>
        {externalUrl ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              {t("openExternal")}
            </a>
          </Button>
        ) : null}
      </div>
      <iframe
        title={t("webmailFrameTitle", { address })}
        src={src}
        className="min-h-0 flex-1 w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
      />
    </div>
  );
}
