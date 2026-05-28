import Link from "next/link";
import type { Family } from "@/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/assets", label: "Assets", icon: "💰" },
  { href: "/loans", label: "Loans", icon: "🤝" },
  { href: "/members", label: "Members", icon: "👥" },
];

export function Sidebar({ family, onNavigate }: { family: Family; onNavigate?: () => void }) {
  return (
    <aside className="w-56 h-full bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Family</p>
        <p className="font-semibold text-gray-900 truncate">{family.name}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium min-h-[44px]"
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
