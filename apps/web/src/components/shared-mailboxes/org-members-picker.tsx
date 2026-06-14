"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OrgMemberOption = {
  userId: string;
  label: string;
  email: string;
};

export function OrgMembersPicker({
  members,
  selectedIds,
  onChange,
  idPrefix = "members",
  required = true,
}: {
  members: OrgMemberOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  idPrefix?: string;
  required?: boolean;
}) {
  const t = useTranslations("sharedMailboxes");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.label.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, query]);

  const toggle = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-search`}>{t("membersLabel")}</Label>
      <p className="text-xs text-ardoise/50">{t("membersHint")}</p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ardoise/40" />
        <Input
          id={`${idPrefix}-search`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("membersSearchPlaceholder")}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      <div
        className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-canal bg-white p-2"
        role="group"
        aria-label={t("membersLabel")}
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-ardoise/50">{t("membersEmpty")}</p>
        ) : (
          filtered.map((member) => {
            const checked = selectedIds.includes(member.userId);
            const inputId = `${idPrefix}-${member.userId}`;
            return (
              <label
                key={member.userId}
                htmlFor={inputId}
                className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-neutral-50"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  name="memberIds"
                  value={member.userId}
                  checked={checked}
                  onChange={() => toggle(member.userId)}
                  className="mt-0.5 size-4 shrink-0 rounded border-canal"
                  required={required && selectedIds.length === 0}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-encre">{member.label}</span>
                  <span className="block font-mono-data text-xs text-ardoise/60">{member.email}</span>
                </span>
              </label>
            );
          })
        )}
      </div>

      {selectedIds.length > 0 ? (
        <p className="text-xs text-ardoise/50">
          {t("membersSelected", { count: selectedIds.length })}
        </p>
      ) : null}
    </div>
  );
}
