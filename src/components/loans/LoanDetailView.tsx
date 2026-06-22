"use client";

import { useQuery } from "@tanstack/react-query";
import { LoanDetail } from "@/components/loans/LoanDetail";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember, Loan, Repayment } from "@/types";

interface Props {
  familyId: string;
  loanId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  members: FamilyMember[];
  canAct: boolean;
  canMutate: boolean;
  dict: Dictionary;
}

type LoanDetailPayload = { loan: Loan; repayments: Repayment[] };

export function LoanDetailView({
  familyId,
  loanId,
  baseCurrency,
  rates,
  members,
  canAct,
  canMutate,
  dict,
}: Props) {
  const { data } = useQuery({
    queryKey: keys.loans.detail(familyId, loanId),
    queryFn: () => fetchJson<LoanDetailPayload>(`/api/loans/${loanId}`),
  });

  if (!data) return null;

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));

  return (
    <LoanDetail
      loan={data.loan}
      repayments={data.repayments}
      memberMap={memberMap}
      baseCurrency={baseCurrency}
      rates={rates}
      canAct={canAct}
      canMutate={canMutate}
      dict={dict}
    />
  );
}
