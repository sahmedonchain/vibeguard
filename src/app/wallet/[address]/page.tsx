import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RelationshipGraph } from "@/components/report/relationship-graph";
import { CreatorFacts } from "@/components/report/creator-facts";
import { AddressDisplay } from "@/components/shared/address-display";
import { FreshnessLabel } from "@/components/shared/freshness-label";
import { ErrorState } from "@/components/shared/states";
import { TxLink } from "@/components/shared/tx-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { walletGraph } from "@/lib/analysis/graph";
import { getWalletProfile, observePatterns, type WalletProfile } from "@/lib/analysis/wallet";
import { enforcePageLimit, isApiError } from "@/lib/api/page-limit";
import { LIMITS } from "@/lib/api/rate-limit";
import { createChainClient } from "@/lib/chain/client";
import { getChainConfig } from "@/lib/chain/config";
import { isEvmAddress } from "@/lib/chain/explorer";
import { formatDuration, formatEth } from "@/lib/format";
import { safeText } from "@/lib/text";
import type { CreatorAnalysis } from "@/lib/analysis/creator";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/wallet/[address]">): Promise<Metadata> {
  const { address } = await params;
  return { title: `Wallet ${address.slice(0, 10)}…`, description: "Observed on-chain activity profile. Behavior, not identity.", robots: { index: false } };
}

export default async function WalletPage({ params }: PageProps<"/wallet/[address]">) {
  const { address } = await params;
  if (!isEvmAddress(address)) notFound();
  const a = address.toLowerCase();
  const shell = (node: React.ReactNode) => (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-2"><h1 className="text-2xl font-semibold">Wallet DNA</h1><AddressDisplay address={a} full /></header>
      {node}
    </div>
  );
  if (!isDatabaseConfigured()) return shell(<ErrorState title="Wallet analysis is unavailable">The database is not configured on this deployment.</ErrorState>);

  let p: WalletProfile;
  try {
    const db = getDb();
    const cfg = getChainConfig();
    await enforcePageLimit(db, LIMITS.analyze);
    p = await getWalletProfile(db, createChainClient(cfg), cfg.chainId, cfg.explorerUrl, a);
  } catch (err) {
    if (isApiError(err)) return shell(<ErrorState title={err.code === "RATE_LIMITED" ? "Too many requests" : "Wallet analysis is unavailable"}>{err.message}</ErrorState>);
    console.error("wallet page failed", err instanceof Error ? err.message : err);
    return shell(<ErrorState title="Could not load the wallet">A data provider is temporarily unavailable. Try again shortly.</ErrorState>);
  }

  if (!p.explorerAvailable) {
    return shell(
      <ErrorState title="Wallet history unavailable">
        The explorer did not return this wallet&apos;s transactions, so no activity profile can be shown. Balance: {formatEth(p.balanceWei)}. Missing history is not a sign that the wallet is safe.
      </ErrorState>,
    );
  }

  const facts: CreatorAnalysis = { address: a, explorerAvailable: true, txCount: p.counters.transactions, firstSeen: p.firstSeen, lastActive: p.lastActive, funding: p.funding, creations: [], creationSearch: { scope: "direct", patterns: [], candidates: 0, resolved: 0, unresolved: 0, possiblyIncomplete: true }, ageAtCreationSeconds: null, sellDown: null };
  const observations = observePatterns(p);
  const peak = Math.max(1, ...p.timing.byHourUtc);
  const graph = walletGraph(p);

  return shell(
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="text-muted-foreground">{p.isContract ? "Contract" : "Wallet"}</Badge>
        <Badge className="text-muted-foreground">Balance {formatEth(p.balanceWei)}</Badge>
        <FreshnessLabel asOf={p.computedAt} />
        <Link className="text-sm underline" href={`/creator/${a}`}>Creator reputation</Link>
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Overview</h2>
        <CreatorFacts facts={facts} showAddress={false} />
        <p className="text-xs text-muted-foreground">
          Activity below is computed from a sample: {p.sample.transactions} transactions{p.sample.from && p.sample.to ? ` between ${p.sample.from.slice(0, 10)} and ${p.sample.to.slice(0, 10)}` : ""}{p.sample.complete ? "" : " (the latest 150 plus the earliest 50)"} and {p.sample.tokenTransfers} token transfers{p.sample.tokenTransfersComplete ? "" : " (the latest 100)"}. {p.counters.transactions !== null && p.counters.transactions > p.sample.transactions ? `The wallet has ${p.counters.transactions.toLocaleString("en-US")} transactions in total.` : ""} Data comes from the block explorer, not from VibeGuard&apos;s own index.
        </p>
      </Card>

      <section aria-labelledby="flows-h" className="space-y-3">
        <h2 id="flows-h" className="text-lg font-semibold">Flows (native ETH)</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Incoming transactions", p.flows.txIn.toLocaleString("en-US")],
            ["Outgoing transactions", p.flows.txOut.toLocaleString("en-US")],
            ["Value received", formatEth(p.flows.valueIn)],
            ["Value sent", formatEth(p.flows.valueOut)],
          ].map(([k, v]) => <Card key={k} className="p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></Card>)}
        </dl>
      </section>

      <section aria-labelledby="timing-h" className="space-y-3">
        <h2 id="timing-h" className="text-lg font-semibold">Activity timing</h2>
        <div role="img" aria-label="Sampled transactions by hour of day, UTC" className="flex h-24 items-end gap-0.5">
          {p.timing.byHourUtc.map((n, h) => <div key={h} title={`${String(h).padStart(2, "0")}:00 UTC — ${n} transactions`} className="flex-1 rounded-t bg-sev-info" style={{ height: `${Math.max(2, (n / peak) * 100)}%`, opacity: n ? 1 : 0.25 }} />)}
        </div>
        <p className="text-xs text-muted-foreground">Hour of day (UTC), 00 to 23. {p.timing.activeDays} active days in the sample{p.timing.avgPerActiveDay !== null ? `, ${p.timing.avgPerActiveDay} transactions per active day` : ""}{p.timing.medianGapSeconds !== null ? `, median gap ${formatDuration(p.timing.medianGapSeconds)}` : ""}.</p>
      </section>

      {observations.length > 0 && (
        <section aria-labelledby="obs-h" className="space-y-2">
          <h2 id="obs-h" className="text-lg font-semibold">Observed behavior patterns</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{observations.map((o) => <li key={o.id}>{o.text}</li>)}</ul>
          <p className="text-xs text-muted-foreground">These describe the sampled activity. They do not identify who controls the wallet and do not imply wrongdoing.</p>
        </section>
      )}

      <section aria-labelledby="cp-h" className="space-y-3">
        <h2 id="cp-h" className="text-lg font-semibold">Counterparties and relationship graph</h2>
        <RelationshipGraph graph={graph} label={`Observed transfers between ${a} and its counterparties`} />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Counterparties</caption>
            <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th scope="col" className="px-3 py-2">Address</th><th scope="col" className="px-3 py-2">Type</th><th scope="col" className="px-3 py-2 text-right">In / out</th><th scope="col" className="px-3 py-2 text-right">Received</th><th scope="col" className="px-3 py-2 text-right">Sent</th></tr></thead>
            <tbody>
              {p.counterparties.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">No counterparties in the sample.</td></tr>}
              {p.counterparties.map((c) => (
                <tr key={c.address} className="border-t border-border"><td className="px-3 py-2"><AddressDisplay address={c.address} /> <Link className="ml-1 text-xs underline" href={`/wallet/${c.address}`}>open</Link></td><td className="px-3 py-2">{c.isContract === null ? "unknown" : c.isContract ? "contract" : "wallet"}</td><td className="px-3 py-2 text-right tabular-nums">{c.txIn} / {c.txOut}</td><td className="px-3 py-2 text-right tabular-nums">{formatEth(c.valueIn)}</td><td className="px-3 py-2 text-right tabular-nums">{formatEth(c.valueOut)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {p.tokens.length > 0 && (
        <section aria-labelledby="tok-h" className="space-y-3">
          <h2 id="tok-h" className="text-lg font-semibold">Token interactions</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <caption className="sr-only">Tokens this wallet sent or received</caption>
              <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th scope="col" className="px-3 py-2">Token</th><th scope="col" className="px-3 py-2 text-right">In</th><th scope="col" className="px-3 py-2 text-right">Out</th><th scope="col" className="px-3 py-2">Report</th></tr></thead>
              <tbody>
                {p.tokens.map((t) => <tr key={t.token} className="border-t border-border"><td className="px-3 py-2"><span className="mr-2">{safeText(t.symbol, 16) || "—"}</span><AddressDisplay address={t.token} kind="contract" /></td><td className="px-3 py-2 text-right tabular-nums">{t.transfersIn}</td><td className="px-3 py-2 text-right tabular-nums">{t.transfersOut}</td><td className="px-3 py-2"><Link className="underline" href={`/token/${t.token}`}>Risk report</Link></td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {p.largeTransfers.length > 0 && (
        <section aria-labelledby="large-h" className="space-y-2">
          <h2 id="large-h" className="text-lg font-semibold">Largest native transfers in the sample</h2>
          <ul className="space-y-1 text-sm">
            {p.largeTransfers.map((t) => <li key={t.txHash} className="flex flex-wrap items-center gap-2"><span className="tabular-nums">{formatEth(t.value)}</span><span className="text-muted-foreground">{t.direction === "in" ? "from" : "to"}</span>{t.counterparty && <AddressDisplay address={t.counterparty} />}<time dateTime={t.time} className="text-xs text-muted-foreground">{t.time.slice(0, 16).replace("T", " ")}</time><TxLink hash={t.txHash} /></li>)}
          </ul>
        </section>
      )}

      {p.deployments.length > 0 && (
        <section aria-labelledby="dep-h" className="space-y-2">
          <h2 id="dep-h" className="text-lg font-semibold">Contracts deployed directly</h2>
          <ul className="space-y-1 text-sm">{p.deployments.map((d) => <li key={d.token} className="flex flex-wrap items-center gap-2"><AddressDisplay address={d.token} kind="contract" /><TxLink hash={d.txHash} /></li>)}</ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">Behavioral profiles never prove who controls a wallet. Findings about tokens this wallet created are on its <Link className="underline" href={`/creator/${a}`}>creator page</Link>. Not an audit and not financial advice.</p>
    </>,
  );
}
