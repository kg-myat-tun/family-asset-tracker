"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LoanList } from "@/components/loans/LoanList";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { plural } from "@/lib/i18n/dictionaries";
import { liveLoanState } from "@/lib/loan-interest";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember, Loan } from "@/types";

const TABS = ["all", "lent", "owed"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  familyId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  members: FamilyMember[];
  currentUid: string;
  dict: Dictionary;
  tab: Tab;
}

export function LoansView({
  familyId,
  baseCurrency,
  rates,
  members,
  currentUid,
  dict,
  tab,
}: Props) {
  const { data: loans = [] } = useQuery({
    queryKey: keys.loans.list(familyId),
    queryFn: () => fetchJson<Loan[]>("/api/loans"),
  });

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const today = new Date();

  const filtered =
    tab === "lent"
      ? loans.filter((l) => l.lenderId === currentUid)
      : tab === "owed"
        ? loans.filter((l) => l.borrowerId === currentUid)
        : loans;

  const active = loans.filter((l) => l.status !== "settled");
  const owedToYou = active
    .filter((l) => l.lenderId === currentUid)
    .reduce(
      (sum, l) => sum + convertAmount(liveLoanState(l).totalOwed, l.currency, baseCurrency, rates),
      0,
    );
  const youOwe = active
    .filter((l) => l.borrowerId === currentUid)
    .reduce(
      (sum, l) => sum + convertAmount(liveLoanState(l).totalOwed, l.currency, baseCurrency, rates),
      0,
    );
  const net = owedToYou - youOwe;
  const count = loans.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{dict.loans.title}</h1>
          <p className="text-sm text-muted mt-1">
            {count} {plural(count, dict.loans.unitOne, dict.loans.unitOther)} · {baseCurrency}
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
            value={formatCurrency(owedToYou, baseCurrency)}
            tone="pos"
          />
          <Stat label={dict.loans.youOwe} value={formatCurrency(youOwe, baseCurrency)} tone="neg" />
          <Stat
            label={dict.loans.netPosition}
            value={formatCurrency(net, baseCurrency)}
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
            {t === "lent"
              ? dict.loans.tabLent
              : t === "owed"
                ? dict.loans.tabOwe
                : dict.loans.tabAll}
          </Link>
        ))}
      </div>

      <LoanList
        loans={filtered}
        memberMap={memberMap}
        currentUid={currentUid}
        baseCurrency={baseCurrency}
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
