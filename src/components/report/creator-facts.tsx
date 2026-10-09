import Link from "next/link";
import { AddressDisplay } from "@/components/shared/address-display";
import { BlockLink, TxLink } from "@/components/shared/tx-link";
import type { CreatorAnalysis } from "@/lib/analysis/creator";
import { formatEth } from "@/lib/format";

const when = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";

/** Verified, transaction-backed facts. Interpretations live elsewhere and are labelled as inferences. */
export function CreatorFacts({ facts, showAddress = true }: { facts: CreatorAnalysis; showAddress?: boolean }) {
  if (!facts.explorerAvailable) {
    return <p className="text-sm text-muted-foreground">The explorer did not return this address&apos;s history, so no facts could be established. This is not a sign that the address is safe.</p>;
  }
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      {showAddress && (<><dt className="text-muted-foreground">Address</dt><dd><AddressDisplay address={facts.address} /> <Link className="ml-1 text-xs underline" href={`/wallet/${facts.address}`}>wallet activity</Link></dd></>)}
      <dt className="text-muted-foreground">Transactions sent or received</dt>
      <dd className="tabular-nums">{facts.txCount === null ? "Unknown" : facts.txCount.toLocaleString("en-US")}</dd>
      <dt className="text-muted-foreground">First seen</dt>
      <dd>{facts.firstSeen ? <span className="inline-flex flex-wrap items-center gap-2"><time dateTime={facts.firstSeen.time}>{when(facts.firstSeen.time)}</time><BlockLink block={facts.firstSeen.block} /><TxLink hash={facts.firstSeen.txHash} /></span> : "No transactions observed"}</dd>
      <dt className="text-muted-foreground">Last active</dt>
      <dd>{facts.lastActive ? <time dateTime={facts.lastActive.time}>{when(facts.lastActive.time)}</time> : "—"}</dd>
      <dt className="text-muted-foreground">First incoming funds</dt>
      <dd>{facts.funding ? <span className="inline-flex flex-wrap items-center gap-2">{formatEth(facts.funding.value)} from <AddressDisplay address={facts.funding.from} /><TxLink hash={facts.funding.txHash} /></span> : "None observed in the earliest incoming transfers"}</dd>
      {facts.ageAtCreationSeconds !== null && (<><dt className="text-muted-foreground">Wallet age at token creation</dt><dd className="tabular-nums">{Math.round(facts.ageAtCreationSeconds / 3600)} hours</dd></>)}
    </dl>
  );
}

export function CreationsList({ facts }: { facts: CreatorAnalysis }) {
  const s = facts.creationSearch;
  return (
    <div className="space-y-2">
      {facts.creations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other contract or token creations found.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {facts.creations.map((c) => (
            <li key={c.token} className="flex flex-wrap items-center gap-2"><Link className="font-mono underline" href={`/token/${c.token}`}>{c.token.slice(0, 10)}…{c.token.slice(-4)}</Link><span className="text-muted-foreground">{c.kind === "token" ? "token" : c.kind === "contract" ? "contract (not an ERC-20)" : "contract"} {c.via === "direct" ? "deployed directly" : "created through a launchpad contract"}</span><time dateTime={c.time} className="text-xs text-muted-foreground">{when(c.time)}</time><TxLink hash={c.txHash} /></li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Search scope: {s.scope === "direct" ? "direct deployments only (no launchpad creation path is known for this wallet — scan one of its tokens to learn it)" : `direct deployments and transactions matching ${s.patterns.length} known creation path${s.patterns.length === 1 ? "" : "s"}`}.
        {s.possiblyIncomplete && " Only the latest 100 and earliest 50 transactions were read, so this list may be incomplete."}
        {s.unresolved > 0 && ` ${s.unresolved} candidate launch${s.unresolved === 1 ? "" : "es"} could not be resolved.`}
      </p>
    </div>
  );
}
