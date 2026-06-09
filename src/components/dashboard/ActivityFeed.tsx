"use client";

import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getClientDb } from "@/firebase/client";

interface ActivityItem {
  id: string;
  type: "asset_added" | "asset_updated" | "loan_created" | "repayment_made";
  description: string;
  createdAt: Date;
}

export function ActivityFeed({ familyId }: { familyId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(getClientDb(), `families/${familyId}/activity`),
      orderBy("createdAt", "desc"),
      limit(20),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            description: data.description,
            createdAt: (data.createdAt as Timestamp | null)?.toDate() ?? new Date(),
          };
        }),
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [familyId]);

  if (loading) {
    return (
      <div className="card p-6 space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 bg-foreground/6 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="icon-chip">🕑</span>
        <h2 className="font-semibold text-foreground">Recent activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-muted text-sm">No activity yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 items-start">
              <div className="w-2 h-2 bg-accent rounded-full mt-1.5 shrink-0 ring-4 ring-accent-soft" />
              <div>
                <p className="text-sm text-foreground/80">{item.description}</p>
                <p className="text-xs text-muted mt-0.5">
                  {item.createdAt.toLocaleDateString()} at{" "}
                  {item.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
