import { notFound, redirect } from "next/navigation";
import { updateTransactionAction } from "@/actions/transactions.actions";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getTransaction } from "@/lib/transactions.server";
import { canViewTransaction } from "@/lib/visibility";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const transaction = await getTransaction(family.id, transactionId);
  if (!transaction || !canViewTransaction(transaction, user.uid)) notFound();

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = transaction.ownerId === user.uid || self?.role === "admin";
  if (!canMutate) redirect(`/transactions/${transaction.id}`);

  const boundAction = updateTransactionAction.bind(null, transaction.id);
  const { dict } = await getServerI18n();

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.transactions.editTitle}</h1>
      <TransactionForm
        action={boundAction}
        defaultValues={transaction}
        submitLabel={dict.common.saveChanges}
      />
    </div>
  );
}
