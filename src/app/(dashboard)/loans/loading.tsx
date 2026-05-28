import { PageSkeleton } from "@/components/ui/Skeleton";

export default function LoansLoading() {
  return (
    <div className="max-w-4xl">
      <PageSkeleton rows={4} />
    </div>
  );
}
