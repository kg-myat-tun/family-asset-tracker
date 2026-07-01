"use client";

import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Handshake,
  LineChart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { LoanAlerts } from "@/components/dashboard/LoanAlerts";
import { NetWorthChart } from "@/components/dashboard/NetWorthChart";
import { NetWorthTrend } from "@/components/dashboard/NetWorthTrend";
import { RecentAssets } from "@/components/dashboard/RecentAssets";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { DashboardData } from "@/lib/dashboard.server";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { liveLoanState } from "@/lib/loan-interest";
import { borrowerName, lenderName } from "@/lib/loan-party";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember } from "@/types";

interface Props {
  familyId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  members: FamilyMember[];
  dict: Dictionary;
}

export function DashboardView({ familyId, baseCurrency, rates, members, dict }: Props) {
  const { data } = useQuery({
    queryKey: keys.dashboard(familyId),
    queryFn: () => fetchJson<DashboardData>("/api/dashboard"),
  });

  if (!data) return null;

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <section className="hero-panel rounded-3xl p-7 md:p-8 text-white">
        <p className="text-sm font-medium text-white/70">{dict.dashboard.netWorthTitle}</p>
        <p className="text-4xl md:text-5xl font-bold mt-2 tracking-tight">
          {formatCurrency(data.totalNetWorth, baseCurrency)}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span className="text-white/80">
            <span className="text-white/55">{dict.dashboard.assets}</span> ·{" "}
            {formatCurrency(data.assetsTotal, baseCurrency)}
          </span>
          <span className="text-white/80">
            <span className="text-white/55">{dict.dashboard.owedToFamily}</span> · +
            {formatCurrency(data.receivablesTotal, baseCurrency)}
          </span>
          <span className="text-white/80">
            <span className="text-white/55">{dict.dashboard.owedByFamily}</span> · −
            {formatCurrency(data.liabilitiesTotal, baseCurrency)}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={Wallet}
          label={dict.dashboard.assets}
          value={formatCurrency(data.assetsTotal, baseCurrency)}
        />
        <StatTile
          icon={TrendingUp}
          label={dict.income.monthlyIncome}
          value={formatCurrency(data.monthlyIncomeTotal, baseCurrency)}
        />
        <StatTile
          icon={ArrowUpRight}
          label={dict.dashboard.owedToFamily}
          value={formatCurrency(data.receivablesTotal, baseCurrency)}
        />
        <StatTile
          icon={ArrowDownLeft}
          label={dict.dashboard.owedByFamily}
          value={formatCurrency(data.liabilitiesTotal, baseCurrency)}
        />
      </div>

      {data.overdueLoans.length > 0 && (
        <LoanAlerts
          loans={data.overdueLoans}
          members={members}
          title={dict.dashboard.overdueLoans}
        />
      )}

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="icon-chip">
            <LineChart className="w-5 h-5" aria-hidden="true" />
          </span>
          <h2 className="font-semibold text-foreground">{dict.dashboard.netWorthOverTime}</h2>
        </div>
        <NetWorthTrend snapshots={data.snapshots} currency={baseCurrency} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="icon-chip">
              <BarChart3 className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="font-semibold text-foreground">{dict.dashboard.assetsByMember}</h2>
          </div>
          <NetWorthChart
            data={data.memberSummaries.map((s) => ({
              name: s.member.displayName,
              value: s.totalInBase,
            }))}
            currency={baseCurrency}
          />
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="icon-chip">
              <Handshake className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="font-semibold text-foreground">{dict.dashboard.outstandingLoans}</h2>
          </div>
          <div className="space-y-3">
            {data.activeLoans.length === 0 ? (
              <p className="text-muted text-sm">{dict.dashboard.noOutstandingLoans}</p>
            ) : (
              data.activeLoans.slice(0, 5).map((loan) => {
                const owed = convertAmount(
                  liveLoanState(loan).totalOwed,
                  loan.currency,
                  baseCurrency,
                  rates,
                );
                return (
                  <div key={loan.id} className="flex justify-between items-center text-sm">
                    <span className="text-foreground/70 truncate">
                      {lenderName(loan, memberMap)} → {borrowerName(loan, memberMap)}
                    </span>
                    <span className="font-semibold text-foreground tabular-nums shrink-0">
                      {formatCurrency(owed, baseCurrency)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentAssets assets={data.recentAssets} dict={dict} />
        <ActivityFeed familyId={familyId} />
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className="icon-chip">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
