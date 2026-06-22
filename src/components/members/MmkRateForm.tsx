"use client";

import { useActionState, useEffect, useState } from "react";
import { refreshMmkRateFromCbmAction, updateMmkRateAction } from "@/actions/family.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Toast } from "@/components/ui/Toast";

type ToastState = { message: string; type: "success" | "error" } | null;

export function MmkRateForm({ mmkPerUsd }: { mmkPerUsd: number }) {
  const { dict } = useI18n();
  const [saveState, saveAction, savePending] = useActionState(updateMmkRateAction, null);
  const [cbmState, cbmAction, cbmPending] = useActionState(refreshMmkRateFromCbmAction, null);
  const [toast, setToast] = useState<ToastState>(null);

  // Surface each action's result as a toast — one effect per action so a stale
  // result from the other never wins. Each submit returns a fresh state object,
  // so the effect re-fires even on a repeated identical result.
  useEffect(() => {
    if (saveState?.ok) setToast({ message: dict.members.mmkRateSaved, type: "success" });
    else if (saveState?.error) setToast({ message: saveState.error, type: "error" });
  }, [saveState, dict]);

  useEffect(() => {
    if (cbmState?.ok) setToast({ message: dict.members.mmkRateSaved, type: "success" });
    else if (cbmState?.error) setToast({ message: cbmState.error, type: "error" });
  }, [cbmState, dict]);

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-foreground">{dict.members.mmkRateTitle}</h2>
        <p className="text-sm text-muted mt-1">{dict.members.mmkRateDesc}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <form action={saveAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground/80">
              {dict.members.mmkRateLabel}
            </span>
            <input
              name="mmkPerUsd"
              type="number"
              min="1"
              step="any"
              inputMode="decimal"
              defaultValue={mmkPerUsd}
              required
              className="w-40 px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </label>

          <button
            type="submit"
            disabled={savePending}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-strong disabled:opacity-50"
          >
            {savePending ? dict.members.mmkRateSaving : dict.members.mmkRateSave}
          </button>
        </form>

        {/* Own form so its pending state stays isolated from the Save form. */}
        <form action={cbmAction}>
          <button
            type="submit"
            disabled={cbmPending}
            className="px-4 py-2 border border-line rounded-lg text-sm text-foreground hover:bg-accent-soft disabled:opacity-50"
          >
            {cbmPending ? dict.members.mmkRateSaving : dict.members.mmkRateUseCbm}
          </button>
        </form>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
