"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/t";

export function WebmailFrame({
  src,
  externalUrl,
  address,
}: {
  src: string;
  externalUrl: string;
  address: string;
}) {
  const t = useT("mail");
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 bg-zinc-50/80 px-3 py-2 sm:px-4">
        <p className="min-w-0 truncate text-xs text-zinc-500 sm:text-sm">{t("loginHint")}</p>
        {externalUrl && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              {t("openExternal")}
            </a>
          </Button>
        )}
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 text-sm text-zinc-500">
            {t("loading")}
          </div>
        )}
        <iframe
          src={src}
          title={t("iframeTitle", { address })}
          className="h-full min-h-[min(70vh,calc(100dvh-12rem))] w-full border-0"
          onLoad={() => setLoaded(true)}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
        />
      </div>
    </div>
  );
}
