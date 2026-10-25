import { ChevronRight, Lock, Repeat } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Transaction } from "@/types";

interface Props {
  transactions: Transaction[];
  memberMap: Record<string, string>;
  dict: Dictionary;
  filtered?: boolean;
}

export function TransactionList({ transactions, memberMap, dict, filtered }: Props) {
  if (transactions.length === 0) {
    return filtered ? (
      <EmptyState
        icon={Repeat}
        title={dict.transactions.noMatchTitle}
        description={dict.transactions.noMatchDesc}
      />
    ) : (
      <EmptyState
        icon={Repeat}
        title={dict.transactions.noTransactionsTitle}
        description={dict.transactions.noTransactionsDesc}
        action={{ label: dict.transactions.addTransaction, href: "/transactions/new" }}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {transactions.map((t) => (
        <Link key={t.id} href={`/transactions/${t.id}`} className="block">
          <div className="card card-hover p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{t.name}</p>
                <span className="hidden sm:inline shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong">
                  {t.category === "other" && t.customLabel
                    ? t.customLabel
                    : dict.transactions.categories[t.category]}
                </span>
                {t.recurringRuleId && (
                  <Repeat
                    className="shrink-0 w-3.5 h-3.5 text-muted/70"
                    aria-label={dict.transactions.recurringBadge}
                  />
                )}
                {t.visibility === "private" && (
                  <Lock
                    className="shrink-0 w-3.5 h-3.5 text-muted/70"
                    aria-label={dict.transactions.privateLock}
                  />
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted truncate">
                {memberMap[t.ownerId] ?? dict.transactions.unknownOwner} ·{" "}
                {t.date.toLocaleDateString()}
              </p>
            </div>

            <p
              className={`font-semibold tabular-nums shrink-0 ${
                t.type === "income" ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {t.type === "income" ? "+" : "−"}
              {formatCurrency(t.amount, t.currency)}
            </p>

            <ChevronRight className="w-4 h-4 text-muted/60 shrink-0" aria-hidden="true" />
          </div>
        </Link>
      ))}
    </div>
  );
}
