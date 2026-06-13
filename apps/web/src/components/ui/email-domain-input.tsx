"use client";

import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type EmailDomainOption = {
  value: string;
  label: string;
};

export function EmailDomainInput({
  localPart,
  onLocalPartChange,
  localPartName,
  localPartId,
  localPartPlaceholder,
  domainValue,
  onDomainChange,
  domainName,
  domainId,
  domains,
  domainAriaLabel,
  localPartRequired = true,
  domainRequired = true,
  className,
}: {
  localPart: string;
  onLocalPartChange: (value: string) => void;
  localPartName: string;
  localPartId: string;
  localPartPlaceholder?: string;
  domainValue: string;
  onDomainChange: (value: string) => void;
  domainName: string;
  domainId: string;
  domains: EmailDomainOption[];
  domainAriaLabel: string;
  localPartRequired?: boolean;
  domainRequired?: boolean;
  className?: string;
}) {
  const longestDomain = domains.reduce(
    (max, domain) => Math.max(max, domain.label.length),
    0
  );
  const selectMinWidth = Math.max(longestDomain + 2, 14);

  return (
    <div
      className={cn(
        "flex rounded-md border border-zinc-200 bg-white focus-within:ring-2 focus-within:ring-zinc-900 focus-within:ring-offset-2",
        className
      )}
    >
      <Input
        id={localPartId}
        name={localPartName}
        placeholder={localPartPlaceholder}
        required={localPartRequired}
        autoComplete="username"
        className="min-w-0 flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        value={localPart}
        onChange={(e) => onLocalPartChange(e.target.value)}
      />
      <div
        className="relative shrink-0 border-l border-zinc-200 bg-zinc-50/80"
        style={{ minWidth: `${selectMinWidth}ch` }}
      >
        <select
          id={domainId}
          name={domainName}
          required={domainRequired}
          value={domainValue}
          onChange={(e) => onDomainChange(e.target.value)}
          aria-label={domainAriaLabel}
          className="h-10 w-full appearance-none bg-transparent py-2 pl-3 pr-8 text-sm font-medium text-zinc-900 outline-none"
        >
          {domains.map((domain) => (
            <option key={domain.value} value={domain.value}>
              @{domain.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
      </div>
    </div>
  );
}
