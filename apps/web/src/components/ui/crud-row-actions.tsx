import type { ReactNode } from "react";

/** Colonne Actions : largeur minimale, pas de retour à la ligne. */
export const CRUD_ACTIONS_HEADER_CLASS = "w-[1%] min-w-[6rem] whitespace-nowrap";
export const CRUD_ACTIONS_CELL_CLASS = "w-[1%] whitespace-nowrap";

export const crudIconButtonClass =
  "size-8 shrink-0 p-0 text-ardoise/60 hover:text-encre";

export const crudDeleteIconButtonClass =
  "size-8 shrink-0 p-0 text-ardoise/60 hover:text-red-600";

export function CrudRowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>;
}
