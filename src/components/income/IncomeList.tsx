import { ChevronRight, Lock, Wallet } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { monthlyEquivalent } from "@/lib/income";
import type { Income } from "@/types";

interface Props {
  income: Income[];
  memberMap: Record<string, string>;
  baseCurrency: string;
  rates: Record<string, number>;
  dict: Dictionary;
  filtered?: boolean;
}

export function IncomeList({ income, memberMap, baseCurrency, rates, dict, filtered }: Props) {
  if (income.length === 0) {
    return filtered ? (
      <EmptyState
        icon={Wallet}
        title={dict.income.noMatchTitle}
        description={dict.income.noMatchDesc}
      />
    ) : (
      <EmptyState
        icon={Wallet}
        title={dict.income.noIncomeTitle}
        description={dict.income.noIncomeDesc}
        action={{ label: dict.income.addIncome, href: "/income/new" }}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {income.map((item) => {
        const perMonth = convertAmount(
          monthlyEquivalent(item.amount, item.frequency),
          item.currency,
          baseCurrency,
          rates,
        );
        return (
          <Link key={item.id} href={`/income/${item.id}`} className="block">
            <div className="card card-hover p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{item.name}</p>
                  <span className="hidden sm:inline shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong">
                    {dict.income.frequencies[item.frequency]}
                  </span>
                  {item.visibility === "private" && (
                    <Lock
                      className="shrink-0 w-3.5 h-3.5 text-muted/70"
                      aria-label={dict.income.privateLock}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted truncate">
                  {memberMap[item.ownerId] ?? dict.income.unknownOwner}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-semibold text-foreground tabular-nums">
                  {formatCurrency(item.amount, item.currency)}
                </p>
                {item.frequency !== "one_off" && (
                  <p className="text-xs text-muted tabular-nums">
                    ≈ {formatCurrency(perMonth, baseCurrency)}/mo
                  </p>
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-muted/60 shrink-0" aria-hidden="true" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
