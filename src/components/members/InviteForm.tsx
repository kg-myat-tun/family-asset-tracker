"use client";

import { useActionState } from "react";
import { inviteMemberAction } from "@/actions/member.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function InviteForm() {
  const { dict } = useI18n();
  const [state, action, pending] = useActionState(inviteMemberAction, null);

  return (
    <form action={action} className="flex gap-2">
      <input
        name="email"
        type="email"
        placeholder={dict.members.invitePlaceholder}
        required
        aria-label={dict.members.invite}
        className="px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
      />
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? dict.members.inviting : dict.members.invite}
      </button>
      {state?.error && <p className="text-sm text-red-500 self-center">{state.error}</p>}
    </form>
  );
}
