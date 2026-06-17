"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface Props {
  data: { name: string; value: number }[];
  currency: string;
}

export function NetWorthChart({ data, currency }: Props) {
  const { dict } = useI18n();

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="text-muted text-sm">{dict.dashboard.noAssetData}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 11 }}
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
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
