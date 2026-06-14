export default function MailLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[calc(100dvh-4rem)] flex-col">{children}</div>;
}
