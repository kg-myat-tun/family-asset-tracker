import { ArrowDownLeft, ArrowUpRight, ChevronRight, Handshake, Lock } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { convertAmount, formatCurrency } from "@/lib/currency.server";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { liveLoanState } from "@/lib/loan-interest";
import { borrowerName, isExternalParty, lenderName } from "@/lib/loan-party";
import type { FamilyMember, Loan, LoanStatus } from "@/types";

interface Props {
  loans: Loan[];
  memberMap: Record<string, FamilyMember>;
  currentUid: string;
  baseCurrency: string;
  rates: Record<string, number>;
  today: Date;
  dict: Dictionary;
}

const STATUS_STYLES = {
  active: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  partially_paid: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  settled: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export function LoanList({
  loans,
  memberMap,
  currentUid,
  baseCurrency,
  rates,
  today,
  dict,
}: Props) {
  const statusLabels: Record<LoanStatus, string> = {
    active: dict.loans.statusActive,
    partially_paid: dict.loans.statusPartiallyPaid,
    settled: dict.loans.statusSettled,
  };

  if (loans.length === 0) {
    return (
      <EmptyState
        icon={Handshake}
        title={dict.loans.noLoansTitle}
        description={dict.loans.noLoansDesc}
        action={{ label: dict.loans.newLoan, href: "/loans/new" }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {loans.map((loan) => {
        const isLender = loan.lenderId === currentUid;
        const isBorrower = loan.borrowerId === currentUid;
        const relation = isLender
          ? {
              verb: dict.loans.relLentTo,
              who: borrowerName(loan, memberMap),
              external: isExternalParty(loan.borrowerId),
            }
          : isBorrower
            ? {
                verb: dict.loans.relYouOwe,
                who: lenderName(loan, memberMap),
                external: isExternalParty(loan.lenderId),
              }
            : {
                verb: `${lenderName(loan, memberMap)} →`,
                who: borrowerName(loan, memberMap),
                external: isExternalParty(loan.lenderId) || isExternalParty(loan.borrowerId),
              };
        const isOverdue = loan.dueDate && loan.dueDate < today && loan.status !== "settled";
        const { principalOutstanding, totalOwed } = liveLoanState(loan);
        const repaidPct =
          loan.principalAmount > 0
            ? Math.round(
                ((loan.principalAmount - principalOutstanding) / loan.principalAmount) * 100,
              )
            : 0;
        const Icon = isLender ? ArrowUpRight : isBorrower ? ArrowDownLeft : Handshake;
        const amountColor = isLender
          ? "text-emerald-600 dark:text-emerald-400"
          : isBorrower
            ? "text-red-600 dark:text-red-400"
            : "text-foreground";

        return (
          <Link key={loan.id} href={`/loans/${loan.id}`} className="block">
            <div className="card card-hover p-4 flex items-center gap-4">
              <span className="icon-chip shrink-0">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground truncate">{loan.description}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[loan.status]}`}
                  >
                    {statusLabels[loan.status]}
                  </span>
                  {isOverdue && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-medium">
                      {dict.loans.overdue}
                    </span>
                  )}
                  {loan.visibility === "private" && (
                    <Lock
                      className="w-3.5 h-3.5 text-muted/70"
                      aria-label="Private — only visible to participants"
                    />
                  )}
                </div>
                <p className="text-sm text-muted mt-0.5 truncate">
                  {relation.verb}{" "}
                  <span className="font-medium text-foreground/80">{relation.who}</span>
                  {relation.external && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted/70">
                      {dict.common.external}
                    </span>
                  )}
                </p>
                <div className="mt-2 flex items-center gap-2 max-w-[16rem]">
                  <div className="h-1.5 flex-1 rounded-full bg-foreground/6 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${repaidPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted tabular-nums shrink-0">
                    {repaidPct}
                    {dict.loans.paidSuffix}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className={`font-semibold tabular-nums ${amountColor}`}>
                  {formatCurrency(totalOwed, loan.currency)}
                </p>
                {loan.currency !== baseCurrency && (
                  <p className="text-xs text-muted tabular-nums">
                    ≈{" "}
                    {formatCurrency(
                      convertAmount(totalOwed, loan.currency, baseCurrency, rates),
                      baseCurrency,
                    )}
                  </p>
                )}
                <p className="text-xs text-muted mt-0.5 tabular-nums">
                  {dict.common.of} {formatCurrency(loan.principalAmount, loan.currency)}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-muted/60 shrink-0" aria-hidden="true" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
