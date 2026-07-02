"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { RecurringRuleList } from "@/components/transactions/RecurringRuleList";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember, RecurringRule } from "@/types";

interface Props {
  familyId: string;
  members: FamilyMember[];
  dict: Dictionary;
}

export function RecurringRulesView({ familyId, members, dict }: Props) {
  const { data: rules = [] } = useQuery({
    queryKey: keys.recurringRules.list(familyId),
    queryFn: () => fetchJson<RecurringRule[]>("/api/recurring-rules"),
  });

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m.displayName])),
    [members],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {dict.transactions.recurring.title}
        </h1>
        <Link href="/transactions/recurring/new" className="btn-primary shrink-0">
          {dict.transactions.recurring.addRule}
        </Link>
      </div>
      <RecurringRuleList rules={rules} memberMap={memberMap} dict={dict} />
    </div>
  );
}
