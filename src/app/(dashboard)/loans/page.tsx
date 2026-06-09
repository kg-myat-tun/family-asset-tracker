import Link from "next/link";
import { LoanList } from "@/components/loans/LoanList";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getLoans } from "@/lib/loans.server";
import { canViewLoan } from "@/lib/visibility";

const TABS = ["all", "lent", "owed"] as const;
type Tab = (typeof TABS)[number];

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const { tab: tabParam } = await searchParams;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [loans, members, rates] = await Promise.all([
    getLoans(family.id),
    getFamilyMembers(family.id),
    getCachedRates(family.id),
  ]);

  const visibleLoans = loans.filter((l) => canViewLoan(l, user.uid));

  const tab: Tab = tabParam ?? "all";
  const filtered =
    tab === "lent"
      ? visibleLoans.filter((l) => l.lenderId === user.uid)
      : tab === "owed"
        ? visibleLoans.filter((l) => l.borrowerId === user.uid)
        : visibleLoans;

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const today = new Date();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Loans</h1>
        <Link
          href="/loans/new"
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-strong text-sm"
        >
          + New loan
        </Link>
      </div>

      <div className="flex gap-1 bg-foreground/6 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/loans?tab=${t}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-card shadow-sm text-foreground" : "text-muted hover:text-foreground/80"
            }`}
          >
            {t === "lent" ? "I lent" : t === "owed" ? "I owe" : "All"}
          </Link>
        ))}
      </div>

      <LoanList
        loans={filtered}
        memberMap={memberMap}
        currentUid={user.uid}
        baseCurrency={family.baseCurrency}
        rates={rates}
        today={today}
      />
    </div>
  );
}
