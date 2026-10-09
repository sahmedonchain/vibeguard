import type { Graph, GraphNode } from "@/lib/analysis/graph";
import { shortenAddress } from "@/components/shared/address-display";

const COLOR: Record<GraphNode["kind"], string> = { subject: "var(--primary)", wallet: "var(--sev-info)", contract: "var(--muted-foreground)", funder: "var(--sev-medium)" };
const KIND_NAME: Record<GraphNode["kind"], string> = { subject: "Subject", wallet: "Wallet", contract: "Contract", funder: "Funder" };
const W = 640;
const H = 380;

/**
 * Static SVG graph. The subject sits in the centre and other nodes on a circle (deterministic layout).
 * Shape and label identify node kinds, not color alone; every edge is also listed in a table by the caller.
 */
export function RelationshipGraph({ graph, label }: { graph: Graph; label: string }) {
  const subject = graph.nodes.find((n) => n.kind === "subject") ?? graph.nodes[0];
  const others = graph.nodes.filter((n) => n.id !== subject?.id).slice(0, 16);
  if (!subject || others.length === 0) return <p className="text-sm text-muted-foreground">No relationships to draw.</p>;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - 48;
  const pos = new Map<string, { x: number; y: number }>([[subject.id, { x: cx, y: cy }]]);
  others.forEach((n, i) => {
    const a = (2 * Math.PI * i) / others.length - Math.PI / 2;
    pos.set(n.id, { x: Math.round(cx + r * Math.cos(a)), y: Math.round(cy + r * Math.sin(a)) });
  });
  const maxW = Math.max(1, ...graph.edges.map((e) => e.weight));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full rounded-lg border border-border bg-card">
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="var(--muted-foreground)" /></marker>
        </defs>
        {graph.edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--muted-foreground)" strokeOpacity={0.7} strokeWidth={1 + (3 * e.weight) / maxW} strokeDasharray={e.kind === "funding" ? "5 3" : undefined} markerEnd="url(#arrow)" />;
        })}
        {[subject, ...others].map((n) => {
          const p = pos.get(n.id)!;
          const isSubject = n.id === subject.id;
          return (
            <a key={n.id} href={`/wallet/${n.id}`}>
              <title>{`${KIND_NAME[n.kind]} ${n.id}`}</title>
              {n.kind === "contract" ? <rect x={p.x - 9} y={p.y - 9} width={18} height={18} fill={COLOR[n.kind]} /> : <circle cx={p.x} cy={p.y} r={isSubject ? 13 : 9} fill={COLOR[n.kind]} />}
              <text x={p.x} y={p.y + (isSubject ? 28 : 22)} textAnchor="middle" fontSize="10" fill="var(--foreground)" fontFamily="var(--font-mono)">{shortenAddress(n.id, 6, 4)}</text>
            </a>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-muted-foreground">Circle = wallet, square = contract. Dashed line = funding transfer. Line width = number of transactions. Arrows point from sender to recipient.</figcaption>
    </figure>
  );
}
