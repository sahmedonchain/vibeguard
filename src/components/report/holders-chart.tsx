"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartHolder = { label: string; address: string; percent: number; cls: "eoa" | "contract" | "burn" | "creator" };

const FILL: Record<ChartHolder["cls"], string> = { eoa: "var(--sev-info)", contract: "var(--muted-foreground)", burn: "var(--sev-medium)", creator: "var(--primary)" };
const NAME: Record<ChartHolder["cls"], string> = { eoa: "Wallet", contract: "Contract", burn: "Burn", creator: "Creator" };

/** Bars are labeled with class text in the tooltip and the table below the chart, so color is not the only signal. */
export function HoldersChart({ data }: { data: ChartHolder[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No holder data to chart.</p>;
  return (
    <div role="img" aria-label={`Bar chart of the ${data.length} largest holders by share of supply`} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval={0} />
          <YAxis unit="%" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={44} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--foreground)" }}
            formatter={(v, _n, item) => [`${Number(v).toFixed(2)}%`, `${NAME[(item.payload as ChartHolder).cls]} ${(item.payload as ChartHolder).address}`]}
            labelFormatter={() => ""}
          />
          <Bar dataKey="percent" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={FILL[d.cls]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
