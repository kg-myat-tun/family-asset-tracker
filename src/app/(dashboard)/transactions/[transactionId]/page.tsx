import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { TransactionDetailView } from "@/components/transactions/TransactionDetailView";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { getTransaction } from "@/lib/transactions.server";
import { canViewTransaction } from "@/lib/visibility";

export default async function TransactionDetailPage({
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

  const [members, { dict }] = await Promise.all([getFamilyMembers(family.id), getServerI18n()]);

  const queryClient = getQueryClient();
  queryClient.setQueryData(keys.transactions.detail(family.id, transactionId), transaction);

  const owner = members.find((m) => m.uid === transaction.ownerId);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = transaction.ownerId === user.uid || self?.role === "admin";

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TransactionDetailView
        familyId={family.id}
        transactionId={transactionId}
        ownerName={owner?.displayName ?? dict.transactions.unknownOwner}
        canMutate={canMutate}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
