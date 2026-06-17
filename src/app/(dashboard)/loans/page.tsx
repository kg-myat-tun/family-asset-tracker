import Link from "next/link";
import { LoanList } from "@/components/loans/LoanList";
import { requireUser } from "@/lib/auth.server";
import { convertAmount, formatCurrency, getCachedRates } from "@/lib/currency.server";
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

  const active = visibleLoans.filter((l) => l.status !== "settled");
  const owedToYou = active
    .filter((l) => l.lenderId === user.uid)
    .reduce(
      (sum, l) => sum + convertAmount(l.remainingAmount, l.currency, family.baseCurrency, rates),
      0,
    );
  const youOwe = active
    .filter((l) => l.borrowerId === user.uid)
    .reduce(
      (sum, l) => sum + convertAmount(l.remainingAmount, l.currency, family.baseCurrency, rates),
      0,
    );
  const net = owedToYou - youOwe;
  const count = visibleLoans.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Loans</h1>
          <p className="text-sm text-muted mt-1">
            {count} {count === 1 ? "loan" : "loans"} · {family.baseCurrency}
          </p>
        </div>
        <Link href="/loans/new" className="btn-primary shrink-0">
          + New loan
        </Link>
      </div>

      {count > 0 && (
        <div className="card p-5 grid grid-cols-3 divide-x divide-line">
          <Stat
            label="You're owed"
            value={formatCurrency(owedToYou, family.baseCurrency)}
            tone="pos"
          />
          <Stat label="You owe" value={formatCurrency(youOwe, family.baseCurrency)} tone="neg" />
          <Stat
            label="Net position"
            value={formatCurrency(net, family.baseCurrency)}
            tone={net >= 0 ? "pos" : "neg"}
          />
        </div>
      )}

      <div className="flex gap-1 bg-foreground/6 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/loans?tab=${t}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-card shadow-sm text-foreground"
                : "text-muted hover:text-foreground/80"
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

function Stat({ label, value, tone }: { label: string; value: string; tone: "pos" | "neg" }) {
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`text-base sm:text-lg font-bold tracking-tight tabular-nums truncate ${
          tone === "pos"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
