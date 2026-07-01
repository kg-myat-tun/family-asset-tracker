"use client";

import { Handshake, LayoutDashboard, TrendingUp, User, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Family } from "@/types";

const NAV_ITEMS = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard },
  { href: "/assets", key: "assets", icon: Wallet },
  { href: "/income", key: "income", icon: TrendingUp },
  { href: "/loans", key: "loans", icon: Handshake },
  { href: "/members", key: "members", icon: Users },
  { href: "/profile", key: "profile", icon: User },
] as const;

export function Sidebar({ family, onNavigate }: { family: Family; onNavigate?: () => void }) {
  const { dict } = useI18n();
  const pathname = usePathname();

  return (
    <aside className="w-60 h-full bg-card border-r border-line flex flex-col">
      <div className="h-14 shrink-0 px-4 flex items-center gap-3 border-b border-line">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white font-bold text-sm shadow-sm shrink-0">
          {family.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] text-muted uppercase tracking-wider">{dict.sidebar.family}</p>
          <p className="font-semibold text-foreground truncate text-sm">{family.name}</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium min-h-11 transition-colors ${
                active
                  ? "bg-accent-soft text-accent-strong"
                  : "text-foreground/80 hover:bg-foreground/4"
              }`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
              {dict.nav[item.key]}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-line">
        <p className="text-[11px] text-muted">{dict.sidebar.appName}</p>
      </div>
    </aside>
  );
}
