"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { IncomeList } from "@/components/income/IncomeList";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { plural } from "@/lib/i18n/dictionaries";
import { monthlyEquivalent } from "@/lib/income";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember, Income } from "@/types";

interface Props {
  familyId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  members: FamilyMember[];
  dict: Dictionary;
}

export function IncomeView({ familyId, baseCurrency, rates, members, dict }: Props) {
  const { data: income = [] } = useQuery({
    queryKey: keys.income.list(familyId),
    queryFn: () => fetchJson<Income[]>("/api/income"),
  });

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m.displayName])),
    [members],
  );

  const monthlyTotal = income.reduce(
    (sum, i) =>
      sum +
      convertAmount(monthlyEquivalent(i.amount, i.frequency), i.currency, baseCurrency, rates),
    0,
  );
  const count = income.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{dict.income.title}</h1>
          <p className="text-sm text-muted mt-1">
            {count} {plural(count, dict.income.unitOne, dict.income.unitOther)} · {baseCurrency}
          </p>
        </div>
        <Link href="/income/new" className="btn-primary shrink-0">
          {dict.income.addIncome}
        </Link>
      </div>

      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{dict.income.monthlyTotal}</p>
          <p className="text-3xl font-bold text-foreground mt-1 tracking-tight tabular-nums">
            {formatCurrency(monthlyTotal, baseCurrency)}
          </p>
        </div>
        <span className="icon-chip">
          <TrendingUp className="w-5 h-5" aria-hidden="true" />
        </span>
      </div>

      <IncomeList
        income={income}
        memberMap={memberMap}
        baseCurrency={baseCurrency}
        rates={rates}
        dict={dict}
      />
    </div>
  );
}
