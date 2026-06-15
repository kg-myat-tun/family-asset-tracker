"use client";

import type { LucideIcon } from "lucide-react";
import { Lock, Users } from "lucide-react";
import { useState } from "react";
import type { Visibility } from "@/types";

const OPTIONS: { value: Visibility; label: string; icon: LucideIcon; hint: string }[] = [
  { value: "shared", label: "Shared", icon: Users, hint: "Visible to the whole family" },
  { value: "private", label: "Private", icon: Lock, hint: "Only visible to you" },
];

interface Props {
  /** Label for the field — "this asset", "this loan", etc. tunes the hint. */
  name?: string;
  defaultValue?: Visibility;
}

export function VisibilityField({ name = "visibility", defaultValue = "shared" }: Props) {
  const [value, setValue] = useState<Visibility>(defaultValue);
  const active = OPTIONS.find((o) => o.value === value);

  return (
    <div>
      <span className="block text-sm font-medium text-foreground/80 mb-1.5">Visibility</span>
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-1 bg-foreground/6 rounded-lg p-1">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setValue(o.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                value === o.value
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted hover:text-foreground/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {o.label}
            </button>
          );
        })}
      </div>
      {active && <p className="text-xs text-muted mt-1">{active.hint}</p>}
    </div>
  );
}
