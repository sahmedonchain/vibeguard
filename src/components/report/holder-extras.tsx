import { AddressDisplay } from "@/components/shared/address-display";
import { Card } from "@/components/ui/card";
import { formatBps } from "@/lib/format";
import type { HolderHistory } from "@/lib/indexing/holder-history";
import { HistoryChart } from "./history-chart";

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

export function HolderHistoryView({ history }: { history: HolderHistory }) {
  const data = history.points.map((p) => ({ label: day(p.time) ?? `#${p.block}`, block: p.block, top1: p.top1Bps / 100, top10: p.top10Bps / 100 }));
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Concentration over time</h3>
      <HistoryChart data={data} />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <caption className="sr-only">Holder concentration at sampled blocks</caption>
          <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th scope="col" className="px-3 py-2">Block</th><th scope="col" className="px-3 py-2">Time</th><th scope="col" className="px-3 py-2 text-right">Holders</th><th scope="col" className="px-3 py-2 text-right">Top 1</th><th scope="col" className="px-3 py-2 text-right">Top 10</th></tr></thead>
          <tbody>
            {history.points.map((p) => (
              <tr key={p.block} className="border-t border-border"><td className="px-3 py-2 tabular-nums">{p.block.toLocaleString("en-US")}</td><td className="px-3 py-2">{p.time ? <time dateTime={p.time}>{p.time.slice(0, 16).replace("T", " ")}</time> : "—"}</td><td className="px-3 py-2 text-right tabular-nums">{p.holderCount.toLocaleString("en-US")}</td><td className="px-3 py-2 text-right tabular-nums">{formatBps(p.top1Bps)}</td><td className="px-3 py-2 text-right tabular-nums">{formatBps(p.top10Bps)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Sampled at evenly spaced blocks from the first transfer. Contracts and burn addresses that were classified at the analysis block are excluded at every point, so earlier points are approximate.</p>

      {history.changes.length > 0 && history.window && (
        <Card className="space-y-2 p-4">
          <h3 className="font-medium">Large holder changes</h3>
          <p className="text-xs text-muted-foreground">Balance change of the largest holders between block {history.window.fromBlock.toLocaleString("en-US")}{history.window.fromTime ? ` (${day(history.window.fromTime)})` : ""} and block {history.window.toBlock.toLocaleString("en-US")}{history.window.toTime ? ` (${day(history.window.toTime)})` : ""}.</p>
          <ul className="space-y-1 text-sm">
            {history.changes.map((c) => (
              <li key={c.address} className="flex flex-wrap items-center gap-2"><AddressDisplay address={c.address} /><span className="tabular-nums">{formatBps(c.fromBps)} → {formatBps(c.toBps)}</span><span className={c.deltaBps > 0 ? "text-sev-medium" : "text-sev-info"}>{c.deltaBps > 0 ? "+" : ""}{formatBps(c.deltaBps)}</span></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
