import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <img src="/logo.png" alt="Legal Wakeely" className="h-12 w-auto" width={428} height={189} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="py-4 px-6 text-center">
        <p className="text-[10px] text-muted-foreground/50 max-w-md mx-auto">
          Legal Wakeely does not provide legal advice. Platform flags are informational only and do not constitute legal findings of negligence.
        </p>
      </footer>
    </div>
  );
}
