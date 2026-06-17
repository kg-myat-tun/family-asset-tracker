"use client";

import { useActionState, useState } from "react";
import { createFamilyAction, joinFamilyAction } from "@/actions/family.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

type Mode = "create" | "join";

export function OnboardingForm() {
  const { dict } = useI18n();
  const [mode, setMode] = useState<Mode>("create");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-foreground/6 rounded-lg p-1">
        {(["create", "join"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === m
                ? "bg-card shadow-sm text-foreground"
                : "text-muted hover:text-foreground/80"
            }`}
          >
            {m === "create" ? dict.auth.createTab : dict.auth.joinTab}
          </button>
        ))}
      </div>

      {mode === "create" ? <CreateFamilyForm dict={dict} /> : <JoinFamilyForm dict={dict} />}
    </div>
  );
}

function CreateFamilyForm({ dict }: { dict: Dictionary }) {
  const [state, action, pending] = useActionState(createFamilyAction, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="family-name" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.auth.familyName}
        </label>
        <input
          id="family-name"
          name="name"
          placeholder={dict.auth.familyNamePlaceholder}
          required
          className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        {state?.error?.name && <p className="text-sm text-red-500 mt-1">{state.error.name[0]}</p>}
      </div>

      <div>
        <label
          htmlFor="base-currency"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.auth.baseCurrency}
        </label>
        <select
          id="base-currency"
          name="baseCurrency"
          required
          defaultValue="USD"
          className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-soft"
        >
          {COMMON_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {state?.error?.baseCurrency && (
          <p className="text-sm text-red-500 mt-1">{state.error.baseCurrency[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? dict.auth.creating : dict.auth.createFamily}
      </button>
    </form>
  );
}

function JoinFamilyForm({ dict }: { dict: Dictionary }) {
  const [state, action, pending] = useActionState(joinFamilyAction, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="invite-code" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.auth.inviteCode}
        </label>
        <input
          id="invite-code"
          name="inviteCode"
          placeholder="K7M2QP"
          required
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full px-4 py-2 border border-line rounded-lg uppercase tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        {state?.error?.inviteCode && (
          <p className="text-sm text-red-500 mt-1">{state.error.inviteCode[0]}</p>
        )}
        <p className="text-xs text-muted mt-1">{dict.auth.inviteCodeHint}</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? dict.auth.joining : dict.auth.joinFamily}
      </button>
    </form>
  );
}
