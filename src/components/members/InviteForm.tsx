"use client";

import { useActionState } from "react";
import { inviteMemberAction } from "@/actions/member.actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, null);

  return (
    <form action={action} className="flex gap-2">
      <input
        name="email"
        type="email"
        placeholder="name@example.com"
        required
        aria-label="Invite by email"
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Inviting..." : "Invite"}
      </button>
      {state?.error && <p className="text-sm text-red-500 self-center">{state.error}</p>}
    </form>
  );
}
