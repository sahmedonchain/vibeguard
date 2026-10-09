import Link from "next/link";
import { ArrowRight, Eye, FileSearch, Scale, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PHASE_NAMES } from "@/lib/routes";

const CHECKS = [
  { icon: FileSearch, title: "Contract analysis", body: "Owner and role powers, mint, pause, blacklist, proxy upgradeability, and fee controls, read from bytecode and verified source." },
  { icon: Scale, title: "Holder concentration", body: "Top-holder share computed from transfer history, with contracts, pools, and burn addresses classified, never silently excluded." },
  { icon: Users, title: "Creator & sybil signals", body: "Deployment history and funding facts, kept separate from inferences. Labeled only as possible coordination." },
  { icon: Eye, title: "Whale & activity tracking", body: "Large transfers and wallet activity with block and time shown. A transfer is not treated as a trade." },
] as const;

const STEPS = [
  { n: "1", title: "Submit an address", body: "Paste a token contract address from Robinhood Chain Testnet." },
  { n: "2", title: "We read the chain", body: "Findings come from on-chain data. Each finding links to its evidence." },
  { n: "3", title: "Score with coverage", body: "Risk and data coverage are reported separately. Unknown never means safe." },
] as const;

const LIVE_PHASES = [1, 2, 3, 4, 5, 6] as const;

export default function Home() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
        <Badge className="mb-4 text-muted-foreground">Robinhood Chain Testnet · Early build</Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Check a VibeVibe token before you trade it.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          VibeGuard turns on-chain data into evidence-backed risk findings. Every claim links to the transaction, contract, or
          block it came from.
        </p>
        <form action="/scan" method="get" className="mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row">
          <label htmlFor="address" className="sr-only">Token contract address</label>
          <input
            id="address"
            name="address"
            required
            pattern="0x[0-9a-fA-F]{40}"
            title="A 42-character address starting with 0x"
            placeholder="0x… token address"
            autoComplete="off"
            spellCheck={false}
            className="h-10 flex-1 rounded-md border border-border bg-card px-3 font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
          />
          <Button type="submit">Scan token <ArrowRight className="size-4" aria-hidden /></Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          The scanner is not live yet. It arrives in phase 2 ({PHASE_NAMES[2]}).
        </p>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold">What VibeGuard looks at</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHECKS.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <Icon className="mb-3 size-5 text-primary" aria-hidden />
                <h3 className="font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n}>
              <Card className="h-full">
                <span className="text-sm font-semibold text-primary">Step {s.n}</span>
                <h3 className="mt-1 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><ShieldAlert className="size-5 text-sev-medium" aria-hidden /> What this is not</h2>
          <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Not an audit. Automated checks miss things.</li>
            <li>Not financial advice. Testnet tokens have no monetary value.</li>
            <li>Not a safety badge. A report with no findings means no findings were detected, within the stated coverage.</li>
            <li>Not affiliated with VibeVibe or Robinhood.</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Build status</h2>
        <p className="mt-2 text-muted-foreground">Features ship in phases. Only phase 1 is done.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {LIVE_PHASES.map((p) => (
            <li key={p} className="flex items-center justify-between rounded-md border border-border px-4 py-2 text-sm">
              <span>Phase {p}: {PHASE_NAMES[p]}</span>
              <Badge className={p === 1 ? "text-sev-low" : "text-muted-foreground"}>{p === 1 ? "Done" : "Planned"}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          See the <Link href="/methodology" className="underline">methodology</Link> page for how scoring will work.
        </p>
      </section>
    </>
  );
}
