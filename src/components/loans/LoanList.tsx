import { ArrowDownLeft, ArrowUpRight, ChevronRight, Handshake, Lock } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { convertAmount, formatCurrency } from "@/lib/currency.server";
import { borrowerName, isExternalParty, lenderName } from "@/lib/loan-party";
import type { FamilyMember, Loan } from "@/types";

interface Props {
  loans: Loan[];
  memberMap: Record<string, FamilyMember>;
  currentUid: string;
  baseCurrency: string;
  rates: Record<string, number>;
  today: Date;
}

const STATUS_STYLES = {
  active: "bg-blue-50 text-blue-700",
  partially_paid: "bg-yellow-50 text-yellow-700",
  settled: "bg-green-50 text-green-700",
};

export function LoanList({ loans, memberMap, currentUid, baseCurrency, rates, today }: Props) {
  if (loans.length === 0) {
    return (
      <EmptyState
        icon={Handshake}
        title="No loans yet"
        description="Track money lent between family members so nothing slips through the cracks."
        action={{ label: "+ New loan", href: "/loans/new" }}
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
              verb: "You lent to",
              who: borrowerName(loan, memberMap),
              external: isExternalParty(loan.borrowerId),
            }
          : isBorrower
            ? {
                verb: "You owe",
                who: lenderName(loan, memberMap),
                external: isExternalParty(loan.lenderId),
              }
            : {
                verb: `${lenderName(loan, memberMap)} →`,
                who: borrowerName(loan, memberMap),
                external: isExternalParty(loan.lenderId) || isExternalParty(loan.borrowerId),
              };
        const isOverdue = loan.dueDate && loan.dueDate < today && loan.status !== "settled";
        const repaidPct =
          loan.principalAmount > 0
            ? Math.round(
                ((loan.principalAmount - loan.remainingAmount) / loan.principalAmount) * 100,
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
                    {loan.status.replace("_", " ")}
                  </span>
                  {isOverdue && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                      overdue
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
                      external
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
                    {repaidPct}% paid
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className={`font-semibold tabular-nums ${amountColor}`}>
                  {formatCurrency(loan.remainingAmount, loan.currency)}
                </p>
                {loan.currency !== baseCurrency && (
                  <p className="text-xs text-muted tabular-nums">
                    ≈{" "}
                    {formatCurrency(
                      convertAmount(loan.remainingAmount, loan.currency, baseCurrency, rates),
                      baseCurrency,
                    )}
                  </p>
                )}
                <p className="text-xs text-muted mt-0.5 tabular-nums">
                  of {formatCurrency(loan.principalAmount, loan.currency)}
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
