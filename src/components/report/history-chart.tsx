"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type HistoryDatum = { label: string; block: number; top1: number; top10: number };

/** Top-1 and top-10 wallet share over time. The caller renders the same numbers as a table. */
export function HistoryChart({ data }: { data: HistoryDatum[] }) {
  if (data.length < 2) return <p className="text-sm text-muted-foreground">Not enough history to chart.</p>;
  return (
    <div role="img" aria-label="Line chart of top 1 and top 10 wallet share of supply over time" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis unit="%" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={44} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--foreground)" }} formatter={(v, name) => [`${Number(v).toFixed(2)}%`, name]} />
          <Line type="monotone" dataKey="top1" name="Top 1 wallet" stroke="var(--sev-high)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="top10" name="Top 10 wallets" stroke="var(--sev-info)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
