"use client";

import { useState } from "react";
import { logout } from "@/lib/auth.client";

export function LogoutButton({
  label = "Sign out",
  loadingLabel = "Signing out...",
}: {
  label?: string;
  loadingLabel?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await logout();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
