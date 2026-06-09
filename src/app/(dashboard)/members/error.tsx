"use client";

export default function MembersError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-muted mb-4">Failed to load members: {error.message}</p>
      <button type="button" onClick={reset} className="text-accent hover:underline">
        Try again
      </button>
    </div>
  );
}
