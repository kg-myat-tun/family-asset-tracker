"use client";

import { useActionState } from "react";
import { type ProfileFormState, updateProfileAction } from "@/actions/profile.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

interface Props {
  defaultDisplayName: string;
  email: string;
}

export function ProfileForm({ defaultDisplayName, email }: Props) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="profile-name" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.profile.displayName}
        </label>
        <input
          id="profile-name"
          name="displayName"
          defaultValue={defaultDisplayName}
          required
          maxLength={60}
          className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        {state && "errors" in state && state.errors?.displayName && (
          <p className="text-sm text-red-500 mt-1">{state.errors.displayName[0]}</p>
        )}
        <p className="text-xs text-muted mt-1">{dict.profile.displayNameHint}</p>
      </div>

      <div>
        <label
          htmlFor="profile-email"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.profile.email}
        </label>
        <input
          id="profile-email"
          value={email}
          readOnly
          disabled
          className="w-full px-4 py-2 border border-line rounded-lg bg-background text-muted"
        />
        <p className="text-xs text-muted mt-1">{dict.profile.emailHint}</p>
      </div>

      {state && "success" in state && state.success && (
        <p className="text-sm text-green-600">{dict.profile.saved}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-strong disabled:opacity-50 text-sm"
      >
        {pending ? dict.common.saving : dict.common.saveChanges}
      </button>
    </form>
  );
}
