import type { Family } from "@/types";
import { LogoutButton } from "./LogoutButton";

export function Header({ user, family }: { user: { uid: string; email: string }; family: Family }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <span className="text-sm text-gray-500">Base currency: {family.baseCurrency}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">{user.email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
