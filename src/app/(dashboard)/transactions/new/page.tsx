import { createTransactionAction } from "@/actions/transactions.actions";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NewTransactionPage() {
  const { dict } = await getServerI18n();
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.transactions.addTitle}</h1>
      <TransactionForm
        action={createTransactionAction}
        submitLabel={dict.transactions.createTransaction}
      />
    </div>
  );
}
