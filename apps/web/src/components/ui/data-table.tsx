import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: ReactNode;
  className?: string;
}) {
  if (rows.length === 0) {
    return emptyMessage ? (
      <div className="text-sm text-ardoise/60">{emptyMessage}</div>
    ) : null;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-canal text-ardoise/60">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn("pb-2 pr-4 font-medium last:pr-0", column.headerClassName)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-canal/60 align-middle last:border-0">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("py-3 pr-4 last:pr-0", column.cellClassName)}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
