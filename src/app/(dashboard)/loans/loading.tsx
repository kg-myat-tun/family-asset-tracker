import { PageSkeleton } from "@/components/ui/Skeleton";

export default function LoansLoading() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageSkeleton rows={4} />
    </div>
  );
}
