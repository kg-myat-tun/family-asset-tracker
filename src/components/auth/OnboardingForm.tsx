"use client";

import { useActionState, useState } from "react";
import { createFamilyAction, joinFamilyAction } from "@/actions/family.actions";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

type Mode = "create" | "join";

export function OnboardingForm() {
  const [mode, setMode] = useState<Mode>("create");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(["create", "join"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m === "create" ? "Create a family" : "Join a family"}
          </button>
        ))}
      </div>

      {mode === "create" ? <CreateFamilyForm /> : <JoinFamilyForm />}
    </div>
  );
}

function CreateFamilyForm() {
  const [state, action, pending] = useActionState(createFamilyAction, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="family-name" className="block text-sm font-medium text-gray-700 mb-1">
          Family name
        </label>
        <input
          id="family-name"
          name="name"
          placeholder="e.g. The Smiths"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {state?.error?.name && <p className="text-sm text-red-500 mt-1">{state.error.name[0]}</p>}
      </div>

      <div>
        <label htmlFor="base-currency" className="block text-sm font-medium text-gray-700 mb-1">
          Base currency
        </label>
        <select
          id="base-currency"
          name="baseCurrency"
          required
          defaultValue="USD"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create family"}
      </button>
    </form>
  );
}

function JoinFamilyForm() {
  const [state, action, pending] = useActionState(joinFamilyAction, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="invite-code" className="block text-sm font-medium text-gray-700 mb-1">
          Invite code
        </label>
        <input
          id="invite-code"
          name="inviteCode"
          placeholder="K7M2QP"
          required
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg uppercase tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {state?.error?.inviteCode && (
          <p className="text-sm text-red-500 mt-1">{state.error.inviteCode[0]}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Ask a family admin for the 6-character code on their Members page.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Joining..." : "Join family"}
      </button>
    </form>
  );
}
