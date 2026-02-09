# docs-diff-agent-teams

An experiment testing **Claude Code Agent Teams** to build a real project using the **Guayaba AI SDLC** methodology.

## What is this?

This repo uses coordinated AI agents (Claude Code) to build `docs-screenshot-diff` — a CLI tool that detects visual changes on [circleci.com/docs/](https://circleci.com/docs/) by comparing screenshots against baselines and generating diff reports.

The tool itself is useful (the Docs team needs it), but the primary goal is evaluating **AI-assisted software development at CircleCI** — how agent teams decompose work, parallelize tracks, and ship through CI.

## The Experiment

**Guayaba AI SDLC** structures AI development into phases:

1. **Phase 0 — Specs**: HumanSpec (engineer-readable) + OpenSpec (machine-readable YAML) define the project before any code is written
2. **Phase 1 — Foundation**: CI-first scaffold — pipeline before features
3. **Tracks A-D**: Parallelizable work streams (config, capture, compare, report) assigned to agent sessions
4. **Integration**: E2E wiring, polish, demo prep

Key principles:
- **CI-first**: Pipeline created before feature code. Never implement while RED.
- **Exploration over execution**: Learning about AI-assisted dev matters more than shipping speed
- **Accept waste as cost of invention**: Janky but functional beats perfect but incomplete

## The Tool: docs-screenshot-diff

```bash
# Capture baseline screenshots
docs-screenshot-diff capture --config ./config.json

# Compare current state against baselines, generate report
docs-screenshot-diff compare --config ./config.json --output ./report
```

### Stack

| Component | Choice |
|-----------|--------|
| Runtime | Node.js 18+ |
| Language | TypeScript (strict) |
| Browser | Playwright (Chromium headless) |
| Image Diff | pixelmatch + pngjs |
| CLI | Commander.js |
| Test Runner | vitest |
| Linter | oxlint |
| Formatter | oxc |
| CI | CircleCI |

### Project Structure

```
├── .circleci/config.yml       # CI pipeline (typecheck → lint → build → test)
├── src/
│   ├── index.ts               # CLI entry point
│   ├── commands/               # capture, compare, auth-check
│   ├── core/                   # config, screenshot, compare, auth
│   ├── reporters/              # markdown report generator
│   └── types/                  # Config, ComparisonResult, Reporter
├── docs/
│   ├── humanspec.md            # Engineer-readable spec (Guava format)
│   └── openspec.yaml           # Machine-readable spec (OpenSpec 1.0)
├── screenshots/
│   ├── baseline/               # Committed to git
│   ├── current/                # Gitignored
│   └── diff/                   # Gitignored
└── config.json                 # Example config targeting circleci.com/docs/
```

## Development

```bash
pnpm install
pnpm ci:check          # typecheck → lint → build → test (mirrors CI)
```

## Linear Tickets

| Ticket | Description |
|--------|-------------|
| [CIR-481](https://linear.app/circleci/issue/CIR-481) | Parent project |
| [CIR-482](https://linear.app/circleci/issue/CIR-482) | HumanSpec |
| [CIR-483](https://linear.app/circleci/issue/CIR-483) | OpenSpec |
| [CIR-484](https://linear.app/circleci/issue/CIR-484) | Foundation scaffold |
| [CIR-485](https://linear.app/circleci/issue/CIR-485) | Track A — Config parsing |
| [CIR-486](https://linear.app/circleci/issue/CIR-486) | Track B — Screenshot capture |
| [CIR-487](https://linear.app/circleci/issue/CIR-487) | Track C — Image comparison |
| [CIR-488](https://linear.app/circleci/issue/CIR-488) | Track D — Report generation |
| [CIR-489](https://linear.app/circleci/issue/CIR-489) | Track E — Auth (deferred) |
| [CIR-490](https://linear.app/circleci/issue/CIR-490) | Integration & demo prep |

## Why "Agent Teams"?

This repo tests whether multiple Claude Code sessions can work on independent tracks in parallel — like a real engineering team — with a shared spec, shared CI pipeline, and coordinated handoffs. The OpenSpec YAML routes tasks to the right model (Sonnet for straightforward work, Opus for complex reasoning) and defines explicit dependencies between tracks.
