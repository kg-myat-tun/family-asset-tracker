import type { Family, FamilyMember } from "@/types";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  user: { uid: string; email: string };
  family: Family;
  members: FamilyMember[];
  children: React.ReactNode;
}

export function AppShell({ user, family, children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar family={family} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} family={family} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
