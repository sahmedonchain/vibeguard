import { AddressDisplay } from "@/components/shared/address-display";
import { TxLink } from "@/components/shared/tx-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Cluster } from "@/lib/analysis/sybil";
import { formatBps } from "@/lib/format";
import { RelationshipGraph } from "./relationship-graph";
import type { Graph } from "@/lib/analysis/graph";

const CONF: Record<Cluster["confidence"], string> = { low: "text-sev-info", medium: "text-sev-medium", high: "text-sev-high" };

/** A cluster is behavioral similarity supported by on-chain evidence. The wording never claims a shared owner. */
export function ClusterCard({ cluster }: { cluster: Cluster }) {
  const graph = toGraph(cluster);
  return (
    <Card className="space-y-4" id={cluster.id}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{cluster.label}</h3>
        <Badge className={CONF[cluster.confidence]}>{cluster.confidence} confidence</Badge>
        <Badge className="text-muted-foreground">{cluster.members.length} wallets · {formatBps(cluster.combinedBps)} of supply</Badge>
        {!cluster.scored && <Badge className="text-muted-foreground">below scoring threshold</Badge>}
        <span className="font-mono text-xs text-muted-foreground">{cluster.id}</span>
      </div>

      <div>
        <h4 className="text-sm font-medium">Signals</h4>
        <ul className="mt-1 space-y-2 text-sm">
          {cluster.signals.map((s) => (
            <li key={s.kind}>
              <span className="font-medium">{s.label}.</span> <span className="text-muted-foreground">{s.detail}</span>
              <p className="text-xs text-muted-foreground">Alternative explanation: {s.alternative}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[26rem] text-left text-sm">
          <caption className="sr-only">Wallets in {cluster.id}</caption>
          <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th scope="col" className="px-3 py-2">Wallet</th><th scope="col" className="px-3 py-2 text-right">Share of supply</th></tr></thead>
          <tbody>
            {cluster.members.map((m) => (
              <tr key={m.address} className="border-t border-border"><td className="px-3 py-2"><AddressDisplay address={m.address} /> <a className="ml-1 text-xs underline" href={`/wallet/${m.address}`}>wallet</a></td><td className="px-3 py-2 text-right tabular-nums">{formatBps(m.balanceBps)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {graph.edges.length > 0 && <RelationshipGraph graph={graph} label={`Relationship graph for ${cluster.id}`} />}

      {(cluster.evidence.some((e) => e.txHash) || cluster.edges.some((e) => e.txHash)) && (
        <div>
          <h4 className="text-sm font-medium">Evidence</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {cluster.evidence.filter((e) => e.txHash).map((e, i) => <li key={i} className="flex flex-wrap items-center gap-2"><span className="text-muted-foreground">{e.detail}</span><TxLink hash={e.txHash!} /></li>)}
            {cluster.edges.filter((e) => e.txHash).slice(0, 12).map((e, i) => <li key={`e${i}`} className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">{e.kind === "shared_funder" ? "Funding" : "Token transfer"} {e.from.slice(0, 8)}… → {e.to.slice(0, 8)}…</span><TxLink hash={e.txHash!} /></li>)}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Observed {cluster.firstObserved ? <time dateTime={cluster.firstObserved}>{cluster.firstObserved}</time> : "—"} to {cluster.lastObserved ? <time dateTime={cluster.lastObserved}>{cluster.lastObserved}</time> : "—"}.
        These wallets behave similarly. This does not show they share an owner.
      </p>
    </Card>
  );
}

function toGraph(c: Cluster): Graph {
  const nodes = new Map<string, Graph["nodes"][number]>();
  for (const m of c.members) nodes.set(m.address, { id: m.address, kind: "wallet" });
  const edges: Graph["edges"] = [];
  for (const e of c.edges) {
    if (!nodes.has(e.from)) nodes.set(e.from, { id: e.from, kind: e.kind === "shared_funder" ? "funder" : "wallet" });
    if (!nodes.has(e.to)) nodes.set(e.to, { id: e.to, kind: e.kind === "token_consolidation" ? "funder" : "wallet" });
    edges.push({ from: e.from, to: e.to, kind: e.kind === "shared_funder" ? "funding" : "sent", weight: 1, txHash: e.txHash });
  }
  // Pick a hub as the "subject" (the node with most edges) so the layout is a star around it.
  const deg = new Map<string, number>();
  for (const e of edges) { deg.set(e.from, (deg.get(e.from) ?? 0) + 1); deg.set(e.to, (deg.get(e.to) ?? 0) + 1); }
  const hub = [...nodes.keys()].sort((a, b) => (deg.get(b) ?? 0) - (deg.get(a) ?? 0) || a.localeCompare(b))[0];
  return { nodes: [...nodes.values()].map((n) => (n.id === hub ? { ...n, kind: "subject" as const } : n)), edges };
}
