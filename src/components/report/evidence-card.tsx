import type { EvidenceItem } from "@/lib/risk-engine/types";
import { safeText } from "@/lib/text";
import { AddressDisplay } from "@/components/shared/address-display";
import { BlockLink, TxLink } from "@/components/shared/tx-link";

/** One piece of evidence behind a finding. All values are rendered as plain text. */
export function EvidenceCard({ item }: { item: EvidenceItem }) {
  const data = item.data ? Object.entries(item.data) : [];
  return (
    <li className="rounded-md border border-border bg-background/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.kind.replace("_", " ")}</span>
        <span>{safeText(item.label, 200)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        {item.address && <AddressDisplay address={item.address} />}
        {item.txHash && <TxLink hash={item.txHash} />}
        {item.blockNumber != null && <BlockLink block={item.blockNumber} />}
      </div>
      {data.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {data.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{safeText(k, 40)}</dt>
              <dd className="break-all font-mono">{safeText(String(v), 200)}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
