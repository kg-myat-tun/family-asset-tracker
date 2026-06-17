"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

export function InviteCodePanel({ code }: { code: string }) {
  const { dict } = useI18n();
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
    <div className="bg-accent-soft border border-line rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{dict.members.inviteCodeTitle}</p>
        <p className="text-xs text-muted">{dict.members.inviteCodeDesc}</p>
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
          {copied ? dict.members.copied : dict.members.copy}
        </button>
      </div>
    </div>
  );
}
