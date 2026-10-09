import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Always shows block number and ISO time so data age is never hidden. */
export function FreshnessLabel({ blockNumber, asOf, className }: { blockNumber?: number | bigint | null; asOf?: string | null; className?: string }) {
  if (blockNumber == null && !asOf) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Data freshness unknown</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Clock className="size-3" aria-hidden />
      {blockNumber != null && <>Block {blockNumber.toString()}</>}
      {blockNumber != null && asOf && " · "}
      {asOf && <time dateTime={asOf}>{asOf}</time>}
    </span>
  );
}
