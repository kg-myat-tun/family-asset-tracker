"use client";

import { useState } from "react";

export function InviteCodePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — user can select the code manually
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Family invite code</p>
        <p className="text-xs text-muted">
          Share this code so others can join from the onboarding screen.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="font-mono text-lg tracking-[0.3em] text-foreground bg-card border border-line rounded-lg px-3 py-1.5 select-all">
          {code}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="text-sm px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent-strong"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
