import { LoanForm } from "@/components/loans/LoanForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";

export default async function NewLoanPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const members = await getFamilyMembers(family.id);
  const candidates = members.filter((m) => m.uid !== user.uid);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-foreground mb-6">New loan</h1>
      <LoanForm candidates={candidates} defaultCurrency={family.baseCurrency} />
    </div>
  );
}
