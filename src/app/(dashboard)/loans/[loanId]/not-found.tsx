import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";

export default async function LoanNotFound() {
  const { dict } = await getServerI18n();
  return (
    <div className="text-center py-24">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground/6 text-muted mb-4">
        <SearchX className="w-7 h-7" aria-hidden="true" />
      </span>
      <p className="text-lg font-medium text-foreground">{dict.ui.notFoundLoan}</p>
      <p className="text-muted text-sm">{dict.ui.mayBeDeleted}</p>
      <Link
        href="/loans"
        className="inline-flex items-center gap-1.5 mt-6 text-sm text-accent hover:underline"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {dict.ui.backToLoans}
      </Link>
    </div>
  );
}
