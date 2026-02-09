# Demo Guide — docs-screenshot-diff

> **Audience**: Internal leadership (JP, Mitch, Webster, Rob)
> **Duration**: ~10 minutes
> **Goal**: Show the full AI SDLC flow — a working tool built by coordinated AI agents

---

## Pre-Demo Setup (do this 5 minutes before)

### 1. Clean slate

```bash
cd /Users/fabioramirez/Projects/shame-box/docs-diff-agent-teams
rm -rf screenshots/baseline screenshots/current screenshots/diff report
pnpm build
```

### 2. Verify CLI works

```bash
node dist/index.js --help
```

Expected:
```
Usage: docs-screenshot-diff [options] [command]

CLI tool to detect visual changes in product website pages

Commands:
  capture [options]     Capture baseline screenshots
  compare [options]     Compare current screenshots against baselines
  auth-check [options]  Verify authentication works
```

### 3. Have these tabs ready
- Terminal (full screen, large font)
- GitHub repo: https://github.com/circleci-petri/docs-diff-agent-teams
- CircleCI dashboard: https://app.circleci.com/projects/gh/circleci-petri/docs-diff-agent-teams
- Linear board with CIR-481 and sub-tickets

---

## Demo Script

### Act 1: "The Problem" (1 min)

**Say**: "The Docs team maintains hundreds of screenshots in our documentation. When the product UI changes, those screenshots go stale — and nobody knows until a customer notices. Today there's no automated way to detect this."

**Say**: "We built a tool to solve this using AI-assisted development — 3 AI agents working in parallel, coordinated through specs and CI."

### Act 2: "The Specs" (1 min)

**Show** the Linear board — CIR-481 with all sub-tickets marked Done.

**Say**: "We started with two specs — a HumanSpec for engineers and an OpenSpec for AI agents. The OpenSpec decomposes the project into parallelizable tracks with dependency graphs."

**Show** `docs/openspec.yaml` briefly — point out the track decomposition and dependency graph:
```bash
head -80 docs/openspec.yaml
```

### Act 3: "Capture Baselines" (2 min)

**Say**: "Let's capture baseline screenshots of three circleci.com/docs pages."

```bash
node dist/index.js capture --config ./config.json
```

**Wait** for it to complete (~10-15 seconds). Expected output:
```
📸 Capturing baseline screenshots...
  [1/3] docs-home ✓
  [2/3] getting-started ✓
  [3/3] config-reference ✓

✓ Captured 3 screenshots
```

**Show** the screenshots were saved:
```bash
ls -la screenshots/baseline/
```

**Optionally open one** to show it's a real screenshot:
```bash
open screenshots/baseline/docs-home.png
```

### Act 4: "Detect Changes" (2 min)

**Say**: "Now let's simulate a visual change. I'll modify one baseline to trigger a diff."

**Option A (best visual impact)**: Simply delete one baseline so the tool detects a "missing baseline", and wait a few seconds before running compare so the live page timestamp changes:
```bash
rm screenshots/baseline/config-reference.png
```
The remaining 2 pages will likely show a small diff from dynamic content (timestamps, ads), and the deleted page shows the missing baseline flow.

**Option B**: Swap a baseline with a solid-color PNG to guarantee a large diff:
```bash
node -e "
const { PNG } = require('pngjs');
const fs = require('fs');
const orig = PNG.sync.read(fs.readFileSync('screenshots/baseline/getting-started.png'));
const png = new PNG({ width: orig.width, height: orig.height });
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 255; png.data[i+1] = 0; png.data[i+2] = 0; png.data[i+3] = 255;
}
fs.writeFileSync('screenshots/baseline/getting-started.png', PNG.sync.write(png));
console.log('Baseline replaced with solid red image');
"
```
This creates a valid PNG of the same dimensions but solid red — guaranteeing a ~100% diff.

**Say**: "Now let's run compare to detect the changes."

```bash
node dist/index.js compare --config ./config.json
```

Expected output (varies based on what you changed):
```
📸 Capturing current screenshots...
  [1/3] docs-home ✓
  [2/3] getting-started ✓ (changed: X.X%)
  [3/3] config-reference ⚠ (no baseline)

📊 Generating report...
✓ Report saved to report/report.md

Summary: 1 changed, 1 unchanged, 1 missing baseline
```

### Act 5: "The Report" (1 min)

**Show** the generated report:
```bash
cat report/report.md
```

**Say**: "The report tells the Docs team exactly which pages changed, by how much, and generates diff images highlighting the changes in red."

**Optionally show** a diff image:
```bash
ls screenshots/diff/
open screenshots/diff/getting-started.png  # if it exists
```

### Act 6: "The Process" (2 min)

**Say**: "What's interesting isn't just the tool — it's how we built it."

**Show** the GitHub commit history:
```bash
git log --oneline
```

**Point out**:
- 18 commits, each validated by CI
- TDD approach — test commits before implementation commits
- Track prefixes showing parallel work: `track-a:`, `track-b:`, `track-c:`
- CI-first: pipeline existed before any feature code

**Show** the CircleCI dashboard — 15+ pipeline runs, all green.

**Say**: "Three AI agents worked on config parsing, screenshot capture, and image comparison simultaneously. A fourth agent wired it all together. Every commit was validated by CI — the agents couldn't ship broken code."

### Act 7: "The Numbers" (1 min)

**Show** the test suite:
```bash
pnpm test:ci
```

Expected:
```
 Test Files  7 passed (7)
      Tests  53 passed (53)
```

**Key stats to mention**:
- 53 tests across 7 test files
- 18 commits to main
- 15+ CI pipeline runs
- 3 agents running in parallel
- 7 tracks (Foundation + A-D + Integration, E deferred)
- Built in a single session using Claude Code Agent Teams

---

## Backup: If Something Goes Wrong

### Playwright fails to launch
```bash
npx playwright install chromium
```

### Network issues with circleci.com/docs
Use a local test — the unit tests don't need network:
```bash
pnpm test:ci
```
Show the 53 tests passing as proof the tool works.

### Config error
Verify config.json is valid:
```bash
cat config.json | python3 -m json.tool
```

---

## Key Talking Points

1. **CI-first development**: Pipeline existed before any feature code. Agents couldn't implement while CI was red.

2. **BDD/TDD by AI agents**: Tests were written before implementation — not as an afterthought.

3. **Parallel execution**: 3 agents worked simultaneously on independent tracks, coordinated by a shared spec.

4. **Model routing**: Sonnet handled straightforward tracks (config, capture, compare, report). Opus was reserved for complex work (auth — deferred).

5. **Guayaba philosophy**: "Accept waste as cost of invention." The process of learning how AI agents collaborate matters as much as the output.

6. **Real tool, real value**: This isn't a toy — the Docs team can actually use this to detect stale screenshots.

---

## Quick Reset Between Demo Runs

```bash
rm -rf screenshots/baseline screenshots/current screenshots/diff report
```
