import Link from "next/link";
import { ArrowRight, Code2, Eye, FileSearch, Scale, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { RiskScore } from "@/components/shared/risk-score";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const TOOLS = [
  { icon: FileSearch, route: ROUTES.scan, body: "Contract permissions, ownership, proxy upgradeability, holder concentration and supply integrity, each with evidence." },
  { icon: Scale, route: ROUTES.methodology, body: "Weights, thresholds and every rule are public. Unknown is never treated as safe." },
  { icon: Users, route: ROUTES.sybil, body: "Possible coordination between wallets, with confidence and alternative explanations." },
  { icon: Eye, route: ROUTES.whales, body: "Large transfers and holder balance changes with block and time." },
  { icon: Code2, route: ROUTES.developers, body: "A versioned JSON API for the same reports." },
  { icon: ShieldAlert, route: ROUTES.doctor, body: "Pre-launch static checks for contracts you deploy." },
] as const;

const STEPS = [
  { n: "1", title: "Submit a token address", body: "Paste an ERC-20 contract address from Robinhood Chain Testnet." },
  { n: "2", title: "VibeGuard reads the chain", body: "A background worker reads the contract and indexes its transfers. Every finding links to its evidence." },
  { n: "3", title: "Score with coverage", body: "Risk and data coverage are reported separately. Partial results are labeled provisional." },
] as const;

export default function Home() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
        <Badge className="mb-4 text-muted-foreground">Robinhood Chain Testnet · Early build</Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Know the Risk Behind Every Token.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Investigate tokens, wallets and on-chain activity across the VibeVibe ecosystem with transparent risk signals and evidence-backed intelligence.
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
          <button type="submit" className={cn(buttonVariants())}>Scan a Token <ArrowRight className="size-4" aria-hidden /></button>
        </form>
        <p className="mt-3 text-sm">
          <Link href="/ecosystem" className="text-muted-foreground underline">Explore Ecosystem</Link>
          <span className="text-muted-foreground"> (not built yet)</span>
        </p>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold">Security tools</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(({ icon: Icon, route, body }) => (
              <Link key={route.path} href={route.path} className="group rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
                <Card className="h-full transition-colors group-hover:border-primary/60">
                  <div className="flex items-center justify-between">
                    <Icon className="size-5 text-primary" aria-hidden />
                    {"live" in route && route.live ? <Badge className="text-sev-low">Live</Badge> : <Badge className="text-muted-foreground">Phase {route.phase}</Badge>}
                  </div>
                  <h3 className="mt-3 font-medium">{route.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </Card>
              </Link>
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
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">What a report looks like</h2>
            <p className="mt-2 text-muted-foreground">Each report shows a score, how much of the methodology could be evaluated, and findings with severity, confidence and links to on-chain evidence. The card on the right is an illustration.</p>
            <p className="mt-3 text-sm text-muted-foreground">The methodology is public: category weights, severity points, thresholds and every rule. <Link href="/methodology" className="underline">Read the methodology</Link>.</p>
          </div>
          <Card aria-label="Example report, illustrative data" className="space-y-4">
            <Badge className="border-sev-medium/60 text-sev-medium">Example — illustrative data, not a real token</Badge>
            <div className="flex items-center gap-4">
              <RiskScore score={34} coverage={0.55} level="moderate" />
              <p className="text-sm text-muted-foreground">Provisional: only part of the methodology could be evaluated. Unchecked categories are not assumed safe.</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><SeverityBadge severity="medium" /> Contract can mint new tokens</div>
              <div className="flex items-center gap-2"><SeverityBadge severity="low" /> Token has an active owner</div>
              <div className="flex items-center gap-2"><SeverityBadge severity="info" /> Contracts hold 68.30% of supply</div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Developers</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Reports are available as JSON. The current endpoints are <code className="rounded bg-muted px-1 font-mono text-sm">POST /api/v1/scans</code>, <code className="rounded bg-muted px-1 font-mono text-sm">GET /api/v1/scans/&#123;id&#125;</code> and <code className="rounded bg-muted px-1 font-mono text-sm">GET /api/v1/tokens/&#123;address&#125;/risk</code>. Full documentation arrives in phase 5; see <Link className="underline" href="/developers/api">API reference</Link>.</p>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><ShieldAlert className="size-5 text-sev-medium" aria-hidden /> Limitations</h2>
          <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-muted-foreground">
            <li>This is a testnet product. Testnet tokens have no monetary value and results do not establish mainnet security.</li>
            <li>VibeGuard is not an audit and not financial advice. A report with no findings means none were detected within the stated coverage.</li>
            <li>Tokens are scanned only when you submit their address. Creator history, liquidity and suspicious-activity analysis are not available yet.</li>
            <li>VibeGuard is independent. It is not affiliated with VibeVibe or Robinhood.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
