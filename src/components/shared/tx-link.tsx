import { ExternalLink } from "lucide-react";
import { getChainConfig } from "@/lib/chain/config";
import { explorerUrls } from "@/lib/chain/explorer";
import { shortenAddress } from "./address-display";
import { CopyButton } from "./copy-button";

export function TxLink({ hash }: { hash: string }) {
  const href = explorerUrls(getChainConfig().explorerUrl).tx(hash);
  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm">
      <span title={hash}>{shortenAddress(hash, 10, 6)}</span>
      <CopyButton value={hash} label="Copy transaction hash" />
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label="View transaction on explorer" className="text-muted-foreground hover:text-foreground">
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </span>
  );
}

export function BlockLink({ block }: { block: number }) {
  const href = explorerUrls(getChainConfig().explorerUrl).block(block);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-sm underline decoration-dotted underline-offset-2 hover:text-foreground">
      {block.toLocaleString("en-US")} <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}
