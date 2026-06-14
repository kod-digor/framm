"use client";

import type { ReactNode } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";

type FormEditDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
};

/** @deprecated Prefer FormDrawer directly — kept for backward-compatible imports. */
export function FormEditDialog({
  trigger,
  title,
  description,
  open,
  onOpenChange,
  children,
  footer,
  contentClassName,
  bodyClassName,
}: FormEditDialogProps) {
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      trigger={trigger}
      footer={footer}
      contentClassName={contentClassName}
      bodyClassName={bodyClassName}
    >
      {children}
    </FormDrawer>
  );
}
