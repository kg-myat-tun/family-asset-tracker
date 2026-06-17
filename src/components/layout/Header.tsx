import { useI18n } from "@/components/i18n/I18nProvider";
import type { Family } from "@/types";
import { LanguageToggle } from "./LanguageToggle";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  user: { uid: string; email: string };
  family: Family;
  onMenuClick?: () => void;
}

export function Header({ user, family, onMenuClick }: HeaderProps) {
  const { dict } = useI18n();
  return (
    <header className="h-14 bg-card/80 backdrop-blur border-b border-line flex items-center justify-between px-4 md:px-6 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="md:hidden p-2 -ml-2 text-muted hover:text-foreground"
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
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {dict.header.baseCurrency}: {family.baseCurrency}
        </span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 min-w-0">
        <span className="hidden sm:inline text-sm text-foreground/70 truncate">{user.email}</span>
        <NotificationBell familyId={family.id} />
        <LanguageToggle />
        <ThemeToggle />
        <LogoutButton label={dict.header.signOut} loadingLabel={dict.header.signingOut} />
      </div>
    </header>
  );
}
