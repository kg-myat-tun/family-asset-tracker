import { Lock, Users } from "lucide-react";
import type { Visibility } from "@/types";

/** Small pill indicating whether an item is private or shared with the family. */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  if (visibility === "shared") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong">
        <Users className="w-3 h-3" aria-hidden="true" /> Shared
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-foreground/8 text-muted">
      <Lock className="w-3 h-3" aria-hidden="true" /> Private
    </span>
  );
}
