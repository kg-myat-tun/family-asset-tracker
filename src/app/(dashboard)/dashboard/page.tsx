import type { LucideIcon } from "lucide-react";
import { BarChart3, Handshake, Users, Wallet } from "lucide-react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { LoanAlerts } from "@/components/dashboard/LoanAlerts";
import { NetWorthChart } from "@/components/dashboard/NetWorthChart";
import { RecentAssets } from "@/components/dashboard/RecentAssets";
import { requireUser } from "@/lib/auth.server";
import { formatCurrency } from "@/lib/currency.server";
import { getDashboardData } from "@/lib/dashboard.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { borrowerName, lenderName } from "@/lib/loan-party";

export default async function DashboardPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const members = await getFamilyMembers(family.id);
  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const data = await getDashboardData(family.id, members, family.baseCurrency, user.uid);

  const activeLoanTotal = data.activeLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const totalAssetCount = data.memberSummaries.reduce((sum, s) => sum + s.assetCount, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <section className="hero-gradient rounded-3xl p-7 md:p-8 text-white">
        <p className="text-sm font-medium text-white/70">Total family net worth</p>
        <p className="text-4xl md:text-5xl font-bold mt-2 tracking-tight">
          {formatCurrency(data.totalNetWorth, family.baseCurrency)}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span className="text-white/80">
            <span className="text-white/55">Base currency</span> · {family.baseCurrency}
          </span>
          <span className="text-white/80">
            <span className="text-white/55">Members</span> · {members.length}
          </span>
          <span className="text-white/80">
            <span className="text-white/55">Active loans</span> · {data.activeLoans.length}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile icon={Wallet} label="Assets tracked" value={String(totalAssetCount)} />
        <StatTile
          icon={Handshake}
          label="Outstanding loans"
          value={formatCurrency(activeLoanTotal, family.baseCurrency)}
        />
        <StatTile icon={Users} label="Family members" value={String(members.length)} />
      </div>

      {data.overdueLoans.length > 0 && <LoanAlerts loans={data.overdueLoans} members={members} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="icon-chip">
              <BarChart3 className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="font-semibold text-foreground">Assets by member</h2>
          </div>
          <NetWorthChart
            data={data.memberSummaries.map((s) => ({
              name: s.member.displayName,
              value: s.totalInBase,
            }))}
            currency={family.baseCurrency}
          />
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="icon-chip">
              <Handshake className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="font-semibold text-foreground">Outstanding loans</h2>
          </div>
          <div className="space-y-3">
            {data.activeLoans.length === 0 ? (
              <p className="text-muted text-sm">No outstanding loans.</p>
            ) : (
              data.activeLoans.slice(0, 5).map((loan) => {
                return (
                  <div key={loan.id} className="flex justify-between items-center text-sm">
                    <span className="text-foreground/70">
                      {lenderName(loan, memberMap)} → {borrowerName(loan, memberMap)}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(loan.remainingAmount, loan.currency)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentAssets assets={data.recentAssets} />
        <ActivityFeed familyId={family.id} />
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
