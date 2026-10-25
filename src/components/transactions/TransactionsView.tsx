"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CashflowTrend } from "@/components/transactions/CashflowTrend";
import { TransactionList } from "@/components/transactions/TransactionList";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { plural } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember, MonthlySummary, Transaction } from "@/types";

interface Props {
  familyId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  members: FamilyMember[];
  dict: Dictionary;
}

export function TransactionsView({ familyId, baseCurrency, rates, members, dict }: Props) {
  const { data: transactions = [] } = useQuery({
    queryKey: keys.transactions.list(familyId),
    queryFn: () => fetchJson<Transaction[]>("/api/transactions"),
  });
  const { data: summaries = [] } = useQuery({
    queryKey: keys.monthlySummaries.list(familyId),
    queryFn: () => fetchJson<MonthlySummary[]>("/api/monthly-summaries"),
  });

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m.displayName])),
    [members],
  );

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter(
    (t) => t.date.toISOString().slice(0, 7) === currentMonth,
  );
  const monthlyIncome = monthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + convertAmount(t.amount, t.currency, baseCurrency, rates), 0);
  const monthlyExpense = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + convertAmount(t.amount, t.currency, baseCurrency, rates), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {dict.transactions.title}
          </h1>
          <p className="text-sm text-muted mt-1">
            {transactions.length}{" "}
            {plural(transactions.length, dict.transactions.unitOne, dict.transactions.unitOther)} ·{" "}
            {baseCurrency}
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link
            href="/transactions/recurring"
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium border border-line text-foreground/80 hover:bg-foreground/4"
          >
            {dict.transactions.manageRecurring}
          </Link>
          <Link href="/transactions/new" className="btn-primary">
            {dict.transactions.addTransaction}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{dict.transactions.monthlyIncome}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tracking-tight tabular-nums">
              {formatCurrency(monthlyIncome, baseCurrency)}
            </p>
          </div>
          <span className="icon-chip">
            <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
          </span>
        </div>
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{dict.transactions.monthlyExpense}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tracking-tight tabular-nums">
              {formatCurrency(monthlyExpense, baseCurrency)}
            </p>
          </div>
          <span className="icon-chip">
            <ArrowDownLeft className="w-5 h-5" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="icon-chip">
            <Wallet className="w-5 h-5" aria-hidden="true" />
          </span>
          <h2 className="font-semibold text-foreground">{dict.transactions.trendTitle}</h2>
        </div>
        <CashflowTrend summaries={summaries} currency={baseCurrency} />
      </div>

      <TransactionList transactions={transactions} memberMap={memberMap} dict={dict} />
    </div>
  );
}
