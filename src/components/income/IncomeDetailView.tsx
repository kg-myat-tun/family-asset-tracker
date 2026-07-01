"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DeleteIncomeButton } from "@/components/income/DeleteIncomeButton";
import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { monthlyEquivalent } from "@/lib/income";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { Income } from "@/types";

interface Props {
  familyId: string;
  incomeId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  ownerName: string;
  canMutate: boolean;
  dict: Dictionary;
}

export function IncomeDetailView({
  familyId,
  incomeId,
  baseCurrency,
  rates,
  ownerName,
  canMutate,
  dict,
}: Props) {
  const { data: income } = useQuery({
    queryKey: keys.income.detail(familyId, incomeId),
    queryFn: () => fetchJson<Income>(`/api/income/${incomeId}`),
  });

  if (!income) return null;

  const perMonth = convertAmount(
    monthlyEquivalent(income.amount, income.frequency),
    income.currency,
    baseCurrency,
    rates,
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{income.name}</h1>
          <VisibilityBadge visibility={income.visibility} />
        </div>
        {canMutate && (
          <div className="flex items-center gap-3">
            <Link
              href={`/income/${income.id}/edit`}
              className="text-sm text-accent hover:underline"
            >
              {dict.income.edit}
            </Link>
            <DeleteIncomeButton incomeId={income.id} label={income.name} />
          </div>
        )}
      </div>

      <dl className="bg-card rounded-xl border border-line divide-y divide-line">
        <Row label={dict.income.amount}>
          <span className="font-semibold">{formatCurrency(income.amount, income.currency)}</span>
        </Row>
        <Row label={dict.income.frequency}>{dict.income.frequencies[income.frequency]}</Row>
        {income.frequency !== "one_off" && (
          <Row label={dict.income.monthlyIncome}>
            <span className="font-semibold">{formatCurrency(perMonth, baseCurrency)}</span>
          </Row>
        )}
        {income.frequency === "one_off" && income.receivedAt && (
          <Row label={dict.income.receivedAt}>{income.receivedAt.toLocaleDateString()}</Row>
        )}
        <Row label={dict.income.owner}>{ownerName}</Row>
        {income.description && <Row label={dict.income.description}>{income.description}</Row>}
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground text-right">{children}</dd>
    </div>
  );
}
