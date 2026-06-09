import Link from "next/link";

export default function LoanNotFound() {
  return (
    <div className="text-center py-24">
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-lg font-medium text-foreground">Loan not found</p>
      <p className="text-muted text-sm">It may have been deleted.</p>
      <Link href="/loans" className="inline-block mt-6 text-sm text-accent hover:underline">
        ← Back to loans
      </Link>
    </div>
  );
}
