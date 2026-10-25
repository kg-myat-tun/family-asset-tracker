import { ChevronRight, Lock, Repeat } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { RecurringRule } from "@/types";

interface Props {
  rules: RecurringRule[];
  memberMap: Record<string, string>;
  dict: Dictionary;
}

export function RecurringRuleList({ rules, memberMap, dict }: Props) {
  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title={dict.transactions.recurring.noRulesTitle}
        description={dict.transactions.recurring.noRulesDesc}
        action={{ label: dict.transactions.recurring.addRule, href: "/transactions/recurring/new" }}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {rules.map((rule) => (
        <Link key={rule.id} href={`/transactions/recurring/${rule.id}/edit`} className="block">
          <div className="card card-hover p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{rule.name}</p>
                <span className="hidden sm:inline shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong">
                  {dict.transactions.recurring.frequencies[rule.frequency]}
                </span>
                {!rule.active && (
                  <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-foreground/8 text-muted">
                    {dict.transactions.recurring.paused}
                  </span>
                )}
                {rule.visibility === "private" && (
                  <Lock
                    className="shrink-0 w-3.5 h-3.5 text-muted/70"
                    aria-label={dict.transactions.privateLock}
                  />
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted truncate">
                {memberMap[rule.ownerId] ?? dict.transactions.unknownOwner} ·{" "}
                {dict.transactions.recurring.nextDue}: {rule.nextDueDate.toLocaleDateString()}
              </p>
            </div>

            <p
              className={`font-semibold tabular-nums shrink-0 ${
                rule.type === "income" ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {rule.type === "income" ? "+" : "−"}
              {formatCurrency(rule.amount, rule.currency)}
            </p>

            <ChevronRight className="w-4 h-4 text-muted/60 shrink-0" aria-hidden="true" />
          </div>
        </Link>
      ))}
    </div>
  );
}
