import Link from "next/link";
import { LoanList } from "@/components/loans/LoanList";
import { requireUser } from "@/lib/auth.server";
import { convertAmount, formatCurrency, getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { plural } from "@/lib/i18n/dictionaries";
import { getServerI18n } from "@/lib/i18n/server";
import { liveLoanState } from "@/lib/loan-interest";
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

  const [loans, members, rates, { dict }] = await Promise.all([
    getLoans(family.id),
    getFamilyMembers(family.id),
    getCachedRates(family.id),
    getServerI18n(),
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
      (sum, l) =>
        sum + convertAmount(liveLoanState(l).totalOwed, l.currency, family.baseCurrency, rates),
      0,
    );
  const youOwe = active
    .filter((l) => l.borrowerId === user.uid)
    .reduce(
      (sum, l) =>
        sum + convertAmount(liveLoanState(l).totalOwed, l.currency, family.baseCurrency, rates),
      0,
    );
  const net = owedToYou - youOwe;
  const count = visibleLoans.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{dict.loans.title}</h1>
          <p className="text-sm text-muted mt-1">
            {count} {plural(count, dict.loans.unitOne, dict.loans.unitOther)} ·{" "}
            {family.baseCurrency}
          </p>
        </div>
        <Link href="/loans/new" className="btn-primary shrink-0">
          {dict.loans.newLoan}
        </Link>
      </div>

      {count > 0 && (
        <div className="card p-5 grid grid-cols-3 divide-x divide-line">
          <Stat
            label={dict.loans.youreOwed}
            value={formatCurrency(owedToYou, family.baseCurrency)}
            tone="pos"
          />
          <Stat
            label={dict.loans.youOwe}
            value={formatCurrency(youOwe, family.baseCurrency)}
            tone="neg"
          />
          <Stat
            label={dict.loans.netPosition}
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
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? "bg-card shadow-sm text-foreground"
                : "text-muted hover:text-foreground/80"
            }`}
          >
            {t === "lent" ? dict.loans.tabLent : t === "owed" ? dict.loans.tabOwe : dict.loans.tabAll}
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
        dict={dict}
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
