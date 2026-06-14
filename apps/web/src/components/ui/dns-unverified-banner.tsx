import { AlertTriangle } from "lucide-react";

export function DnsUnverifiedBanner({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
