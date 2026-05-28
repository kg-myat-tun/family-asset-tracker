import { PageSkeleton } from "@/components/ui/Skeleton";

export default function MembersLoading() {
  return (
    <div className="max-w-3xl">
      <PageSkeleton rows={3} />
    </div>
  );
}
