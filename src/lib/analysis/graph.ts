import type { WalletProfile } from "./wallet";

export type GraphNode = { id: string; kind: "subject" | "wallet" | "contract" | "funder"; label?: string };
export type GraphEdge = { from: string; to: string; kind: "sent" | "received" | "funding" | string; weight: number; txHash?: string };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

/** Star graph of observed native transfers and the funding transfer. Edge weight is the transaction count. */
export function walletGraph(p: WalletProfile): Graph {
  const nodes = new Map<string, GraphNode>([[p.address, { id: p.address, kind: "subject" }]]);
  const edges: GraphEdge[] = [];
  for (const c of p.counterparties) {
    nodes.set(c.address, { id: c.address, kind: c.isContract ? "contract" : "wallet" });
    if (c.txOut) edges.push({ from: p.address, to: c.address, kind: "sent", weight: c.txOut });
    if (c.txIn) edges.push({ from: c.address, to: p.address, kind: "received", weight: c.txIn });
  }
  if (p.funding) {
    const existing = nodes.get(p.funding.from);
    nodes.set(p.funding.from, { id: p.funding.from, kind: "funder", ...(existing && existing.kind === "contract" ? { label: "contract" } : {}) });
    edges.push({ from: p.funding.from, to: p.address, kind: "funding", weight: 1, txHash: p.funding.txHash });
  }
  return { nodes: [...nodes.values()], edges };
}
