import { cn } from "@/lib/utils";

export function AliasEmailBadge({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "inline-block max-w-full truncate rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-900 ring-1 ring-inset ring-zinc-200",
        className
      )}
    >
      {email}
    </code>
  );
}
