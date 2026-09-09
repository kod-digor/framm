"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Copy, KeyRound } from "lucide-react";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/actions/api-keys";
import { CrudPageHeader } from "@/components/layout/crud-page-header";
import { Button } from "@/components/ui/button";
import { CrudAddButton } from "@/components/ui/crud-add-button";
import { DataTable } from "@/components/ui/data-table";
import { FormDrawer } from "@/components/ui/form-drawer";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import {
  CrudRowActions,
  CRUD_ACTIONS_CELL_CLASS,
  CRUD_ACTIONS_HEADER_CLASS,
} from "@/components/ui/crud-row-actions";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
};

type Labels = {
  title: string;
  intro: string;
  create: string;
  creating: string;
  name: string;
  namePlaceholder: string;
  colName: string;
  colPrefix: string;
  colScopes: string;
  colLastUsed: string;
  colCreated: string;
  revoke: string;
  revoking: string;
  neverUsed: string;
  scopeMailSend: string;
  tokenRevealTitle: string;
  tokenRevealHint: string;
  copy: string;
  copied: string;
  curlTitle: string;
  curlHint: string;
  verifiedDomainsTitle: string;
  verifiedDomainsEmpty: string;
  endpointLabel: string;
};

function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function buildCurlExample(baseUrl: string, fromDomain: string) {
  const endpoint = `${baseUrl}/api/v1/mail/send`;
  return `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer VOTRE_CLE_API' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "from": "noreply@${fromDomain}",
    "to": "destinataire@example.com",
    "subject": "Test Framm API",
    "text": "Bonjour depuis l API Framm."
  }'`;
}

export function ApiKeysCrud({
  keys,
  verifiedDomains,
  apiBaseUrl,
  labels,
}: {
  keys: ApiKeyRow[];
  verifiedDomains: string[];
  apiBaseUrl: string;
  labels: Labels;
}) {
  const t = useTranslations("apiKeys");
  const tc = useTranslations("common");
  const [createOpen, setCreateOpen] = useState(false);
  const [copied, setCopied] = useState<"token" | "curl" | null>(null);
  const [createState, createAction, createPending] = useActionState(
    createApiKeyAction,
    INITIAL_ACTION_RESULT
  );
  const [revokeState, revokeAction] = useActionState(
    revokeApiKeyAction,
    INITIAL_ACTION_RESULT
  );

  const revealedToken = createState?.ok ? createState.token : undefined;

  const exampleDomain = verifiedDomains[0] ?? "votre-domaine.fr";
  const curlExample = buildCurlExample(apiBaseUrl, exampleDomain);
  const endpoint = `${apiBaseUrl}/api/v1/mail/send`;

  async function copyText(text: string, kind: "token" | "curl") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  const columns = [
    {
      key: "name",
      header: labels.colName,
      cell: (row: ApiKeyRow) => <span className="font-medium text-ardoise">{row.name}</span>,
    },
    {
      key: "prefix",
      header: labels.colPrefix,
      cell: (row: ApiKeyRow) => (
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{row.keyPrefix}…</code>
      ),
    },
    {
      key: "scopes",
      header: labels.colScopes,
      cell: (row: ApiKeyRow) => (
        <span className="text-sm text-ardoise/80">
          {row.scopes.includes("mail:send") ? labels.scopeMailSend : row.scopes.join(", ")}
        </span>
      ),
    },
    {
      key: "lastUsed",
      header: labels.colLastUsed,
      cell: (row: ApiKeyRow) => (
        <span className="text-sm text-ardoise/80">
          {row.lastUsedAt ? formatDate(row.lastUsedAt, "fr-FR") : labels.neverUsed}
        </span>
      ),
    },
    {
      key: "created",
      header: labels.colCreated,
      cell: (row: ApiKeyRow) => (
        <span className="text-sm text-ardoise/80">{formatDate(row.createdAt, "fr-FR")}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: CRUD_ACTIONS_HEADER_CLASS,
      cellClassName: CRUD_ACTIONS_CELL_CLASS,
      cell: (row: ApiKeyRow) => (
        <CrudRowActions>
          <form action={revokeAction}>
            <input type="hidden" name="keyId" value={row.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-red-700">
              {labels.revoke}
            </Button>
          </form>
        </CrudRowActions>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader title={labels.title} description={labels.intro} />

      {revealedToken && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium text-amber-950">{labels.tokenRevealTitle}</p>
              <p className="text-sm text-amber-900/90">{labels.tokenRevealHint}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="block max-w-full overflow-x-auto rounded bg-white px-2 py-1 text-xs">
                  {revealedToken}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(revealedToken, "token")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {copied === "token" ? labels.copied : labels.copy}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-canal bg-white p-4">
        <p className="text-sm font-medium text-ardoise">{labels.endpointLabel}</p>
        <code className="mt-1 block text-sm text-ardoise/90">{endpoint}</code>
      </div>

      <div className="rounded-lg border border-canal bg-white p-4 space-y-3">
        <p className="font-medium text-ardoise">{labels.curlTitle}</p>
        <p className="text-sm text-ardoise/80">{labels.curlHint}</p>
        <pre className="overflow-x-auto rounded bg-neutral-50 p-3 text-xs leading-relaxed">
          {curlExample}
        </pre>
        <Button type="button" variant="outline" size="sm" onClick={() => copyText(curlExample, "curl")}>
          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {copied === "curl" ? labels.copied : labels.copy}
        </Button>
      </div>

      <div className="rounded-lg border border-canal bg-white p-4">
        <p className="font-medium text-ardoise">{labels.verifiedDomainsTitle}</p>
        {verifiedDomains.length === 0 ? (
          <p className="mt-2 text-sm text-ardoise/80">{labels.verifiedDomainsEmpty}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {verifiedDomains.map((fqdn) => (
              <li key={fqdn}>
                <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{fqdn}</code>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <CrudAddButton label={labels.create} onClick={() => setCreateOpen(true)} />
      </div>

      <DataTable
        columns={columns}
        rows={keys}
        rowKey={(row) => row.id}
        emptyMessage={t("empty")}
      />

      <FormFeedback state={createState} namespace="apiKeys" />
      <FormFeedback state={revokeState} namespace="apiKeys" />

      <FormDrawer open={createOpen} onOpenChange={setCreateOpen} title={labels.create}>
        <form action={createAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key-name">{labels.name}</Label>
            <Input
              id="api-key-name"
              name="name"
              placeholder={labels.namePlaceholder}
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={createPending}>
              {createPending ? labels.creating : labels.create}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
