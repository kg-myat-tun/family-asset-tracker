import { PageSkeleton } from "@/components/ui/Skeleton";

export default function RecurringRulesLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageSkeleton rows={4} />
    </div>
  );
}
