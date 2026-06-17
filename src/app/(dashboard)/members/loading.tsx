import { PageSkeleton } from "@/components/ui/Skeleton";

export default function MembersLoading() {
  return (
    <div className="max-w-5xl mx-auto">
      <PageSkeleton rows={3} />
    </div>
  );
}
