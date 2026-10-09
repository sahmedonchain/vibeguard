VibeGuard-কে VibeVibe.fun-এর target users-এর উপযোগী, production-minded Web3 security ও token intelligence platform হিসেবে পরিকল্পনা করা হবে। তবে একটি বিষয় পরিষ্কার: শুধু Claude Code-কে বড় prompt দিলেই production-ready security product নিশ্চিত হয় না। সঠিক architecture, বাস্তব blockchain data, test coverage, security review এবং deployment verification—সবগুলোই প্রয়োজন।

তোমার জন্য নিচে এমন একটি Master SRS + Complete Product Blueprint তৈরি করছি, যেটা Claude-কে দিলে সে প্রথমে পুরো project structure বুঝবে, তারপর phase অনুযায়ী implementation করবে। এটি হবে public, no-login product—কোনো user dashboard বা admin panel ছাড়াই।

মূল নীতি: VibeGuard-এর প্রতিটি feature বাস্তব, যাচাইযোগ্য data-এর ওপর কাজ করবে; data পাওয়া না গেলে সেটি স্পষ্টভাবে জানাবে, কখনো fake analytics বা invented risk score দেখাবে না।

VibeVibe-এর প্রকাশ্য project description অনুযায়ী, এর ecosystem-এ permissionless token launch, builders এবং community-driven token projects গুরুত্বপূর্ণ। তাই VibeGuard-এর প্রধান ব্যবহারকারী হবে token traders, token creators/builders এবং project communities—এবং তাদের সমস্যার সঙ্গে সরাসরি যুক্ত feature-গুলোই প্রথমে তৈরি করা উচিত। 
LinkedIn

নিচের SRS-এ feature list, architecture, data model, scoring methodology, UI/UX, API, security, testing, deployment এবং Claude Code-এর implementation phases একসঙ্গে রাখা হয়েছে। একটি গুরুত্বপূর্ণ technical rule-ও থাকবে: testnet.vibevibe.fun-এর RPC, chain ID, explorer এবং contract standards Claude-কে আগে verify করতে হবে; নাম দেখে Ethereum compatibility বা কোনো নির্দিষ্ট endpoint ধরে নেওয়া যাবে না।

VibeGuard — Complete Product Blueprint

Master SRS · Product Requirements · Technical Architecture · Implementation Roadmap · Claude Code Instructions

VibeGuard — Complete Product Blueprint
VibeGuard — Complete Product Blueprint

Document Type: Master Software Requirements Specification (SRS)
Product Category: Web3 Security & On-Chain Intelligence
Target Ecosystem: VibeVibe.fun / VibeVibe Chain Testnet
Product Model: Public, no-login blockchain intelligence platform
Development Approach: Claude Code, phase-by-phase implementation
Deployment Target: GitHub + Vercel + required backend/worker infrastructure
Primary Goal: Build a professional, data-driven token risk analysis and wallet intelligence platform for the VibeVibe ecosystem.

1. PROJECT OVERVIEW
1.1 Product Vision

VibeGuard is a public Web3 security and on-chain intelligence platform designed to help users investigate tokens, creators, wallets, holder distribution, suspicious activity and market behavior within the VibeVibe ecosystem.

The platform should help users make more informed decisions by transforming complex on-chain data into understandable risk signals, transparent scoring, visual analytics and evidence-backed reports.

VibeGuard must not be a simple landing page, static dashboard, or fake analytics demo. Its core value must come from a functioning blockchain data pipeline and a reliable risk-analysis engine.

1.2 Core Mission

Help VibeVibe ecosystem participants answer five important questions:

Is this token showing any identifiable risk signals?
Who created the token, and what does the creator wallet's history reveal?
Is token ownership concentrated in a small number of wallets?
Does wallet or market activity suggest unusual or coordinated behavior?
What evidence should a user examine before trusting a token or project?

VibeGuard provides information and risk signals. It does not guarantee that a token is safe, predict future prices, or replace an independent security audit.

1.3 Target Users
Primary Users: Token Traders and Researchers

Problems:

Difficulty identifying suspicious tokens quickly.
Lack of clear information about holders and creator wallets.
Difficulty distinguishing organic activity from potentially coordinated activity.
Having to switch between explorers, charts and security tools.

VibeGuard solution:

One token search and investigation interface.
Transparent risk score with evidence.
Holder concentration and wallet activity analysis.
Suspicious activity indicators and optional alerts.
Secondary Users: Token Creators and Builders

Problems:

Uncertainty about how a token contract appears to external researchers.
Difficulty identifying configuration risks before launch.
Lack of a public, understandable token health report.

VibeGuard solution:

Token Doctor pre-launch checks.
Contract permission and configuration analysis.
Transparent, evidence-based reports.
A verification workflow that does not misrepresent an automated scan as an audit.
Third User Group: Community Leaders and Ecosystem Researchers

Problems:

Difficulty comparing token projects consistently.
Limited visibility into emerging ecosystem risks.
Difficulty tracking large transfers and unusual wallet relationships.

VibeGuard solution:

Ecosystem risk overview.
Wallet and token investigation tools.
Whale activity and momentum signals.
Public, shareable investigation reports.
Fourth User Group: Developers and Integrators

Problems:

Need for a consistent way to retrieve VibeGuard risk signals.
Need to integrate token or wallet risk information into other tools.

VibeGuard solution:

Versioned public API.
API documentation and examples.
Consistent JSON response schemas.
Optional API keys, quotas and rate limits.
1.4 Product Principles
Evidence before conclusions.
Real data before visual polish.
Transparent scoring instead of unexplained numbers.
No fake metrics, fake transactions or fabricated security results.
No login or account requirement for core public features.
Graceful degradation when the testnet or an external provider is unavailable.
Testnet-first implementation with a configurable path to future networks.
Security, maintainability and testing are part of the product—not later additions.
AI may explain verified findings but must not invent findings.
The interface must clearly distinguish observed facts, heuristics and unknown information.
2. PROJECT SCOPE AND EXCLUSIONS
2.1 Included
Public landing page and token search.
Token risk scanner.
Token health score.
Creator reputation analysis.
Holder quality analysis.
Wallet DNA.
Sybil and coordinated-wallet detection.
Whale activity tracker.
Momentum detection.
Suspicious activity detection.
Browser-based real-time alerts.
Optional notification subscriptions.
AI-assisted risk reports.
Token Doctor pre-launch checks.
Trust and verification status.
Ecosystem risk dashboard.
Developer documentation and API.
Backend services, indexing, caching, monitoring and testing.
GitHub workflow and deployment configuration.
2.2 Explicitly Excluded

Do not build any of the following unless explicitly requested in a later scope change:

User dashboard.
User registration or login.
User profile pages.
User account settings.
User-specific scan history requiring an account.
Admin dashboard or admin login UI.
Token launchpad or token deployment functionality.
Wallet custody or private-key storage.
Automated trading or token purchasing.
Guaranteed-profit or token-price prediction features.
Claims that a token is definitely safe based only on an automated scan.
A fake verification or audit badge.

Backend observability, database access controls, deployment secrets and infrastructure monitoring are still required. The absence of a public admin panel does not mean the backend should be unsecured.

3. TECHNICAL DISCOVERY — FIRST REQUIRED TASK

Before implementing blockchain-dependent functionality, inspect the actual VibeVibe environment.

The provided reference is:

https://testnet.vibevibe.fun/

Do not assume that the reference website's hostname is itself an RPC endpoint.

3.1 Verify
Official network documentation.
Network name and chain ID.
HTTP RPC endpoint.
WebSocket RPC support, if available.
Block explorer and address/transaction URL formats.
Native currency and token standards.
Contract deployment conventions.
Available historical block data.
Log and transaction query limits.
Rate limits and provider terms.
Whether a reliable token registry exists.
Whether factory or launchpad contracts can be identified.
Whether external security APIs support this network.
Whether the network provides archive data or historical state queries.
3.2 Deliverable

Create docs/CHAIN_DISCOVERY.md containing:

Verified sources.
Confirmed chain configuration.
Verified contract standards.
Verified RPC capabilities.
Available token-discovery methods.
Data limitations.
Unsupported capabilities.
Implementation decisions.

Never invent an RPC URL, chain ID, contract address, API endpoint or explorer URL.

If any important value cannot be verified, leave it configurable and document the missing information.

3.3 Chain Adapter

Create a network abstraction so the application does not depend on hardcoded network values.

Suggested structure:

src/lib/chain/

config.ts
client.ts
adapter.ts
tokens.ts
blocks.ts
logs.ts
transactions.ts
explorer.ts
capabilities.ts

Use a suitable EVM library such as Viem only after confirming EVM/RPC compatibility. If the target chain is not compatible with the selected library, use the appropriate supported client instead.

The application must identify the active network clearly in the UI.

4. TECHNICAL STACK

Choose stable, mutually compatible versions at the start of implementation. Record them in the repository and do not upgrade dependencies unnecessarily during development.

4.1 Frontend
Next.js with App Router.
React.
TypeScript with strict mode.
Tailwind CSS.
shadcn/ui or an equivalent accessible component system.
Recharts or another suitable charting library.
Lucide icons.
A lightweight animation library only where animation adds value.
4.2 Backend

Use Next.js server routes for appropriate API functionality, but do not force all background workloads into short-lived serverless functions.

Required backend capabilities:

Input validation.
Chain data access.
Risk calculations.
Caching.
API rate limiting.
Report generation.
Structured error responses.
Health and readiness checks.
4.3 Database

Preferred: PostgreSQL.

Use a typed ORM such as Drizzle ORM or Prisma. Select one and keep the project consistent.

Store indexed chain data, token metadata, scan results, risk findings, alert subscriptions and API usage data where appropriate.

4.4 Caching and Jobs

Use Redis and a background queue if supported by the chosen deployment environment.

Background jobs should handle:

Block and log indexing.
Historical token analysis.
Recalculation of scores.
Large holder scans.
Periodic monitoring.
Notification delivery.
AI report generation where appropriate.

A database-backed job mechanism can be used initially if it is reliable and properly designed. Do not make Redis a hard dependency if the project does not need it yet.

4.5 External Services

Potential integrations:

Verified VibeVibe RPC/provider.
Supported block explorer.
External token-security provider, if the chain is supported.
AI API for explanations.
Email or Web Push provider for optional alerts.
Error monitoring and uptime monitoring.

External providers must be optional adapters, not hardcoded assumptions.

If a provider does not support VibeVibe Testnet, do not use its unrelated mainnet results as if they belonged to VibeVibe.

4.6 Deployment
GitHub for version control.
Vercel for the Next.js frontend and compatible server-side routes.
Separate worker hosting when persistent indexing or WebSocket connections are required.
Managed PostgreSQL.
Optional managed Redis.
Environment-specific configuration.
Automated build and test checks in CI.

Do not assume that a persistent WebSocket listener, long-running indexer or queue worker can run reliably inside a short-lived serverless function.

5. PRODUCT ROUTES AND INFORMATION ARCHITECTURE

No login, user dashboard or public admin panel.

5.1 Required Routes
/ — Landing page.
/scan — Token scanner and search.
/token/[address] — Token intelligence report.
/wallet/[address] — Wallet intelligence report.
/creator/[address] — Creator reputation report.
/sybil — Coordinated-wallet investigation interface.
/whales — Whale activity.
/momentum — Market activity and momentum.
/alerts — Browser-based alert configuration.
/doctor — Token Doctor.
/ecosystem — Ecosystem risk overview.
/developers — Developer overview.
/developers/api — API documentation.
/methodology — Risk scoring methodology.
/about — Product purpose and limitations.
/privacy — Privacy policy.
/terms — Terms and risk disclaimer.
/status — Public service status, if supported.

A route may be merged with another when it improves the user experience. Every feature must still be reachable and usable.

5.2 Shared UI Components

Create reusable components for:

Header and responsive navigation.
Footer.
Token and wallet search.
Address display and copy action.
Network selector when multiple networks are supported.
Risk score display.
Risk severity indicator.
Data freshness label.
Loading skeleton.
Empty state.
Error state.
Unsupported data state.
Pagination or virtualized lists.
Chart containers.
Evidence cards.
Transaction links.
Tooltips explaining technical concepts.
Export/share report controls.

Do not duplicate the same logic or component across multiple pages.

6. LANDING PAGE

The landing page should immediately communicate what VibeGuard does.

6.1 Hero

Suggested headline:

Know the Risk Behind Every Token.

Suggested supporting text:

“Investigate tokens, wallets and on-chain activity across the VibeVibe ecosystem with transparent risk signals and evidence-backed intelligence.”

Primary action: Scan a Token

Secondary action: Explore Ecosystem

Hero search should accept a token contract address. A wallet address can also be accepted if the input is identified as a wallet.

6.2 Landing Sections
Hero with token search.
Live ecosystem data summary, only if real data is available.
Main security tools.
How VibeGuard works.
Example risk report using explicitly labelled example data if it is not live.
Latest real ecosystem signals, if indexing supports them.
Risk methodology summary.
Developer/API introduction.
Limitations and testnet notice.
Footer with documentation and legal links.
6.3 Landing Page Requirements
Responsive desktop, tablet and mobile layouts.
Strong visual hierarchy.
Fast initial rendering.
Clear calls to action.
No fake TVL, volume, token count or scan count.
No fabricated live activity.
No disconnected buttons.
No placeholder links in the final product.
SEO metadata and social sharing metadata.
7. TOKEN RISK SCANNER
7.1 Purpose

Analyze a token contract and available on-chain activity, then return a structured report with evidence-backed risk findings.

7.2 Input
Token contract address.
Explicit network context.
Optional block range or analysis depth where supported.

Validate address syntax and checksum where applicable.

Reject malformed input before performing expensive RPC calls.

7.3 Analysis Categories
Contract Configuration

Where the chain and contract standard support these checks:

Contract code exists.
Contract is verified, if the explorer exposes verification status.
Token standard and interface detection.
Owner or administrator privileges.
Minting capability.
Pausing capability.
Blacklist or whitelist controls.
Transfer restrictions.
Upgradeability and proxy configuration.
Fee or tax modification privileges.
Unusual or privileged transfer logic.
External contract dependencies.

Do not treat every privileged function as malicious. Explain the capability and the associated risk context.

Ownership and Supply
Total supply.
Largest holders.
Holder concentration.
Creator/deployer holdings, when identifiable.
Concentration changes over time.
Transfers from large holders.
Liquidity and Market Activity

Where a recognized DEX or liquidity source exists:

Available liquidity pools.
Liquidity depth.
Liquidity changes.
Large liquidity removals.
Pool age.
Trading volume and transaction counts.
Abnormal buy/sell patterns.

If no verified pool or market data source exists, mark those checks unavailable.

Historical Behavior
Creator wallet history.
Previous deployments where discoverable.
Relevant historical transactions.
Repeated suspicious patterns.
Related wallets with supporting evidence.
7.4 Output

Return:

Token name and symbol, if reliably available.
Contract address.
Network.
First-seen or deployment block, if identifiable.
Total supply, where supported.
Overall risk score and risk level.
Category-level scores.
Findings with severity.
Evidence and affected addresses/transactions.
Unknown or unavailable checks.
Scan timestamp and block reference.
Data coverage.
Explorer links.
7.5 Scan States

Support:

queued
running
completed
partial
failed
unsupported

A partially completed scan must never be presented as a complete security assessment.

8. TOKEN HEALTH SCORE
8.1 Purpose

Provide a consistent, understandable summary of token risk signals.

The score is an analytical indicator, not a guarantee of safety or future performance.

8.2 Initial Risk Categories

Use a 0–100 risk scale:

0–19: Low observed risk.
20–39: Moderate observed risk.
40–59: Elevated risk.
60–79: High risk.
80–100: Critical risk.

These thresholds are initial product defaults and must be documented, tested and calibrated. They are not externally certified risk standards.

A high score means more detected risk, not a higher-quality token.

8.3 Initial Category Weights

Use a transparent weighted model with configurable weights:

Contract permissions and behavior: 30%.
Holder concentration: 20%.
Creator/deployer history: 15%.
Liquidity and market structure: 15%.
Suspicious transaction behavior: 15%.
Data integrity and provenance concerns: 5%.

These are starting weights, not scientifically validated constants. Document them and revise them based on testing and false-positive analysis.

8.4 Calculation Rules
Every category must expose its contributing findings.
Unknown data must not automatically be treated as safe.
Missing categories must not silently receive a zero-risk score.
Calculate coverage separately from risk.
If required data is missing, mark the result provisional or insufficient.
Severe confirmed findings may trigger a critical warning independently of the aggregate score.
The same evidence must not be counted repeatedly through overlapping rules.
Record the scoring methodology version.
Ensure identical inputs produce deterministic results.
8.5 Score Display

Show:

Overall risk score.
Risk category.
Data coverage percentage or clear coverage status.
Top contributing findings.
Category breakdown.
Last updated time.
Scoring methodology link.
Explanation of what the score does and does not mean.

Never show a score without a way to understand it.

9. CREATOR REPUTATION CHECK
9.1 Purpose

Analyze the wallet associated with a token creator or deployer.

9.2 Analysis
Identify the deployer from reliable transaction data.
Analyze transaction history within available limits.
Discover other deployments where supported.
Identify funding source and funder relationships where evidence is available.
Analyze token holdings and transfers.
Examine repeated suspicious patterns.
Identify relevant known-risk labels from trustworthy sources, if available.
Distinguish verified facts from inferred relationships.
9.3 Reputation Output
Creator wallet.
Evidence-backed deployment history.
Observed wallet age or first-seen block.
Transaction activity summary.
Related contracts.
Known risk findings.
Relevant wallet relationships.
Data coverage.
Reputation assessment with methodology.

Do not claim that a wallet belongs to a named person without reliable public evidence.

Do not label a creator a scammer merely because a project failed or a token lost value.

10. HOLDER QUALITY ANALYSIS
10.1 Purpose

Explain token ownership distribution and possible concentration risk.

10.2 Required Metrics

Where data permits:

Total holder count.
Top 1 holder share.
Top 5 holder share.
Top 10 holder share.
Top 20 holder share.
Creator/deployer share.
Known liquidity pool or pair balances.
Burn address balances.
Contract-held balances.
Holder distribution chart.
Balance concentration over time.
Large holder changes.
10.3 Classification

Separate:

Externally owned wallets.
Contract addresses.
Known liquidity pools.
Burn addresses.
Creator/deployer.
Unclassified wallets.

Exclude or separately identify special addresses when calculating concentration metrics. Explain exclusions and show raw figures where useful.

Never silently remove addresses from the calculations.

10.4 Data Integrity
Use a verified token balance method.
Reconcile transfer-event-derived balances where possible.
Handle minting and burning correctly.
Support token decimals.
Handle reorgs and incomplete indexing.
Clearly identify whether results are block-specific or current.
11. WALLET DNA
11.1 Purpose

Build a wallet intelligence profile from observed on-chain activity.

11.2 Analysis Categories
First-seen transaction and latest activity.
Transaction frequency.
Incoming versus outgoing flows.
Interaction counterparties.
Token interaction patterns.
Contract deployment activity.
Funding sources.
Large transfers.
Activity timing.
Wallet balance changes, where available.
Related addresses.
Relevant historical risk signals.
11.3 Output
Wallet overview.
Activity timeline.
Transaction and interaction summary.
Relevant counterparties.
Wallet relationship graph.
Risk findings.
Observed behavior patterns.
Data coverage and analysis limitations.

Do not imply that a behavioral profile proves a wallet owner's identity.

12. SYBIL / COORDINATED-WALLET DETECTION
12.1 Purpose

Identify groups of wallets that exhibit suspiciously similar or coordinated on-chain behavior.

12.2 Signals
Shared funding source.
Similar funding amounts.
Close timing of funding.
Repeated interactions with the same contracts.
Similar transaction sequences.
Coordinated token purchases or transfers.
Repeated consolidation into a common wallet.
Similar deployment or interaction patterns.
Graph relationships supported by on-chain evidence.
12.3 Detection Method

Start with transparent heuristic rules and a weighted evidence model.

Possible implementation:

Graph representation of wallet relationships.
Shared-funder clustering.
Time-window correlation.
Repeated-pattern matching.
Confidence scoring based on independent signals.

Advanced graph algorithms may be added when enough data exists.

12.4 Output
Cluster identifier.
Wallets in the cluster.
Relationship edges.
Signals supporting the relationship.
First and last observed interaction.
Confidence level.
Alternative explanations.
Evidence links.

Use labels such as Possible Coordination or High Behavioral Similarity.

Never declare that wallets belong to the same person based only on shared funding or similar activity.

13. WHALE ACTIVITY TRACKER
13.1 Purpose

Monitor large holders and significant token movements.

13.2 Features
Largest holders.
Large transfers.
Holder accumulation and distribution.
Significant liquidity movements, where supported.
Large holder balance changes.
Configurable amount or percentage thresholds.
Activity timeline.
Address and transaction links.
Optional browser alerts.
13.3 Requirements
Thresholds should be configurable.
Distinguish transfers from confirmed trades.
Do not interpret every transfer as buying or selling.
Identify known pools and contract addresses where possible.
Deduplicate events.
Handle reorgs and event corrections.
Show the block and timestamp used.
14. REAL MOMENTUM DETECTION
14.1 Purpose

Analyze observable market activity without claiming certainty about future price direction.

14.2 Metrics

Where trustworthy market data exists:

Transaction count over time.
Unique participating wallets.
Buy/sell transaction counts.
Trading volume.
Liquidity changes.
Large trades.
Holder growth.
Short-term versus longer-term activity changes.
14.3 Signal Types
Activity increasing.
Activity decreasing.
Unusual volume.
Increasing unique participants.
Concentrated activity.
Possible artificial or coordinated activity.
Insufficient market data.
14.4 Requirements
Use consistent time windows.
Explain the baseline used for comparisons.
Separate raw metrics from inferred signals.
Never fabricate price, volume or liquidity.
Clearly indicate when the token lacks a supported market pool.
15. SUSPICIOUS ACTIVITY DETECTION
15.1 Purpose

Identify patterns that deserve investigation.

15.2 Initial Rules
Unusual mint activity.
Significant privilege changes.
Large holder transfers.
Sudden liquidity removal, when observable.
Repeated transfers between related wallets.
Concentrated activity among suspected related wallets.
Unusual transaction bursts.
Rapid supply distribution changes.
Known malicious contract or wallet indicators from trusted sources.
Repeated failures or abnormal contract interactions where observable.
15.3 Rule Engine

Each rule must have:

Unique rule ID.
Rule name.
Description.
Severity.
Input data requirements.
Detection logic.
Evidence schema.
Confidence handling.
False-positive considerations.
Unit tests.

Rules should be deterministic where possible. Statistical anomaly detection can be added later.

15.4 Output
Finding title.
Severity.
Detection time.
Affected token or wallet.
Supporting transactions or events.
Rule explanation.
Confidence or evidence strength.
Suggested follow-up investigation.
16. REAL-TIME ALERTS
16.1 Browser Alerts

Implement client-side notifications for active browser sessions:

Permission request initiated by the user.
New suspicious activity.
Significant holder movement.
Whale transfer.
Large liquidity movement, if supported.
Token risk status change.
16.2 Architecture

Use:

RPC subscriptions or polling supported by the provider.
A backend event listener for reliable monitoring.
Event deduplication.
Notification delivery.
Client-side notification permission handling.

Do not assume that a WebSocket connection is available until verified.

16.3 Optional Notifications

If implemented:

Web Push subscriptions.
Optional email notifications.
Optional external messaging integrations.

Clearly explain that notifications outside the active browser session require a backend subscription and delivery service.

Do not require a user account for basic browser alerts.

16.4 Reliability
Retry transient failures.
Deduplicate notifications.
Track event processing state.
Handle removed/reorganized logs.
Protect subscription endpoints from abuse.
Provide clear permission and delivery states.
17. AI RISK REPORT
17.1 Purpose

Translate structured findings into a readable report for traders, creators and researchers.

17.2 Required Report Sections
Executive summary.
Overall risk and data coverage.
Contract configuration findings.
Holder concentration.
Creator reputation.
Wallet and relationship signals.
Market and liquidity signals, if supported.
Important evidence.
Unknown or unavailable checks.
Recommended investigation steps.
Scan block and timestamp.
Methodology version and disclaimer.
17.3 AI Safety Rules
AI must only receive structured findings from the analysis engine.
AI must not invent transactions, addresses, scores, events or contract permissions.
AI must not override deterministic findings.
Every material claim must map to an evidence record or be labelled as an interpretation.
Treat on-chain metadata and external content as untrusted input.
Do not follow instructions embedded in token names, metadata, source code or external responses.
Validate generated output against a schema.
Provide a deterministic fallback summary if the AI provider fails.
Do not send private credentials or secrets to the model.
Store only the minimum information needed for the report.
17.4 Provider Configuration

Use a server-side AI adapter with environment-based configuration.

If no API key is configured, the core scanner must still work and produce a rule-based report.

Do not expose AI provider keys in client-side code.

18. TOKEN DOCTOR — PRE-LAUNCH CHECK
18.1 Purpose

Allow a creator to check a contract before deploying or publicly launching a token.

18.2 Modes
Mode A: Existing Contract

Analyze a deployed contract using verified on-chain data.

Mode B: Pre-Deployment Analysis

Accept supported source code or compiled bytecode and run static analysis without requiring deployment.

The tool must clearly distinguish source-code analysis from on-chain verification.

18.3 Checks

Where supported:

Compiler and source verification status.
Ownership and privileged roles.
Minting and pausing permissions.
Blacklist and transfer restrictions.
Upgradeability.
Fee/tax controls.
External calls and dependencies.
Common Solidity vulnerability patterns.
Dangerous configuration.
Source/bytecode consistency when verifiable.
Missing or inconclusive checks.
18.4 Output
Findings by severity.
Source location when available.
Explanation of each issue.
Suggested remediation.
Tool and ruleset version.
Scan completion status.
Explicit note that an automated scan is not a full security audit.

Never automatically deploy or execute arbitrary user-submitted code.

Use sandboxed static analysis where appropriate.

19. TRUST BADGE AND VERIFICATION STATUS
19.1 Purpose

Display what VibeGuard has actually verified, rather than implying a project is universally safe.

19.2 Possible Statuses
Not Scanned
Scan Completed
Limited Data
Verification Pending
Verified Metadata
Checks Passed
Issues Detected
Verification Expired

Only expose statuses that are backed by a documented verification process.

19.3 Rules
A scan completion status must not be called a security audit.
Verification must have explicit criteria.
Display the verification date and methodology.
Expire or refresh stale results.
Link to the supporting report.
Do not issue a green trust badge solely because no issues were detected.
Do not imply endorsement by VibeVibe unless an authorized official integration actually exists.
20. VIBEVIBE ECOSYSTEM RISK DASHBOARD
20.1 Purpose

Provide a public overview of the indexed ecosystem's observable activity and risk signals.

20.2 Metrics

Only display metrics supported by real, indexed data:

Discovered token count.
Recently active tokens.
Scans completed.
Risk distribution.
Recent high-severity findings.
Significant wallet activity.
Holder concentration indicators.
Activity trends.
Indexer health and data freshness.

Do not show TVL, market capitalization, volume or liquidity unless the source and calculation are reliable.

20.3 Filters
Time range.
Token.
Risk level.
Activity type.
Address.
Data availability.
20.4 Dashboard Behavior
Use server-side pagination for large result sets.
Show data freshness.
Provide empty states for a new testnet.
Avoid fabricated sample data in production.
Label demonstration data clearly in development.
21. DEVELOPER / API
21.1 Purpose

Provide a stable interface for external developers to retrieve VibeGuard intelligence.

21.2 Suggested Endpoints
GET /api/v1/health
GET /api/v1/network
GET /api/v1/tokens/{address}
GET /api/v1/tokens/{address}/risk
GET /api/v1/tokens/{address}/holders
GET /api/v1/tokens/{address}/creator
GET /api/v1/tokens/{address}/activity
GET /api/v1/wallets/{address}
GET /api/v1/wallets/{address}/relationships
GET /api/v1/whales
GET /api/v1/momentum
GET /api/v1/findings
POST /api/v1/scans
GET /api/v1/scans/{scanId}

These are proposed contracts. Adjust the exact route shape to the implementation, but document all final endpoints.

21.3 API Requirements
Versioned API.
Validated inputs.
Stable JSON response schemas.
Consistent error format.
Rate limiting.
Pagination.
Timeouts.
Request IDs.
Cache policy.
Data freshness fields.
OpenAPI specification.
Copyable request examples.
Example responses clearly labelled as examples.
API keys for higher quotas or optional premium access, if implemented.

Public read-only endpoints may be available without an API key under strict limits.

Never expose database credentials, provider secrets or internal service tokens.

22. DATA ARCHITECTURE AND DATABASE

Use PostgreSQL for durable records.

Suggested tables:

22.1 Network and Indexing
networks
indexed_blocks
indexed_logs
indexer_checkpoints
indexer_errors
22.2 Tokens and Wallets
tokens
wallets
token_holders
token_transfers
contracts
contract_permissions
liquidity_pools, if supported
wallet_relationships
22.3 Risk Analysis
scans
risk_scores
risk_findings
risk_rules
methodology_versions
evidence_records
22.4 Monitoring
alert_subscriptions
processed_events
notification_deliveries
22.5 Developer API
api_clients
api_keys_hashes
api_usage_records
22.6 Requirements
Use database migrations.
Add appropriate indexes.
Use unique constraints for chain-specific identifiers.
Handle duplicate events safely.
Store large integers without unsafe floating-point conversion.
Store timestamps consistently.
Keep RPC-specific raw payloads only when justified.
Define data retention policies.
Never store private keys or wallet recovery phrases.
Hash API keys at rest.
Avoid storing unnecessary personal data.
Include chain ID/network identity in chain-specific records.
Handle reorgs and orphaned logs.

The schema may evolve after chain discovery. Document final schema decisions in docs/DATA_MODEL.md.

23. BLOCKCHAIN INDEXER
23.1 Responsibilities
Discover supported tokens.
Track new blocks.
Retrieve relevant logs.
Decode supported events.
Index token transfers.
Maintain holder balances where possible.
Identify deployments and creator transactions.
Detect large transfers.
Store checkpoints.
Recover after restarts.
Reprocess data when decoding rules change.
23.2 Reliability Requirements
Idempotent processing.
Retry logic with bounded backoff.
Rate-limit handling.
Checkpoint recovery.
Duplicate event prevention.
Reorg handling.
Data validation.
Indexer health metrics.
Backfill support.
Configurable starting block.

Do not assume that the entire testnet history can be retrieved cheaply in one request.

23.3 Token Discovery

Use the most reliable available source:

Official token/factory registry, if verified.
Verified deployment events.
Indexed token creation transactions.
Explicit user-provided contract addresses.

Clearly distinguish verified discovery from inferred token classification.

24. DATA FRESHNESS AND SOURCE TRANSPARENCY

Every important result should communicate:

Network.
Data source category.
Latest indexed block.
Analysis block.
Last updated time.
Data coverage.
Missing data.
Whether the result is provisional.
Methodology version.

When a provider is down:

Preserve previously verified results where appropriate.
Mark them as stale.
Do not present stale data as real-time.
Retry safely.
Show an understandable message.
25. UI/UX AND DESIGN SYSTEM
25.1 Visual Direction

Create a polished, technical, trustworthy Web3 security product.

Suggested direction:

Dark-first interface.
Neutral dark backgrounds.
High-contrast typography.
restrained electric green, cyan or violet accents.
Clear risk severity colors.
Subtle borders and surface elevation.
Carefully designed charts.
Minimal, purposeful motion.

Avoid excessive glow, generic AI gradients, decorative charts and unnecessary animation.

25.2 Usability
Every risk metric has a tooltip or explanation.
Important findings are readable without technical expertise.
Advanced evidence remains available for researchers.
Address values are copyable.
External links are labelled.
Loading, empty, partial and failure states are designed.
Tables work on mobile.
Keyboard navigation is supported.
Color is never the only way to communicate severity.
Respect reduced-motion preferences.
Provide accessible contrast.
25.3 Address Display

Show abbreviated addresses in compact layouts but provide:

Full address on demand.
Copy action.
Correct explorer link.
Clear indication of token contract versus wallet address.

Never assume that every address belongs to an externally owned wallet.

26. SECURITY REQUIREMENTS

Treat the application as a public internet service.

26.1 Input Security
Validate every API input.
Enforce address format and length.
Restrict accepted source files and payload sizes.
Protect against oversized queries.
Prevent unsafe dynamic SQL.
Escape user-provided text.
Avoid rendering untrusted metadata as executable HTML.
26.2 API Security
Rate-limit expensive scans.
Limit concurrency.
Add timeouts.
Apply request size limits.
Restrict cross-origin access to intended origins.
Validate notification subscriptions.
Protect against abuse of report-generation endpoints.
Avoid leaking stack traces in public responses.
26.3 Secret Management
Store secrets in server-side environment variables.
Never commit .env files containing credentials.
Provide .env.example with placeholder values only.
Never expose secret keys through NEXT_PUBLIC_*.
Rotate compromised keys.
Keep production and development credentials separate.
26.4 AI Security
Treat token metadata and source code as untrusted.
Defend against prompt injection.
Use structured input and output schemas.
Never let AI decide to execute arbitrary code or transactions.
Never send secrets to the model.
26.5 Infrastructure
Use HTTPS in production.
Keep dependencies updated deliberately.
Run dependency and secret scanning in CI.
Protect database access.
Restrict worker permissions.
Add request and error monitoring.
Provide secure error messages.
Keep sensitive information out of logs.
27. PRIVACY AND LEGAL

Create public privacy, terms and disclaimer pages.

Explain:

Which public blockchain data is processed.
Which optional notification data is collected.
Whether third-party AI services process report inputs.
Data retention practices.
The limitations of automated security checks.
That VibeGuard does not guarantee token safety or investment returns.
That testnet results do not establish mainnet security.

Do not claim legal compliance certifications without verification.

28. TESTING STRATEGY

Testing is mandatory, not optional.

28.1 Unit Tests

Test:

Address validation.
Score calculation.
Missing-data behavior.
Holder concentration.
Transfer calculations.
Risk rule evaluation.
Severity mapping.
Event deduplication.
API input schemas.
AI report schema validation.
28.2 Integration Tests

Test:

RPC connectivity.
Contract data retrieval.
Event decoding.
Database writes.
Indexer checkpoint recovery.
Scan job lifecycle.
API response contracts.
Rate limiting.
Provider failure handling.

Use deterministic fixtures for tests. Fixtures must be clearly separated from live production data.

28.3 End-to-End Tests

Test:

Landing page loads.
Token search accepts valid input.
Invalid addresses produce helpful errors.
Supported token scans return a report.
Unsupported contracts show a clear status.
Wallet reports load.
Charts handle empty data.
Alerts request permission correctly.
API documentation examples are consistent.
Mobile navigation works.
Shareable report routes load directly.
28.4 Security Tests

Test:

Oversized inputs.
Malformed addresses.
Rate-limit enforcement.
Untrusted metadata rendering.
Secret leakage in built assets.
Unauthorized mutation attempts.
Invalid API keys.
Webhook or notification abuse.
Database query safety.
28.5 Quality Gates

Do not declare a phase complete until:

TypeScript passes.
Lint passes.
Tests pass.
Production build succeeds.
No critical known errors remain.
Required documentation is updated.
29. ERROR HANDLING

Use consistent, typed error responses.

Suggested public error codes:

INVALID_ADDRESS
UNSUPPORTED_NETWORK
UNSUPPORTED_CONTRACT
DATA_UNAVAILABLE
INSUFFICIENT_DATA
RATE_LIMITED
SCAN_IN_PROGRESS
SCAN_FAILED
PROVIDER_UNAVAILABLE
INTERNAL_ERROR

Public responses should contain:

Stable error code.
Human-readable message.
Request ID where useful.
Retry guidance where appropriate.

Do not expose credentials, internal file paths, SQL details or stack traces.

30. PERFORMANCE REQUIREMENTS

Set measurable budgets and validate them with real builds.

Initial targets:

Fast initial page rendering.
No unnecessary client-side JavaScript.
Pagination for large datasets.
Cached public reads where safe.
Bounded scan concurrency.
Timeouts for external calls.
No synchronous full-history scan on every page load.
Background jobs for heavy analysis.
Responsive interface during slow scans.

Aim for good Core Web Vitals and investigate regressions before release.

Do not trade data correctness for an arbitrary speed target.

31. OBSERVABILITY AND OPERATIONS

Implement:

Structured logs.
Request IDs.
Error monitoring.
RPC health checks.
Database health checks.
Indexer lag monitoring.
Worker failure monitoring.
Queue depth monitoring, if applicable.
API latency and error rates.
External provider failure metrics.
Public status reporting where useful.

Never include API secrets, private credentials or unnecessary personal data in logs.

Create a runbook describing how to:

Restart a failed worker.
Resume an indexer.
Recover from a provider outage.
Run migrations.
Rotate API credentials.
Diagnose stale data.
Roll back a deployment.
32. REPOSITORY STRUCTURE

Use a maintainable structure similar to:

vibeguard/
├── docs/
│   ├── MASTER_SRS.md
│   ├── CHAIN_DISCOVERY.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── RISK_METHODOLOGY.md
│   ├── API.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   └── RUNBOOK.md
├── public/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── scan/
│   │   ├── token/
│   │   ├── wallet/
│   │   ├── creator/
│   │   ├── sybil/
│   │   ├── whales/
│   │   ├── momentum/
│   │   ├── alerts/
│   │   ├── doctor/
│   │   ├── ecosystem/
│   │   ├── developers/
│   │   └── api/
│   ├── components/
│   ├── lib/
│   │   ├── chain/
│   │   ├── database/
│   │   ├── risk-engine/
│   │   ├── indexing/
│   │   ├── cache/
│   │   ├── notifications/
│   │   ├── ai/
│   │   ├── validation/
│   │   └── monitoring/
│   ├── server/
│   └── types/
├── worker/
├── drizzle/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .github/
│   └── workflows/
├── .env.example
├── README.md
└── package.json

Adapt the structure to the selected framework and deployment model. Do not create empty directories or unnecessary abstractions merely to match this example.

33. ENVIRONMENT CONFIGURATION

Create a documented .env.example using placeholders only.

Potential variables:

APP_URL=
APP_ENV=

VIBEVIBE_NETWORK_NAME=
VIBEVIBE_CHAIN_ID=
VIBEVIBE_RPC_HTTP_URL=
VIBEVIBE_RPC_WS_URL=
VIBEVIBE_EXPLORER_URL=

DATABASE_URL=
REDIS_URL=

AI_PROVIDER=
AI_API_KEY=

SECURITY_PROVIDER_API_KEY=

WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=

RATE_LIMIT_SECRET=

Add other variables only when needed.

Never commit real values. Keep browser-exposed and server-only configuration separate.

The application must start in a documented development mode without requiring every optional third-party service. Missing integrations should be reported clearly.

34. IMPLEMENTATION PHASES

Claude Code must execute the project in phases. Do not try to implement every feature in one enormous unverified code generation step.

Phase 0 — Repository and Chain Discovery

Tasks:

Inspect the repository.
Identify existing code and preserve useful work.
Verify VibeVibe network configuration.
Verify RPC and explorer capabilities.
Identify supported token standards and available data.
Document unknowns and limitations.
Create MASTER_SRS.md and CHAIN_DISCOVERY.md.
Select compatible dependencies.

Deliverables:

Discovery documentation.
Architecture decision record.
Implementation plan.
No fabricated network values.

Exit criteria:

Network assumptions are verified or explicitly marked unresolved.
The implementation path is clear.
Phase 1 — Foundation and Design System

Tasks:

Initialize or repair Next.js project.
Configure TypeScript, linting and testing.
Build the design system.
Create responsive navigation and footer.
Implement landing page and public routes.
Build loading, error, empty and unavailable states.
Add metadata and accessibility basics.

Deliverables:

Professional, responsive public interface.
Working navigation.
No user dashboard, login or admin panel.

Exit criteria:

Production build succeeds.
Core pages render.
No dead buttons or placeholder navigation.
Phase 2 — Blockchain Adapter and Indexer

Tasks:

Implement chain client.
Validate network connectivity.
Read blocks and contract data.
Decode supported logs.
Build token discovery.
Create database schema and migrations.
Implement checkpoints, retries and deduplication.
Add data freshness indicators.

Deliverables:

Verified on-chain data pipeline.
Persistent indexer state.
Documented supported data.

Exit criteria:

Integration tests prove the pipeline works against the verified testnet or a clearly identified test environment.
Provider failures are handled safely.
Phase 3 — Core Scanner and Risk Engine

Tasks:

Implement contract analysis.
Implement risk rules.
Implement score calculation.
Add data coverage.
Build scan persistence and status handling.
Implement token report page.
Add methodology documentation.

Deliverables:

Functional token scanner.
Evidence-backed risk report.
Deterministic, tested score.

Exit criteria:

Scores can be reproduced.
Missing data does not appear safe by default.
Findings link to supporting evidence.
Phase 4 — Holder Analysis and Creator Reputation

Tasks:

Index token transfers.
Calculate balances.
Calculate concentration metrics.
Identify deployer where possible.
Analyze creator wallet activity.
Add visualizations and evidence tables.

Deliverables:

Holder report.
Creator report.
Wallet classification and data coverage.

Exit criteria:

Balance calculations are tested.
Special addresses are handled transparently.
Unsupported information is marked unavailable.
Phase 5 — Wallet DNA and Sybil Detection

Tasks:

Build wallet activity summaries.
Build relationship graph model.
Implement shared-funding heuristics.
Implement time and behavior correlation.
Add confidence and evidence records.
Build wallet report and relationship visualization.

Deliverables:

Wallet DNA.
Coordinated-wallet investigation.

Exit criteria:

Heuristics have unit tests.
Relationship claims are qualified.
No unsupported identity claims.
Phase 6 — Whale, Momentum and Suspicious Activity

Tasks:

Add event monitoring.
Build configurable thresholds.
Implement suspicious-activity rules.
Calculate market metrics only from verified data.
Build activity charts and event timelines.

Deliverables:

Whale tracker.
Momentum page.
Suspicious activity feed.

Exit criteria:

Events are deduplicated.
Data source and time window are visible.
No fabricated market metrics.
Phase 7 — Alerts and AI Reports

Tasks:

Implement browser notifications.
Add optional backend subscription delivery if configured.
Implement alert deduplication and retry.
Build AI report adapter.
Validate generated reports.
Add deterministic fallback reports.

Deliverables:

Functional alerts.
Evidence-grounded AI report.

Exit criteria:

Core functionality remains available without an AI key.
AI output cannot invent facts.
Notification failures are visible and recoverable.
Phase 8 — Token Doctor, Trust Status and Ecosystem

Tasks:

Implement pre-deployment analysis where feasible.
Implement existing-contract checks.
Create documented verification statuses.
Build ecosystem aggregation.
Add filters and pagination.
Add methodology and disclaimer pages.

Deliverables:

Token Doctor.
Trust status.
Ecosystem risk dashboard.

Exit criteria:

Status labels reflect actual verification.
Aggregate metrics come from real data.
New-testnet empty states work correctly.
Phase 9 — Developer API

Tasks:

Finalize endpoint schemas.
Add versioning and validation.
Implement rate limits.
Add API usage tracking if needed.
Generate OpenAPI documentation.
Add request and response examples.
Test all documented endpoints.

Deliverables:

Versioned API.
Developer documentation.

Exit criteria:

Documentation matches the actual implementation.
Public API cannot expose secrets or unrestricted expensive scans.
Phase 10 — Security, QA and Deployment

Tasks:

Run all unit and integration tests.
Run end-to-end tests.
Review security-sensitive code.
Check dependency vulnerabilities.
Verify environment configuration.
Configure GitHub CI.
Deploy to Vercel and required worker infrastructure.
Configure database migrations.
Verify production health checks.
Run smoke tests against the deployed site.

Deliverables:

Deployable product.
CI workflow.
Deployment guide.
Operational runbook.
Verified public deployment.

Exit criteria:

Production build and tests pass.
Secrets are not exposed.
Core routes work.
Chain integration is functional.
Known limitations are documented.
No critical known issues remain.
35. CLAUDE CODE EXECUTION RULES

These rules are mandatory.

Read this entire SRS before making implementation decisions.
Inspect the existing repository before modifying files.
Do not replace working code without understanding its purpose.
Work on one phase at a time.
Before each phase, summarize the intended changes and dependencies.
Implement the phase, then run the relevant tests and production build.
Fix errors before moving to the next phase.
Keep documentation updated.
Do not leave core functionality as a TODO or fake implementation.
Do not use hardcoded fake blockchain data in production paths.
Do not invent chain IDs, RPC URLs, contract addresses or external API capabilities.
Use environment variables for configuration.
Do not commit secrets.
Do not create a user dashboard, login page or admin panel.
Keep core public functionality usable without an account.
Do not claim a feature is complete merely because its UI exists.
Clearly distinguish a functional feature from a partial integration.
If a provider or network capability is unavailable, document the limitation and implement the best honest fallback.
Avoid unnecessary dependencies and excessive abstractions.
Do not perform a major refactor unrelated to the current phase without justification.
Use strict TypeScript and shared schemas.
Test important calculations with deterministic fixtures.
Do not run destructive database operations without explicit safeguards.
Do not silently weaken security controls to make a test pass.
Never report success without checking the actual result.

After each phase, report:

What was implemented.
Files created or modified.
Tests and commands run.
Test/build results.
Required environment variables.
Remaining limitations.
Exact next phase.

Maintain a docs/IMPLEMENTATION_STATUS.md checklist and update it after every phase.

36. MASTER PROMPT FOR CLAUDE CODE

You are the lead software architect and implementation engineer responsible for building VibeGuard according to docs/MASTER_SRS.md.

Your goal is to deliver a professional, maintainable, security-conscious Web3 token intelligence platform for the VibeVibe ecosystem.

First inspect the repository and read the full SRS. If the SRS has not yet been saved, use the complete product blueprint supplied by the project owner as the source of truth and save it as docs/MASTER_SRS.md.

Do not attempt to build the entire product in one unverified step.

Begin with Phase 0:

Inspect the repository and existing application.
Verify the VibeVibe network configuration, RPC capabilities, explorer and supported token standards.
Identify all missing information and document it.
Choose a compatible architecture and dependencies.
Create the implementation plan and phase checklist.
Do not invent unavailable technical details.

Then execute the phases in order.

For every phase:

Implement working functionality.
Run appropriate tests.
Run lint and TypeScript checks.
Run a production build when applicable.
Fix failures before continuing.
Update the documentation and implementation checklist.
Report exact completion status.

Preserve these non-negotiable constraints:

No login or registration.
No user dashboard.
No public admin panel.
Core scanning must not require an account.
No fabricated blockchain data.
No unsupported claims about security, identity or verification.
No secrets exposed to the browser.
No untested assertion that the product is production-ready.

Prioritize the smallest complete end-to-end slice that proves real data can flow from the VibeVibe network through the indexer and risk engine into a working public report. Build additional features on that foundation.

If a feature depends on unavailable testnet data or unsupported external APIs, do not fake the result. Implement an honest partial state, document the limitation and continue with independent features.

Do not stop after writing a plan. Start implementing the current phase, verify the result, and proceed to the next phase only after its exit criteria are met.

37. DEFINITION OF DONE

VibeGuard is ready for an initial public testnet release only when all applicable conditions are met.

Product
Landing page and public navigation work.
No login or admin panel exists.
Token scanning works with verified network data.
Reports show evidence, score methodology and data coverage.
Wallet and holder analysis work for supported contracts.
Unsupported data is clearly identified.
All important UI states are implemented.
Public documentation and disclaimers are available.
Engineering
TypeScript checks pass.
Lint passes.
Unit tests pass.
Integration tests pass for supported capabilities.
Production build succeeds.
Database migrations are reproducible.
Indexer can resume after interruption.
Expensive operations are bounded.
Errors are handled consistently.
Security
Secrets are server-side.
Input validation is enforced.
Public endpoints are rate-limited appropriately.
Untrusted metadata is handled safely.
AI output is validated.
No private keys are stored.
No critical known security issue remains unresolved.
Operations
GitHub repository is organized.
CI checks run.
Vercel deployment works.
Persistent workers run on suitable infrastructure where required.
Database and environment variables are configured.
Health checks and logs are available.
Deployment and recovery procedures are documented.
Smoke tests pass on the deployed application.
Product Honesty
No fake live metrics.
No fabricated token scans.
No unsupported trust claims.
No claim of a completed security audit when only automated checks ran.
No claim of mainnet readiness based solely on testnet testing.
38. FINAL PRODUCT POSITIONING

VibeGuard should be positioned as:

The On-Chain Risk Intelligence Layer for the VibeVibe Ecosystem.

It helps traders investigate tokens, helps creators understand contract risks, and helps communities examine wallet behavior and ecosystem activity through transparent, evidence-backed analysis.

The product must prioritize trust, data quality and usable intelligence over simply displaying a large number of features.

The first release should establish a reliable chain-data foundation and a fully working token risk report. The remaining features should build on the same shared indexing, evidence, scoring and monitoring infrastructure.

Final principle: Build fast, but never fake functionality. A smaller, genuinely working security tool is more valuable than a large dashboard filled with unsupported claims.

Claude Code-এ কীভাবে ব্যবহার করবে

উপরের সম্পূর্ণ document কপি করে project-এর root-এ docs/MASTER_SRS.md নামে save করো।

Claude Code-কে Master Prompt for Claude Code অংশটি দাও।

প্রথমে Phase 0 এবং Phase 1 শেষ করাও। এরপর প্রতিটি phase-এর tests ও build result যাচাই করে পরের phase-এ যেতে বলো।

GitHub-এ code push করো। Next.js application Vercel-এ deploy করো; indexer ও persistent worker থাকলে সেগুলো উপযুক্ত আলাদা hosting-এ চালাও।

Testnet-এ বাস্তব token ও wallet দিয়ে smoke test করার পরেই project-টি X/Twitter-এ share করো।

সবচেয়ে গুরুত্বপূর্ণ সিদ্ধান্ত: VibeGuard-এর প্রথম working milestone হবে—একটি বাস্তব VibeVibe token address দিলে সেটির contract ও উপলভ্য on-chain data সংগ্রহ করে, evidence-সহ একটি সঠিক risk report দেখানো। এই ভিত্তি ঠিক থাকলে বাকি ফিচারগুলো দ্রুত ও নির্ভরযোগ্যভাবে তৈরি করা অনেক সহজ হবে।