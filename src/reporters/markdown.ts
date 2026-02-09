import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Reporter, ComparisonResult } from '../types/index.js';

/**
 * Generate markdown report from comparison results
 */
async function generateMarkdownReport(
  results: ComparisonResult[],
  outputDir: string,
): Promise<void> {
  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Categorize results
  const changed = results.filter((r) => r.baselineExists && r.changed);
  const unchanged = results.filter((r) => r.baselineExists && !r.changed);
  const missingBaseline = results.filter((r) => !r.baselineExists);

  // Generate report content
  const lines: string[] = [];

  // Title and timestamp
  lines.push('# Screenshot Comparison Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Summary section
  lines.push('## Summary');
  lines.push(`- **Total Pages**: ${results.length}`);
  lines.push(`- **Changed**: ${changed.length}`);
  lines.push(`- **Unchanged**: ${unchanged.length}`);
  lines.push(`- **Missing Baseline**: ${missingBaseline.length}`);
  lines.push('');

  // Changed pages section
  if (changed.length > 0) {
    lines.push('## Changed Pages');
    lines.push('');

    for (const result of changed) {
      const relativeBaseline = relative(process.cwd(), result.baselinePath);
      const relativeCurrent = relative(process.cwd(), result.currentPath);
      const relativeDiff = result.diffPath
        ? relative(process.cwd(), result.diffPath)
        : null;

      lines.push(`### ${result.page}`);
      lines.push(`- **Path**: ${result.path}`);
      lines.push(`- **Diff**: ${(result.diffPercentage * 100).toFixed(1)}%`);
      lines.push(`- **Baseline**: ${relativeBaseline}`);
      lines.push(`- **Current**: ${relativeCurrent}`);
      if (relativeDiff) {
        lines.push(`- **Diff Image**: ${relativeDiff}`);
        lines.push('');
        lines.push(`![Diff](${relativeDiff})`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // Missing baseline section
  if (missingBaseline.length > 0) {
    lines.push('## Missing Baseline');
    lines.push('These pages have no baseline screenshot. Run `capture` to create baselines.');

    for (const result of missingBaseline) {
      lines.push(`- ${result.page} (\`${result.path}\`)`);
    }
    lines.push('');
  }

  // Unchanged pages section
  if (unchanged.length > 0) {
    lines.push('## Unchanged Pages');
    for (const result of unchanged) {
      lines.push(`- ${result.page}`);
    }
    lines.push('');
  }

  // Write report
  const reportPath = join(outputDir, 'report.md');
  writeFileSync(reportPath, lines.join('\n'));
}

/**
 * Markdown reporter implementation
 */
export const markdownReporter: Reporter = {
  name: 'markdown',
  generate: generateMarkdownReport,
};
