import type { Family } from "@/types";
import { LogoutButton } from "./LogoutButton";

interface HeaderProps {
  user: { uid: string; email: string };
  family: Family;
  onMenuClick?: () => void;
}

export function Header({ user, family, onMenuClick }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>Menu</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
        <span className="text-sm text-gray-500 truncate">Base currency: {family.baseCurrency}</span>
      </div>
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <span className="hidden sm:inline text-sm text-gray-700 truncate">{user.email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
