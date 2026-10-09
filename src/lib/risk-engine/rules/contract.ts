import type { CapabilityKey } from "@/lib/contracts/selectors";
import type { Rule, RuleResult, Severity } from "../types";
import { bestConfidence, capEvidence, capsOf, contractUsable, scanScope, unknown } from "./helpers";

const ownerRenounced = (ctx: Parameters<Rule["evaluate"]>[0]) => ctx.contract?.owner.state === "renounced";

function capabilityRule(spec: {
  id: string;
  name: string;
  description: string;
  keys: CapabilityKey[];
  maxSeverity: Severity;
  dedupGroup?: string;
  title: string;
  explain: string;
  notDetected: string;
  followUp: string;
  falsePositives: string;
  /** Severity when owner renounced and no role-admin functions exist (the capability is probably unreachable). */
  reducedSeverity?: Severity;
  baseSeverity: Severity;
}): Rule {
  const rule: Rule = {
    id: spec.id,
    name: spec.name,
    category: "contract",
    description: spec.description,
    maxSeverity: spec.maxSeverity,
    requires: ["contract bytecode", "owner() read", "verified ABI (optional)"],
    dedupGroup: spec.dedupGroup,
    evidenceKinds: ["selector", "address"],
    falsePositives: spec.falsePositives,
    evaluate(ctx): RuleResult {
      const r = rule;
      if (!contractUsable(ctx.contract)) return unknown(r, "Contract bytecode could not be analyzed, so this capability could not be checked.");
      const c = ctx.contract;
      const caps = capsOf(c, spec.keys);
      if (caps.length === 0) {
        return {
          status: "not_detected",
          severity: spec.maxSeverity,
          confidence: c.source.verified ? "high" : "medium",
          title: spec.name + ": not detected",
          explanation: `${spec.notDetected} Checked ${scanScope(c)}${c.source.verified ? " and the verified ABI" : " (selector scan only; source is not verified)"}.`,
          evidence: [],
        };
      }
      const hasRoles = capsOf(c, ["role_admin"]).length > 0;
      const reduced = spec.reducedSeverity && ownerRenounced(ctx) && !hasRoles && !c.proxy.upgradeable;
      const severity = reduced ? spec.reducedSeverity! : c.proxy.upgradeable ? (spec.baseSeverity === "low" ? "medium" : spec.baseSeverity) : spec.baseSeverity;
      const ev = capEvidence(c, caps);
      if (c.owner.address) ev.push({ kind: "address", label: `owner() = ${c.owner.state}`, address: c.owner.address });
      return {
        status: "detected",
        severity,
        confidence: bestConfidence(caps),
        title: spec.title,
        explanation: `${spec.explain} ${reduced ? "Ownership is renounced and no role-admin functions were found, so the capability may be unreachable. " : ""}Presence of a function does not show who can call it or that it is abused.`,
        followUp: spec.followUp,
        evidence: ev,
      };
    },
  };
  return rule;
}

export const contractRules: Rule[] = [
  {
    id: "VG-CFG-001",
    name: "Active owner",
    category: "contract",
    description: "An owner() account exists and has not been renounced.",
    maxSeverity: "low",
    requires: ["owner() read"],
    evidenceKinds: ["address"],
    falsePositives: "Many legitimate tokens keep an owner for configuration. Impact depends on what the owner can do (see other CFG rules).",
    evaluate(ctx): RuleResult {
      const r = contractRules[0];
      const c = ctx.contract;
      if (!c || !c.hasCode) return unknown(r, "Contract code was not available.");
      if (c.failures.includes("owner")) return unknown(r, "The owner() read failed because of a provider error.");
      if (c.owner.state === "none") return { status: "not_detected", severity: "low", confidence: "medium", title: "Active owner: no owner() function", explanation: "The contract does not expose owner(). Other admin patterns (roles, custom names) are not covered by this check.", evidence: [] };
      if (c.owner.state === "renounced") return { status: "not_detected", severity: "low", confidence: "high", title: "Active owner: ownership renounced", explanation: "owner() returns the zero address.", evidence: [{ kind: "address", label: "owner()", address: c.owner.address ?? undefined }] };
      return {
        status: "detected",
        severity: "low",
        confidence: "high",
        title: "Token has an active owner",
        explanation: `owner() returns ${c.owner.address}, which is ${c.owner.isContract === true ? "a contract (possibly a launchpad, multisig, or timelock)" : c.owner.isContract === false ? "an externally owned account" : "of unknown type"}. An owner usually holds privileged functions.`,
        followUp: "Check which functions the owner can call and whether the owner is a contract with its own restrictions.",
        evidence: [{ kind: "address", label: "owner()", address: c.owner.address ?? undefined, data: { isContract: c.owner.isContract } }],
      };
    },
  },
  capabilityRule({
    id: "VG-CFG-002", name: "Mint capability", description: "A mint function exists in the contract.", keys: ["mint"], baseSeverity: "medium", reducedSeverity: "low", maxSeverity: "high",
    title: "Contract can mint new tokens", explain: "A mint function exists, so supply may be increased after launch.", notDetected: "No mint function was found.",
    followUp: "Check who can call mint (owner, roles, the launchpad) and whether supply is capped.", falsePositives: "Launchpad or bonding-curve tokens often mint by design under contract-enforced rules.",
  }),
  capabilityRule({
    id: "VG-CFG-003", name: "Pause capability", description: "A pause function exists, allowing transfers to be halted.", keys: ["pause"], baseSeverity: "medium", reducedSeverity: "low", maxSeverity: "high",
    title: "Contract can pause transfers", explain: "A pause function exists, so transfers could be halted.", notDetected: "No pause function was found.",
    followUp: "Check who can pause and whether a time limit or governance applies.", falsePositives: "Pausing is a common safety feature in audited tokens.",
  }),
  capabilityRule({
    id: "VG-CFG-004", name: "Blacklist or whitelist controls", description: "Functions that can block or restrict specific addresses exist.", keys: ["blacklist", "whitelist"], baseSeverity: "high", reducedSeverity: "low", maxSeverity: "high", dedupGroup: "transfer-restriction",
    title: "Contract can restrict specific addresses", explain: "Blacklist or whitelist functions exist, so specific wallets could be prevented from transferring.", notDetected: "No blacklist or whitelist functions were found.",
    followUp: "Check who controls the list and whether it is used. Look for blocked holders in the transfer history.", falsePositives: "Some tokens use allow-lists for compliance or for a pre-launch phase.",
  }),
  capabilityRule({
    id: "VG-CFG-005", name: "Fee or tax controls", description: "Functions that change transfer fees or taxes exist.", keys: ["fee_control"], baseSeverity: "high", reducedSeverity: "low", maxSeverity: "high",
    title: "Contract can change fees or taxes", explain: "Fee or tax setter functions exist, so transfer costs could be changed after launch.", notDetected: "No fee or tax setter functions were found.",
    followUp: "Check the current fee values, any maximum caps, and who can change them.", falsePositives: "Fee-on-transfer tokens may legitimately adjust fees within a fixed cap.",
  }),
  capabilityRule({
    id: "VG-CFG-006", name: "Trading and limit controls", description: "Functions that enable trading or set transaction/wallet limits exist.", keys: ["trading_control", "limit_control"], baseSeverity: "medium", reducedSeverity: "low", maxSeverity: "high", dedupGroup: "transfer-restriction",
    title: "Contract can restrict trading or limit amounts", explain: "Functions to toggle trading or set max transaction/wallet limits exist, so transfers could be restricted.", notDetected: "No trading toggle or limit setters were found.",
    followUp: "Check whether trading is currently enabled and how limits are set.", falsePositives: "Anti-whale limits are sometimes used for fair launches.",
  }),
  {
    id: "VG-CFG-007",
    name: "Upgradeable proxy",
    category: "contract",
    description: "The token is behind an upgradeable proxy (EIP-1967 or beacon), so its logic can be replaced.",
    maxSeverity: "high",
    requires: ["EIP-1967 storage slots", "bytecode"],
    evidenceKinds: ["storage_slot", "address"],
    falsePositives: "Upgradeable proxies are standard practice when upgrades are governed by a timelock or multisig.",
    evaluate(ctx): RuleResult {
      const r = contractRules.find((x) => x.id === "VG-CFG-007")!;
      const c = ctx.contract;
      if (!c || !c.hasCode) return unknown(r, "Contract code was not available.");
      if (c.failures.includes("proxy_slots")) return unknown(r, "Proxy storage slots could not be read because of a provider error.");
      if (c.proxy.type === "minimal") {
        return { status: "not_detected", severity: "high", confidence: "high", title: "Upgradeable proxy: immutable clone", explanation: `The token is an EIP-1167 minimal proxy (immutable clone) of ${c.proxy.implementation}. The delegate target cannot be changed.`, evidence: [{ kind: "address", label: "Clone implementation", address: c.proxy.implementation ?? undefined }] };
      }
      if (!c.proxy.upgradeable) return { status: "not_detected", severity: "high", confidence: "medium", title: "Upgradeable proxy: not detected", explanation: "No EIP-1967 implementation or beacon slot is set. Other proxy patterns (custom slots, UUPS with non-standard storage) are not detected.", evidence: [] };
      const ev = [{ kind: "storage_slot" as const, label: `EIP-1967 ${c.proxy.type === "beacon" ? "beacon" : "implementation"} slot`, address: c.proxy.implementation ?? undefined }];
      if (c.proxy.admin) ev.push({ kind: "storage_slot", label: "EIP-1967 admin slot", address: c.proxy.admin });
      return {
        status: "detected",
        severity: "high",
        confidence: "high",
        title: "Token logic can be upgraded",
        explanation: `The token is an ${c.proxy.type === "beacon" ? "beacon" : "EIP-1967"} proxy. Whoever controls upgrades can replace the contract logic, including balances and permissions. Other contract findings describe only the current implementation.`,
        followUp: "Identify the proxy admin. Check whether it is a multisig or timelock.",
        evidence: ev,
      };
    },
  },
  {
    id: "VG-CFG-008",
    name: "Role-based administration",
    category: "contract",
    description: "Access-control role functions exist.",
    maxSeverity: "info",
    requires: ["contract bytecode"],
    evidenceKinds: ["selector"],
    falsePositives: "Role-based access control is a normal pattern; the finding is context for the other capability rules.",
    evaluate(ctx): RuleResult {
      const r = contractRules.find((x) => x.id === "VG-CFG-008")!;
      if (!contractUsable(ctx.contract)) return unknown(r, "Contract bytecode could not be analyzed.");
      const caps = capsOf(ctx.contract, ["role_admin"]);
      if (!caps.length) return { status: "not_detected", severity: "info", confidence: "medium", title: "Role-based administration: not detected", explanation: "No AccessControl role functions were found.", evidence: [] };
      return { status: "detected", severity: "info", confidence: bestConfidence(caps), title: "Contract uses role-based administration", explanation: "AccessControl-style role functions exist. Privileged functions may be callable by several role holders, not only the owner.", followUp: "List role holders from RoleGranted events.", evidence: capEvidence(ctx.contract, caps) };
    },
  },
];
