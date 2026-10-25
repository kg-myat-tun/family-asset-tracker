"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { Transaction } from "@/types";

interface Props {
  familyId: string;
  transactionId: string;
  ownerName: string;
  canMutate: boolean;
  dict: Dictionary;
}

export function TransactionDetailView({
  familyId,
  transactionId,
  ownerName,
  canMutate,
  dict,
}: Props) {
  const { data: transaction } = useQuery({
    queryKey: keys.transactions.detail(familyId, transactionId),
    queryFn: () => fetchJson<Transaction>(`/api/transactions/${transactionId}`),
  });

  if (!transaction) return null;

  const categoryLabel =
    transaction.category === "other" && transaction.customLabel
      ? transaction.customLabel
      : dict.transactions.categories[transaction.category];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{transaction.name}</h1>
          <VisibilityBadge visibility={transaction.visibility} />
        </div>
        {canMutate && (
          <div className="flex items-center gap-3">
            <Link
              href={`/transactions/${transaction.id}/edit`}
              className="text-sm text-accent hover:underline"
            >
              {dict.transactions.edit}
            </Link>
            <DeleteTransactionButton transactionId={transaction.id} label={transaction.name} />
          </div>
        )}
      </div>

      <dl className="bg-card rounded-xl border border-line divide-y divide-line">
        <Row label={dict.transactions.type}>
          {transaction.type === "income"
            ? dict.transactions.typeIncome
            : dict.transactions.typeExpense}
        </Row>
        <Row label={dict.transactions.amount}>
          <span className="font-semibold">
            {formatCurrency(transaction.amount, transaction.currency)}
          </span>
        </Row>
        <Row label={dict.transactions.category}>{categoryLabel}</Row>
        <Row label={dict.transactions.date}>{transaction.date.toLocaleDateString()}</Row>
        {transaction.recurringRuleId && (
          <Row label={dict.transactions.recurringBadge}>
            <Link
              href={`/transactions/recurring/${transaction.recurringRuleId}/edit`}
              className="text-accent hover:underline"
            >
              {dict.transactions.recurring.title}
            </Link>
          </Row>
        )}
        <Row label={dict.transactions.owner}>{ownerName}</Row>
        {transaction.description && (
          <Row label={dict.transactions.description}>{transaction.description}</Row>
        )}
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
