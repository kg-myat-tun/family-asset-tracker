"use client";

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged } from "firebase/auth";
import { collection, limit, onSnapshot, query, type Timestamp, where } from "firebase/firestore";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notification.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { getClientAuth, getClientDb } from "@/firebase/client";
import { keys } from "@/lib/query/keys";

interface Item {
  id: string;
  type: string;
  title: string;
  body: string;
  loanId: string;
  read: boolean;
  createdAt: Date;
}

export function NotificationBell({ familyId }: { familyId: string }) {
  const { dict } = useI18n();
  const queryClient = useQueryClient();
  // Shared cache entry, fed by the onSnapshot listener below (see ActivityFeed
  // for the same pattern). `skipToken` keeps the query render-only.
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: keys.notifications(familyId),
    queryFn: skipToken,
  });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setItems = (next: Item[]) => queryClient.setQueryData(keys.notifications(familyId), next);
    let unsubscribeSnapshot = () => {};

    // Mirror the activity feed: wait for Auth to rehydrate before attaching the
    // Firestore listener, otherwise the read is permission-denied.
    const unsubscribeAuth = onAuthStateChanged(getClientAuth(), (user) => {
      unsubscribeSnapshot();
      if (!user) return;

      // Equality filter only (no orderBy) so no composite index is required;
      // sort newest-first on the client.
      const q = query(
        collection(getClientDb(), `families/${familyId}/notifications`),
        where("recipientUid", "==", user.uid),
        limit(50),
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              type: d.type,
              title: d.title,
              body: d.body,
              loanId: d.loanId,
              read: !!d.read,
              createdAt: (d.createdAt as Timestamp | null)?.toDate() ?? new Date(),
            };
          });
          rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          setItems(rows.slice(0, 20));
        },
        (err) => console.error("NotificationBell snapshot error:", err),
      );
    });

    return () => {
      unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, [familyId, queryClient]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={dict.header.notifications}
        className="relative p-2 -m-1 text-muted hover:text-foreground"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-card border border-line rounded-xl shadow-lg z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <span className="text-sm font-semibold text-foreground">
              {dict.header.notifications}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsReadAction()}
                className="text-xs text-accent hover:underline"
              >
                {dict.notifications.markAllRead}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">
              {dict.notifications.allCaughtUp}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-line">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/loans/${item.loanId}`}
                    onClick={() => {
                      if (!item.read) markNotificationReadAction(item.id);
                      setOpen(false);
                    }}
                    className={`block px-4 py-3 hover:bg-foreground/5 ${
                      item.read ? "" : "bg-accent-soft/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {!item.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      )}
                      <p
                        className={`text-sm ${item.type === "loan_overdue" ? "text-red-600 dark:text-red-400" : "text-foreground"} font-medium`}
                      >
                        {item.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{item.body}</p>
                    <p className="text-[11px] text-muted/70 mt-1">
                      {item.createdAt.toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
