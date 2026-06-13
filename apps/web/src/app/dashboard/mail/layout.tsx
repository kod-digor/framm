export default function MailLayout({ children }: { children: React.ReactNode }) {
  return <div className="-m-6 flex min-h-[calc(100dvh-4rem)] flex-col md:-m-8">{children}</div>;
}
