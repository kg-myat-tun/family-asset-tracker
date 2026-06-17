"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NetWorthSnapshot } from "@/types";

interface Props {
  snapshots: NetWorthSnapshot[];
  currency: string;
}

export function NetWorthTrend({ snapshots, currency }: Props) {
  if (snapshots.length < 2) {
    return (
      <p className="text-muted text-sm">
        Not enough history yet — a snapshot is recorded daily, so the trend will fill in over the
        coming days.
      </p>
    );
  }

  const data = snapshots.map((s) => ({
    date: s.date.slice(5), // MM-DD
    value: s.totalNetWorth,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis
          tick={{ fontSize: 11 }}
          width={56}
          tickFormatter={(v) =>
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              currency,
              style: "currency",
            }).format(v)
          }
        />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value))
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#nwGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
