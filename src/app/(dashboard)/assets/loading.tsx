import { PageSkeleton } from "@/components/ui/Skeleton";

export default function AssetsLoading() {
  return (
    <div className="max-w-4xl">
      <PageSkeleton rows={5} />
    </div>
  );
}
