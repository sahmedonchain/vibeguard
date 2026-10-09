import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/risk-engine/types";
import {
  CATEGORY_LABELS,
  CATEGORY_WEIGHTS,
  CONFIDENCE_MULTIPLIER,
  HOLDER_THRESHOLDS,
  INSUFFICIENT_BELOW_COVERAGE,
  METHODOLOGY_VERSION,
  PROVISIONAL_BELOW_COVERAGE,
  RISK_LEVELS,
  SEVERITY_POINTS,
} from "@/lib/risk-engine/methodology";
import { RULES } from "@/lib/risk-engine/registry";

export const metadata: Metadata = { title: "Methodology", description: "How VibeGuard computes risk scores, coverage, and findings." };

const Table = ({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) => (
  <div className="overflow-x-auto rounded-lg border border-border">
    <table className="w-full min-w-[28rem] text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border align-top">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

export default function MethodologyPage() {
  const pctBps = (n: number) => `${n / 100}%`;
  return (
    <article className="mx-auto w-full max-w-4xl space-y-10 px-4 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Risk methodology</h1>
        <p className="mt-2 text-muted-foreground">Version {METHODOLOGY_VERSION}. Every number below is an initial product default, not an externally certified standard. They will change as false positives are measured; each change gets a new version.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What the score means</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>The score runs from 0 to 100. Higher means more detected risk. It does not measure quality.</li>
          <li>It is deterministic: the same on-chain data at the same block gives the same score.</li>
          <li>It is a heuristic summary of automated checks. It is not an audit and does not guarantee safety or predict price.</li>
          <li>Unknown is never safe. If a check cannot run, it adds no risk <em>and</em> lowers coverage. Coverage is shown separately from risk.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Risk levels</h2>
        <Table caption="Risk levels" head={["Score", "Level"]} rows={RISK_LEVELS.map((l) => [`${l.min}–${l.max}`, l.label])} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Categories and weights</h2>
        <Table caption="Category weights" head={["Category", "Weight", "Rules in this version"]} rows={CATEGORIES.map((c) => [CATEGORY_LABELS[c], `${CATEGORY_WEIGHTS[c] * 100}%`, RULES.filter((r) => r.category === c).length || "None yet (reported as not assessed)"])} />
        <p className="text-sm text-muted-foreground">Creator history, liquidity and suspicious-activity categories have no rules in this version, so they are reported as not assessed and reduce coverage. The maximum possible coverage today is {Math.round(CATEGORIES.reduce((a, c) => a + (RULES.some((r) => r.category === c) ? CATEGORY_WEIGHTS[c] : 0), 0) * 100)}%.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Calculation</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Each rule returns <strong>detected</strong>, <strong>not detected</strong> or <strong>unknown</strong>, with a severity, a confidence and evidence.</li>
          <li>A detected finding adds points to its category: severity points times a confidence multiplier. Rules in the same overlap group count once (the highest). Category risk is capped at 100.</li>
          <li>Category coverage is the share of registered rules that returned a known result. Overall coverage is the weight-weighted sum of category coverage.</li>
          <li>Overall risk is the weighted mean of category risk over categories that have coverage. Categories without coverage are not counted as zero risk.</li>
          <li>Coverage below {PROVISIONAL_BELOW_COVERAGE * 100}% marks the result <strong>provisional</strong>. Below {INSUFFICIENT_BELOW_COVERAGE * 100}% no numeric score is produced.</li>
          <li>A detected critical finding with medium or high confidence sets the level to critical regardless of the aggregate.</li>
        </ol>
        <div className="grid gap-4 sm:grid-cols-2">
          <Table caption="Severity points" head={["Severity", "Points"]} rows={Object.entries(SEVERITY_POINTS)} />
          <Table caption="Confidence multipliers" head={["Confidence", "Multiplier"]} rows={Object.entries(CONFIDENCE_MULTIPLIER)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Holder thresholds</h2>
        <p className="text-sm text-muted-foreground">Shares are of total supply, counting only non-contract, non-burn holders. Contracts and burn addresses are excluded from these figures but always shown. Bonding-curve and pool contracts often hold most supply; VibeGuard does not yet verify what a holding contract is.</p>
        <Table caption="Holder thresholds" head={["Metric", "Medium", "High", "Critical"]} rows={[
          ["Top 1 wallet", pctBps(HOLDER_THRESHOLDS.top1.medium), pctBps(HOLDER_THRESHOLDS.top1.high), pctBps(HOLDER_THRESHOLDS.top1.critical)],
          ["Top 10 wallets", pctBps(HOLDER_THRESHOLDS.top10.medium), pctBps(HOLDER_THRESHOLDS.top10.high), pctBps(HOLDER_THRESHOLDS.top10.critical)],
          ["Creation tx sender", pctBps(HOLDER_THRESHOLDS.creator.medium), pctBps(HOLDER_THRESHOLDS.creator.high), pctBps(HOLDER_THRESHOLDS.creator.critical)],
        ]} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Rules</h2>
        <Table caption="Rule registry" head={["ID", "Rule", "Category", "Max severity", "Needs", "False-positive notes"]} rows={RULES.map((r) => [r.id, `${r.name}: ${r.description}`, CATEGORY_LABELS[r.category], r.maxSeverity, r.requires.join("; "), r.falsePositives])} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Limitations</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Without verified source, capabilities come from function selectors in bytecode. A selector shows a function exists, not who may call it or whether it is abused. These findings have medium confidence.</li>
          <li>Proxy detection covers EIP-1167 clones and EIP-1967 proxies. Other patterns are not detected.</li>
          <li>Holder figures come from indexed Transfer events and are reconciled against totalSupply() and balanceOf(). Rebasing or fee-adjusting tokens will fail reconciliation and are flagged.</li>
          <li>Only the 50 largest holders are classified. If fewer than 20 non-excluded holders are found among them, shares are marked as lower bounds.</li>
          <li>Liquidity, market, creator-history and suspicious-activity analysis are not available yet.</li>
          <li>Testnet results do not establish mainnet security.</li>
        </ul>
      </section>
    </article>
  );
}
