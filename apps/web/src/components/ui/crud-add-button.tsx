"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CrudAddButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer"
    >
      <Plus className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
