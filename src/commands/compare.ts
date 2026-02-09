import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { loadConfig } from '../core/config.js';
import { captureAllPages } from '../core/screenshot.js';
import { compareAllPages } from '../core/compare.js';
import { markdownReporter } from '../reporters/markdown.js';

export async function compareCommand(options: {
  config: string;
  output: string;
}): Promise<void> {
  try {
    // Load and validate config
    const configPath = resolve(options.config);
    const config = await loadConfig(configPath);

    // Set up directories
    const baselineDir = resolve('./screenshots/baseline');
    const currentDir = resolve('./screenshots/current');
    const diffDir = resolve('./screenshots/diff');
    const outputDir = resolve(options.output);

    // Create directories
    mkdirSync(currentDir, { recursive: true });
    mkdirSync(diffDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    // Step 1: Capture current screenshots
    console.log('📸 Capturing current screenshots...');
    const captureResults = await captureAllPages(config, currentDir);

    // Check for capture failures
    const failedCaptures = captureResults.filter((r) => !r.success);
    if (failedCaptures.length > 0) {
      console.error(
        `\n❌ Failed to capture ${failedCaptures.length} page(s). Cannot proceed with comparison.`,
      );
      process.exit(1);
    }

    // Step 2: Compare against baselines
    const comparisonResults = await compareAllPages(
      config,
      baselineDir,
      currentDir,
      diffDir,
    );

    // Step 3: Print per-page CLI summary
    const totalPages = comparisonResults.length;
    for (let i = 0; i < comparisonResults.length; i++) {
      const result = comparisonResults[i];
      const progress = `  [${i + 1}/${totalPages}]`;

      if (!result.baselineExists) {
        console.log(`${progress} ${result.page} ⚠ (no baseline)`);
      } else if (result.changed) {
        const diffPct = (result.diffPercentage * 100).toFixed(1);
        console.log(`${progress} ${result.page} ✓ (changed: ${diffPct}%)`);
      } else {
        console.log(`${progress} ${result.page} ✓`);
      }
    }

    // Step 4: Generate markdown report
    console.log('\n📊 Generating report...');
    await markdownReporter.generate(comparisonResults, outputDir);

    const reportPath = join(outputDir, 'report.md');
    console.log(`✓ Report saved to ${reportPath}`);

    // Step 5: Print summary
    const changed = comparisonResults.filter(
      (r) => r.baselineExists && r.changed,
    ).length;
    const unchanged = comparisonResults.filter(
      (r) => r.baselineExists && !r.changed,
    ).length;
    const missingBaseline = comparisonResults.filter(
      (r) => !r.baselineExists,
    ).length;

    console.log(
      `\nSummary: ${changed} changed, ${unchanged} unchanged, ${missingBaseline} missing baseline`,
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('❌ An unexpected error occurred');
    }
    process.exit(1);
  }
}
