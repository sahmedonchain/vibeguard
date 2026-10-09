import { ExternalLink } from "lucide-react";
import { getChainConfig } from "@/lib/chain/config";
import { explorerUrls } from "@/lib/chain/explorer";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export function shortenAddress(address: string, head = 6, tail = 4): string {
  return address.length <= head + tail + 2 ? address : `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Address text is untrusted; it is rendered as plain text only. */
export function AddressDisplay({ address, full = false, className }: { address: string; full?: boolean; className?: string }) {
  const href = explorerUrls(getChainConfig().explorerUrl).address(address);
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-sm", className)}>
      <span title={address} className={full ? "break-all" : undefined}>{full ? address : shortenAddress(address)}</span>
      <CopyButton value={address} label="Copy address" />
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label="View on explorer" className="text-muted-foreground hover:text-foreground">
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </span>
  );
}
