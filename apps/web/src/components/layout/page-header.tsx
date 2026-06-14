import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 border-b border-canal pb-4", className)}>
      <h1 className="text-balance text-xl font-semibold tracking-tight text-ardoise md:text-2xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 max-w-2xl text-sm text-ardoise/70">{description}</p>
      ) : null}
    </header>
  );
}
