"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  disabled,
  id,
  name,
  value,
  "aria-label": ariaLabel,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  id: string;
  name?: string;
  value?: string;
  "aria-label": string;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="submit"
      name={name}
      value={value}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer touch-manipulation rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-encre" : "bg-canal",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
