"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { MonthlySummary } from "@/types";

interface Props {
  summaries: MonthlySummary[];
  currency: string;
}

export function CashflowTrend({ summaries, currency }: Props) {
  const { dict } = useI18n();

  if (summaries.length < 2) {
    return <p className="text-muted text-sm">{dict.transactions.trendEmpty}</p>;
  }

  const data = summaries.map((s) => ({
    month: s.month.slice(5), // MM
    income: s.totalIncomeBase,
    expense: s.totalExpenseBase,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cfIncomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cfExpenseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis
          tick={{ fontSize: 11 }}
          width={56}
          tickFormatter={(v) =>
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              currency,
              style: "currency",
            }).format(v)
          }
        />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value))
          }
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#cfIncomeGradient)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#cfExpenseGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
