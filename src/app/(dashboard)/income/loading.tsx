import { PageSkeleton } from "@/components/ui/Skeleton";

export default function IncomeLoading() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageSkeleton rows={5} />
    </div>
  );
}
