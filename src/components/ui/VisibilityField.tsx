"use client";

import type { LucideIcon } from "lucide-react";
import { Lock, Users } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Visibility } from "@/types";

const OPTIONS: { value: Visibility; icon: LucideIcon }[] = [
  { value: "shared", icon: Users },
  { value: "private", icon: Lock },
];

interface Props {
  name?: string;
  defaultValue?: Visibility;
}

export function VisibilityField({ name = "visibility", defaultValue = "shared" }: Props) {
  const { dict } = useI18n();
  const [value, setValue] = useState<Visibility>(defaultValue);
  const labels: Record<Visibility, string> = {
    shared: dict.ui.shared,
    private: dict.ui.private,
  };
  const hints: Record<Visibility, string> = {
    shared: dict.ui.sharedHint,
    private: dict.ui.privateHint,
  };

  return (
    <div>
      <span className="block text-sm font-medium text-foreground/80 mb-1.5">
        {dict.ui.visibility}
      </span>
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
              {labels[o.value]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted mt-1">{hints[value]}</p>
    </div>
  );
}
