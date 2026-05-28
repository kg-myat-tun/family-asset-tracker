import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { LoanAlerts } from "@/components/dashboard/LoanAlerts";
import { NetWorthChart } from "@/components/dashboard/NetWorthChart";
import { RecentAssets } from "@/components/dashboard/RecentAssets";
import { requireUser } from "@/lib/auth.server";
import { formatCurrency } from "@/lib/currency.server";
import { getDashboardData } from "@/lib/dashboard.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";

export default async function DashboardPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const members = await getFamilyMembers(family.id);
  const data = await getDashboardData(family.id, members, family.baseCurrency);

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-sm text-gray-500 mb-1">Total family net worth</p>
        <p className="text-4xl font-bold text-gray-900">
          {formatCurrency(data.totalNetWorth, family.baseCurrency)}
        </p>
        <p className="text-sm text-gray-400 mt-1">{family.baseCurrency} equivalent</p>
      </div>

      {data.overdueLoans.length > 0 && <LoanAlerts loans={data.overdueLoans} members={members} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Assets by member</h2>
          <NetWorthChart
            data={data.memberSummaries.map((s) => ({
              name: s.member.displayName,
              value: s.totalInBase,
            }))}
            currency={family.baseCurrency}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Outstanding loans</h2>
          <div className="space-y-2">
            {data.activeLoans.length === 0 ? (
              <p className="text-gray-400 text-sm">No outstanding loans 🎉</p>
            ) : (
              data.activeLoans.slice(0, 5).map((loan) => {
                const lender = members.find((m) => m.uid === loan.lenderId);
                const borrower = members.find((m) => m.uid === loan.borrowerId);
                return (
                  <div key={loan.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {lender?.displayName} → {borrower?.displayName}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(loan.remainingAmount, loan.currency)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentAssets assets={data.recentAssets} />
        <ActivityFeed familyId={family.id} />
      </div>
    </div>
  );
}
