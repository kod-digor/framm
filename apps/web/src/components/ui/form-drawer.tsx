"use client";

import { type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Largeur drawer CRUD : quasi plein écran, plafonnée à 1200px. */
export const FORM_DRAWER_WIDTH_CLASS =
  "!w-[min(1200px,92vw)] !max-w-[min(1200px,92vw)]";

type FormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titre obligatoire — annoncé aux lecteurs d'écran via SheetTitle. */
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
  /** Masque visuellement le titre tout en le conservant pour l'accessibilité. */
  hideTitle?: boolean;
};

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  contentClassName,
  bodyClassName,
  hideTitle = false,
}: FormDrawerProps) {
  const resolvedTitle = title.trim() || "\u00a0";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        side="right"
        {...(!description ? { "aria-describedby": undefined } : {})}
        className={cn(
          "flex h-full flex-col gap-0 p-0",
          FORM_DRAWER_WIDTH_CLASS,
          contentClassName
        )}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-canal px-6 py-5 pr-14">
          <SheetTitle className={hideTitle ? "sr-only" : undefined}>{resolvedTitle}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <div className={cn("flex-1 overflow-y-auto px-6 py-5", bodyClassName)}>{children}</div>

        {footer ? (
          <SheetFooter className="shrink-0 border-t border-canal bg-white px-6 py-4">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** Alias sémantique pour les opérations CRUD. */
export const CrudDrawer = FormDrawer;
