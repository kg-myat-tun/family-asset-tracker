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
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Recent activity</h2>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm">No activity yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 items-start">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-700">{item.description}</p>
                <p className="text-xs text-gray-400">
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
