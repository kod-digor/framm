"use client";

import type { ReactNode } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";

type FormCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/** @deprecated Prefer FormDrawer directly — kept for backward-compatible imports. */
export function FormCreateDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: FormCreateDialogProps) {
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      {children}
    </FormDrawer>
  );
}
