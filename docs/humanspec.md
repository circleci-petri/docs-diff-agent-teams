# HumanSpec v1 — docs-screenshot-diff

> **Version**: v1 — 2026-02-07
> **Format**: Guava Spec (7 sections)
> **Parent**: [CIR-481](https://linear.app/circleci/issue/CIR-481/variant-b-docs-ss-diff-project)
> **Ticket**: [CIR-482](https://linear.app/circleci/issue/CIR-482/variant-b-phase-0-humanspec-engineer-readable-specification)
> **Repo**: `docs-diff-agent-teams` (agent teams experiment — not the PRD's `circleci-petri/docs-screenshot-diff`)

---

## 1. Problem & Goal

**Who**: Rosie and the Docs team — documentation screenshots go stale when the product UI changes.

**Pain**: Manual checking of every page is time-consuming and error-prone; docs team often doesn't know a change occurred.

**Target site**: `circleci.com/docs/` (public — **no authentication needed for v1**).

**Success**: Docs team can run a CLI command, get a markdown report showing which pages changed visually, and know exactly which screenshots need updating.

**Hypothesis**: Automating visual diff detection reduces docs screenshot staleness from "discovered randomly" to "detected within one CI run."

**Note**: This is CircleCI's **first visual regression tool** — no Percy, Chromatic, Applitools, or custom pixelmatch solutions exist internally. No `screenshots/` or `visual-baseline/` directories in any existing repo.

### BDD User Scenarios

**Scenario 1: Capture Baseline**
- As a docs team member, I want to capture baseline screenshots of circleci.com/docs/ pages so I have a reference for future comparisons
- **Given** a config.json with pages listed, **When** I run `capture`, **Then** PNG screenshots are saved to `screenshots/baseline/{name}.png`

**Scenario 2: Detect Visual Changes**
- As a docs team member, I want to compare the current state of product pages against my baselines so I know which docs screenshots are stale
- **Given** baselines exist, **When** I run `compare`, **Then** changed pages (>5% diff) generate diff images and appear in a markdown report

**Scenario 3: Review Diff Report**
- As a docs team member, I want a clear markdown report so I can prioritize which screenshots to update
- **Given** comparison is complete, **When** I open report.md, **Then** I see summary counts, changed pages with diff %, and embedded diff images

**Scenario 4: Missing Baseline Handling**
- As a docs team member, I want graceful handling when baselines don't exist so the tool doesn't crash
- **Given** a page has no baseline, **When** I run `compare`, **Then** it's listed as "missing baseline" in the report and comparison is skipped

**Scenario 5: Authentication (Phase 3 — deferred)**
- As a docs team member, I want to authenticate against protected product pages so I can screenshot logged-in UI
- **Deferred for v1** — target site is public `circleci.com/docs/`

---

## 2. Definition of Done

### Automated Checks (must all pass before merge)

```bash
pnpm test        # vitest
pnpm lint        # oxlint (CircleCI migrated from ESLint Oct 2025)
pnpm typecheck   # tsc --noEmit, TypeScript 5.x strict
pnpm format      # oxc formatter
```

### CI Pipeline Checks (CI-first — from CIR-484)

The CircleCI pipeline must be **GREEN** before any work is considered complete. Pipeline runs:
1. `pnpm typecheck` — Type check
2. `pnpm lint` — Lint
3. `pnpm build` — Build
4. `pnpm test:ci` — Test

### Manual Validation

- [ ] `docs-screenshot-diff capture --config ./config.json` captures screenshots of live `circleci.com/docs/` pages
- [ ] `docs-screenshot-diff compare --config ./config.json` generates accurate diff detection + markdown report
- [ ] Diff images visually highlight what changed
- [ ] Tool runs reliably on macOS (primary), Linux, Windows
- [ ] Demo-ready for internal leadership presentation

### PRD Success Criteria (all 6)

1. User can capture baseline screenshots of product pages
2. User can run comparison and get accurate diff detection
3. Changed pages clearly identified in markdown report
4. Diff images visually highlight changes
5. Authentication works for protected websites (Phase 3 — deferred)
6. Runs reliably on macOS, Linux, Windows

### E2E Acceptance Scenarios (from CIR-490)

| # | Scenario | Tracks Involved | Verification |
|---|----------|-----------------|--------------|
| 1 | Happy path: capture -> compare -> report | A, B, C, D | Report shows correct counts |
| 2 | Missing baseline handled | C, D | Report lists missing pages |
| 3 | Page load failure handled | B, D | Failed page logged, others continue |
| 4 | Invalid config rejected | A | Clear error message, no crash |
| 5 | Custom config path works | A, B | `--config ./custom.json` works |
| 6 | Custom output path works | D | `--output ./custom-report` works |

### Test Coverage (from CIR-483)

28 test cases enumerated (T001-T028) across 5 categories:
- **Config Parsing** (T001-T007): Valid config, missing file, invalid JSON, ENV resolution, defaults
- **Screenshot Capture** (T008-T012): Viewport, sequencing, path sanitization, error handling, wait delay
- **Image Comparison** (T013-T018): Identical/changed images, threshold logic, missing baseline, diff generation
- **Report Generation** (T019-T023): Summary counts, changed pages, missing baselines, unchanged pages, image paths
- **CLI Commands** (T024-T028): Capture/compare commands, config/output flags, progress output

---

## 3. Technical Context

### Stack

| Component | Choice |
|-----------|--------|
| Runtime | Node.js 18+ |
| Language | TypeScript (strict mode) |
| Browser Automation | Playwright |
| Image Comparison | pixelmatch + pngjs |
| CLI Framework | Commander.js |
| Package Manager | pnpm |

### Tooling (CircleCI standard as of 2025-2026)

| Tool | Purpose |
|------|---------|
| oxlint | Linter (migrated from ESLint Oct 2025) |
| oxc formatter | Code formatter |
| vitest | Test runner (unit + integration) |
| CI enforcement | Preferred over local hooks — no pre-commit hooks |

### CI Pipeline Structure (from CIR-484)

```
typecheck -> lint -> build -> test
```

Pipeline created **BEFORE** feature code (CI-first development). All tracks validated by CI from iteration 1.

### Golden Reference Files

| File/Repo | Why |
|-----------|-----|
| `web-ui-consolidated/tests/playwright/auth-setup.ts` | Production Playwright auth patterns, session persistence, test account management |
| `web-ui-consolidated/tests/playwright/` | E2E test structure, feature-area organization |
| `web-ui-consolidated/tsconfig.json` | TypeScript config standard |
| `web-ui-consolidated/pnpm-workspace.yaml` | pnpm workspace patterns |
| `github.com/circleci-petri/yahualli-ci` | Simple TypeScript CLI structure reference |
| `github.com/joel-thompson/ralph-test` | Basic TypeScript CLI for math ops — starter template |

### Key Interfaces (from PRD)

```typescript
interface Config {
  baseUrl: string;
  auth?: {
    loginUrl: string;
    email: string;
    password: string; // supports "ENV:VAR_NAME"
    selectors?: { email?: string; password?: string; submit?: string; };
  };
  pages: Array<{ path: string; name: string; }>;
  viewport?: { width: number; height: number; }; // default: 1440x900
  waitDelay?: number;      // default: 2000
  diffThreshold?: number;  // default: 0.05
  maskRegions?: Array<{ selector: string } | { x: number; y: number; width: number; height: number; }>;
}

interface ComparisonResult {
  page: string;
  path: string;
  baselineExists: boolean;
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  changed: boolean;
  baselinePath: string;
  currentPath: string;
  diffPath: string | null;
}

interface Reporter {
  name: string;
  generate(results: ComparisonResult[], outputDir: string): Promise<void>;
}
```

### External Docs

- PRD commit: https://github.com/circleci-petri/docs-screenshot-diff/commit/72ac9d4ff11224cf98746278855ad9932fc8c84b
- Playwright auth re-authorization: https://circleci.atlassian.net/wiki/spaces/PES/pages/7891976217/How+to+re-authorize+the+playwright+test+account

---

## 4. Code Standards

### Persona

> Act as a pragmatic engineer who prioritizes shipping a working demo quickly. Embrace "janky but functional" over "perfect but incomplete." CI is your quality gate, not local tooling. This is a learning vehicle for AI-assisted SDLC — the process matters as much as the output.

### Engineering Culture

- **Ship-and-iterate is the norm** for internal tools at CircleCI
- RalphCI experiment showed: "agents write more modular code when CI is watching" — agent behavior fundamentally changes with CI feedback loops
- Ryan Hamilton: "The real value isn't speed — it's confidence when you ship"
- No formal AI-generated code review requirements (yet) — expectation is AI code must pass CI before merge
- Acceptable to be "janky" initially if it proves the concept (Fabio's guayaba philosophy: "accept waste as the cost of invention")

### Golden References

Follow `yahualli-ci` for CLI structure, `web-ui-consolidated` for Playwright patterns.

### Anti-Patterns to Avoid

- Bundle/dependency bloat — check tree-shaking works (`web-ui-consolidated` had `react-simple-icons` bloat)
- Barrel exports that break tree-shaking
- Adding to deprecated systems without review (GraphQL migration debt)
- Pre-commit hooks of any kind
- Secrets anywhere in git (zero-tolerance — Jan 2026 incident required token revocation + history rewriting)
- Over-abstraction or too many indirection layers
- Config sprawl — keep it to one `config.json`

---

## 5. Boundaries

| Type | Rule |
|------|------|
| **Always** | Use pnpm (not npm/yarn). Use oxlint. Use TypeScript strict. Enforce in CI. Gitignore `screenshots/current/` and `screenshots/diff/`. Commit `screenshots/baseline/` |
| **Always** | Support `ENV:VAR_NAME` syntax for secrets in config (never hardcode) |
| **Always** | CI pipeline must be GREEN before implementing new features (CI-first — CIR-484) |
| **Always** | Fix CI failures within 30 minutes — treat as P0 (CIR-484) |
| **Always** | Run `pnpm ci:check` locally before pushing (typecheck -> lint -> build -> test) |
| **Ask First** | Adding dependencies not in PRD (Commander.js, Playwright, pixelmatch, pngjs are approved) |
| **Ask First** | NPM publishing — requires granular access tokens with 90-day rotation, restricted to machine users + CI |
| **Ask First** | Adding paid APIs or third-party SaaS integrations (triggers security review) |
| **Ask First** | Creating CircleCI contexts for secrets (requires team permissions) |
| **Ask First** | Deviating from PRD implementation phase order |
| **Never** | Commit secrets to git (absolute prohibition) |
| **Never** | Use pre-commit hooks (CircleCI policy — "attack vector", bypassed with --no-verify) |
| **Never** | Include GPL-only dependencies (Wiz scans flag; multi-license OK if permissive option exists) |
| **Never** | Store credentials in code — use 1Password shared vault (Engagement team pattern) |
| **Never** | Implement new features while CI is RED (CIR-484) |
| **Never** | Ship with known failing tests or lint errors |

---

## 6. Implementation Plan

**Scoping note**: v1 targets **public** `circleci.com/docs/` — no auth required. Auth (Phase 3/Track E) is explicitly deferred. Mask regions are stubbed per PRD.

**Repo**: `docs-diff-agent-teams` — this is an experiment to test agent teams, separate from the PRD's `circleci-petri/docs-screenshot-diff`.

### Track Decomposition (from CIR-483)

| Track | Focus | Complexity | Model | Est. Hours | Dependencies |
|-------|-------|-----------|-------|-----------|--------------|
| Foundation | Project scaffold, TypeScript, pnpm, CLI setup, **CI pipeline** | Simple | Sonnet | 2-3h | None |
| Track A | Config parsing + validation | Simple | Sonnet | 2-3h | Foundation |
| Track B | Playwright screenshot capture + `capture` CLI | Medium | Sonnet | 4-6h | Foundation |
| Track C | pixelmatch comparison + diff generation | Medium | Sonnet | 4-6h | Foundation |
| Track D | Markdown report generation + `compare` CLI | Simple | Sonnet | 3-4h | Track B, C |
| Track E | Auth flow + `auth-check` (**deferred for v1**) | Complex | Opus | 6-8h | Track B |
| Integration | E2E wiring, error handling, README, demo prep | Medium | Sonnet | 4-6h | All tracks (except E) |

### Dependency Graph & Parallelization

```
Foundation (F.0-F.11)
    |
    +---> Track A (Config)  ----+
    |                           |
    +---> Track B (Capture) ----+---> Track D (Report + compare CLI)
    |                           |
    +---> Track C (Compare) ----+
                                |
                                +---> Integration (E2E, polish, demo)

Track E (Auth) — DEFERRED for v1
```

**Parallelization opportunities**:
- Track A, Track B, and Track C can run **in parallel** after Foundation completes
- Track D depends on B and C completing
- Integration depends on all active tracks (A, B, C, D)

### CI-First Development Workflow (from CIR-484)

1. **Foundation creates the CI pipeline FIRST** (`.circleci/config.yml`) before any feature code
2. **Before starting any track**: Check CI status. If RED, fix before implementing new features
3. **After completing each task**: Run `pnpm ci:check` locally, push, verify pipeline is GREEN
4. **CI failure = P0**: Fix within 30 minutes, never implement while RED

### Phase 1: Core Functionality (Foundation + Track A + Track B)

**Foundation** (CIR-484):
- [ ] `.circleci/config.yml` — CI pipeline (DO THIS FIRST)
- [ ] pnpm init, TypeScript strict, oxlint, oxc formatter
- [ ] Commander.js CLI scaffold (capture, compare, auth-check stubs)
- [ ] Directory structure per PRD
- [ ] Example `config.json` targeting `circleci.com/docs/`
- **Checkpoint**: `pnpm ci:check` passes, CLI shows `--help`

**Track A** — Config Parsing:
- [ ] Config TypeScript interface
- [ ] JSON parser with validation
- [ ] `ENV:VAR_NAME` resolver
- [ ] Default values (viewport 1440x900, diffThreshold 0.05, waitDelay 2000)
- **Checkpoint**: T001-T007 pass

**Track B** — Screenshot Capture:
- [ ] Playwright browser setup (Chromium headless)
- [ ] Screenshot capture function (viewport, wait delay)
- [ ] `capture` CLI command — saves to `screenshots/baseline/{name}.png`
- **Checkpoint**: T008-T012 pass, captures real `circleci.com/docs/` page

### Phase 2: Comparison (Track C -> Track D)

**Track C** — Image Comparison:
- [ ] pixelmatch integration
- [ ] ComparisonResult interface implementation
- [ ] Diff image generation (red/magenta changed pixels, dimmed unchanged)
- [ ] Threshold logic (configurable, default 5%)
- **Checkpoint**: T013-T018 pass

**Track D** — Report Generation:
- [ ] Reporter interface
- [ ] Markdown report template (summary, changed pages, missing baselines, unchanged)
- [ ] `compare` CLI command — captures current, compares, generates report
- [ ] CLI progress output (emoji + counts per PRD format)
- **Checkpoint**: T019-T028 pass, `compare` produces accurate report

### Phase 3: Authentication (Track E — DEFERRED for v1)

- [ ] Playwright auth flow (email/password/submit — configurable selectors)
- [ ] `auth-check` CLI command
- [ ] Session reuse across pages (storageState)
- Note: CircleCI uses 30-day session expiry, test accounts in 1Password

### Phase 4: Integration & Polish (CIR-490)

- [ ] E2E wiring — full capture -> compare -> report flow
- [ ] Error handling per PRD table (page load failure, missing baseline, config errors)
- [ ] maskRegions stub (accept config, log warning)
- [ ] CLI output formatting matching PRD exactly
- [ ] README documentation
- [ ] Demo preparation — tool runs against live `circleci.com/docs/`
- **Checkpoint**: All 6 E2E acceptance scenarios pass, `pnpm ci:check` GREEN

### Demo Pages (from CIR-484 Task F.10)

Three pages defined for demo:
1. `docs-home` — `/`
2. `getting-started` — `/getting-started`
3. `config-reference` — `/configuration-reference`

### Directory Structure (from PRD)

```
project/
├── .circleci/
│   └── config.yml            # CI pipeline (created FIRST)
├── src/
│   ├── index.ts              # CLI entry point (Commander.js)
│   ├── commands/
│   │   ├── capture.ts
│   │   ├── compare.ts
│   │   └── auth-check.ts     # stub
│   ├── core/
│   │   ├── config.ts         # Track A
│   │   ├── screenshot.ts     # Track B
│   │   ├── compare.ts        # Track C
│   │   └── auth.ts           # Track E (deferred)
│   ├── reporters/
│   │   ├── reporter.ts       # Track D
│   │   └── markdown.ts       # Track D
│   └── types/
│       └── index.ts
├── screenshots/
│   ├── baseline/             # committed to git
│   ├── current/              # gitignored
│   └── diff/                 # gitignored
├── report/                   # gitignored
├── config.json
├── tsconfig.json
├── package.json
├── .gitignore
└── README.md
```

---

## 7. Open Questions — RESOLVED

| # | Question | Resolution | Source |
|---|----------|-----------|--------|
| 1 | Should we set up a CircleCI pipeline from the start, or add CI later? | **YES — CI-first approach.** Pipeline created BEFORE feature code. All subsequent work validated by CI from iteration 1. | CIR-484 Task F.0 |
| 2 | Is there a specific set of `circleci.com/docs/` pages to use for the demo? | **Yes — 3 pages defined:** docs-home (`/`), getting-started (`/getting-started`), config-reference (`/configuration-reference`) | CIR-484 Task F.10 |
| 3 | Should the demo show the full flow or just the concept? | **Full flow.** Capture -> compare -> report, demonstrating AI SDLC end-to-end. | CIR-490 Mission |
| 4 | What repo will this live in? | **`docs-diff-agent-teams`** — this is an experiment to test agent teams, not the PRD's `circleci-petri/docs-screenshot-diff`. | User confirmed |
| 5 | Should we track AI-assisted velocity metrics? | **Yes.** This is part of Guayaba evaluation. OpenSpec includes token estimates per track. | CIR-483 context |

---

## Context: Why This Exists

**This is not just a tool delivery.** CIR-481 is part of the **Guayaba AI SDLC** project to evaluate AI-assisted development. The demo is for internal leadership (JP, Mitch, Webster, Rob) to demonstrate:

1. Rapid prototyping with off-the-shelf tools (Claude Code, not custom orchestrators)
2. Tight iteration cycles ("today laptop, tomorrow VM, next day auth")
3. Acceptance of waste as cost of invention

The velocity evaluation measures **"what did we learn about AI-assisted software development"** — not "how fast did we ship."
