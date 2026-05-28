import Link from "next/link";
import { LoanList } from "@/components/loans/LoanList";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getLoans } from "@/lib/loans.server";

const TABS = ["all", "lent", "owed"] as const;
type Tab = (typeof TABS)[number];

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const { tab: tabParam } = await searchParams;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [loans, members, rates] = await Promise.all([
    getLoans(family.id),
    getFamilyMembers(family.id),
    getCachedRates(family.id),
  ]);

  const tab: Tab = tabParam ?? "all";
  const filtered =
    tab === "lent"
      ? loans.filter((l) => l.lenderId === user.uid)
      : tab === "owed"
        ? loans.filter((l) => l.borrowerId === user.uid)
        : loans;

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const today = new Date();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Loans</h1>
        <Link
          href="/loans/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + New loan
        </Link>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/loans?tab=${t}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "lent" ? "I lent" : t === "owed" ? "I owe" : "All"}
          </Link>
        ))}
      </div>

      <LoanList
        loans={filtered}
        memberMap={memberMap}
        currentUid={user.uid}
        baseCurrency={family.baseCurrency}
        rates={rates}
        today={today}
      />
    </div>
  );
}
