import Link from "next/link";

export default function LoanNotFound() {
  return (
    <div className="text-center py-24">
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-lg font-medium text-gray-900">Loan not found</p>
      <p className="text-gray-500 text-sm">It may have been deleted.</p>
      <Link href="/loans" className="inline-block mt-6 text-sm text-blue-600 hover:underline">
        ← Back to loans
      </Link>
    </div>
  );
}
