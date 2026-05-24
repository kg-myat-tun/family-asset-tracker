import { LogoutButton } from "@/components/layout/LogoutButton";

interface AppShellProps {
  children: React.ReactNode;
  userId: string;
}

export function AppShell({ children, userId }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-accent">
              Family Asset Tracker
            </p>
            <p className="mt-1 text-sm text-muted">Signed in as {userId}</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      {children}
    </div>
  );
}
