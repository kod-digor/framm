"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crudDeleteIconButtonClass } from "@/components/ui/crud-row-actions";

export function ConfirmSubmitButton({
  messageKey,
  namespace,
  children,
  variant = "ghost",
  size = "sm",
  className,
  iconOnly = false,
  ariaLabel,
}: {
  messageKey: string;
  namespace: "users" | "sharedMailboxes" | "mailDelegation" | "mailFilters";
  children?: React.ReactNode;
  variant?: "ghost" | "destructive" | "outline";
  size?: "sm" | "default";
  className?: string;
  iconOnly?: boolean;
  ariaLabel?: string;
}) {
  const t = useTranslations(namespace);
  const tc = useTranslations("common");
  const label = ariaLabel ?? (children != null ? undefined : tc("delete"));

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={iconOnly ? crudDeleteIconButtonClass : className}
      aria-label={label}
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        const msg = (t as (key: string) => string)(messageKey);
        if (!window.confirm(msg)) {
          e.preventDefault();
        }
      }}
    >
      {iconOnly ? <Trash2 className="size-4" aria-hidden /> : (children ?? tc("delete"))}
    </Button>
  );
}
