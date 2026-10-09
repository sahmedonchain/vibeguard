import { getChainConfig } from "@/lib/chain/config";

/** Shows the active network everywhere (SRS 3.3). */
export function NetworkBadge() {
  const cfg = getChainConfig();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground" title={`Chain ID ${cfg.chainId}`}>
      <span className="size-1.5 rounded-full bg-sev-low" aria-hidden /> {cfg.name}
    </span>
  );
}
