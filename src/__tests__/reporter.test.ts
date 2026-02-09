import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { markdownReporter } from '../reporters/markdown.js';
import { registerReporter, getReporter } from '../reporters/reporter.js';
import type { ComparisonResult } from '../types/index.js';

const FIXTURE_DIR = join(process.cwd(), 'test-fixtures-reporter');

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(FIXTURE_DIR)) {
    rmSync(FIXTURE_DIR, { recursive: true });
  }
});

describe('Markdown Reporter', () => {
  it('T019: Markdown report includes summary counts (P0)', async () => {
    const results: ComparisonResult[] = [
      {
        page: 'homepage',
        path: '/',
        baselineExists: true,
        diffPixels: 1000,
        totalPixels: 100000,
        diffPercentage: 0.01,
        changed: false,
        baselinePath: './screenshots/baseline/homepage.png',
        currentPath: './screenshots/current/homepage.png',
        diffPath: null,
      },
      {
        page: 'getting-started',
        path: '/getting-started',
        baselineExists: true,
        diffPixels: 12400,
        totalPixels: 100000,
        diffPercentage: 0.124,
        changed: true,
        baselinePath: './screenshots/baseline/getting-started.png',
        currentPath: './screenshots/current/getting-started.png',
        diffPath: './screenshots/diff/getting-started-diff.png',
      },
      {
        page: 'deployment-guide',
        path: '/guides/deployment',
        baselineExists: false,
        diffPixels: 0,
        totalPixels: 0,
        diffPercentage: 0,
        changed: true,
        baselinePath: './screenshots/baseline/deployment-guide.png',
        currentPath: './screenshots/current/deployment-guide.png',
        diffPath: null,
      },
    ];

    const outputDir = join(FIXTURE_DIR, 'test-summary');
    await markdownReporter.generate(results, outputDir);

    const reportPath = join(outputDir, 'report.md');
    expect(existsSync(reportPath)).toBe(true);

    const content = readFileSync(reportPath, 'utf-8');

    // Check summary section
    expect(content).toContain('## Summary');
    expect(content).toContain('**Total Pages**: 3');
    expect(content).toContain('**Changed**: 1');
    expect(content).toContain('**Unchanged**: 1');
    expect(content).toContain('**Missing Baseline**: 1');
  });

  it('T020: Changed pages listed with diff percentage (P0)', async () => {
    const results: ComparisonResult[] = [
      {
        page: 'getting-started',
        path: '/getting-started',
        baselineExists: true,
        diffPixels: 12400,
        totalPixels: 100000,
        diffPercentage: 0.124,
        changed: true,
        baselinePath: './screenshots/baseline/getting-started.png',
        currentPath: './screenshots/current/getting-started.png',
        diffPath: './screenshots/diff/getting-started-diff.png',
      },
      {
        page: 'config-reference',
        path: '/config',
        baselineExists: true,
        diffPixels: 6789,
        totalPixels: 100000,
        diffPercentage: 0.06789,
        changed: true,
        baselinePath: './screenshots/baseline/config-reference.png',
        currentPath: './screenshots/current/config-reference.png',
        diffPath: './screenshots/diff/config-reference-diff.png',
      },
    ];

    const outputDir = join(FIXTURE_DIR, 'test-changed');
    await markdownReporter.generate(results, outputDir);

    const reportPath = join(outputDir, 'report.md');
    const content = readFileSync(reportPath, 'utf-8');

    // Check changed pages section
    expect(content).toContain('## Changed Pages');
    expect(content).toContain('### getting-started');
    expect(content).toContain('**Path**: /getting-started');
    expect(content).toContain('**Diff**: 12.4%');
    expect(content).toContain('**Baseline**: screenshots/baseline/getting-started.png');
    expect(content).toContain('**Current**: screenshots/current/getting-started.png');
    expect(content).toContain('**Diff Image**: screenshots/diff/getting-started-diff.png');

    expect(content).toContain('### config-reference');
    expect(content).toContain('**Diff**: 6.8%');
  });

  it('T021: Missing baseline pages listed separately (P0)', async () => {
    const results: ComparisonResult[] = [
      {
        page: 'deployment-guide',
        path: '/guides/deployment',
        baselineExists: false,
        diffPixels: 0,
        totalPixels: 0,
        diffPercentage: 0,
        changed: true,
        baselinePath: './screenshots/baseline/deployment-guide.png',
        currentPath: './screenshots/current/deployment-guide.png',
        diffPath: null,
      },
      {
        page: 'new-feature',
        path: '/features/new',
        baselineExists: false,
        diffPixels: 0,
        totalPixels: 0,
        diffPercentage: 0,
        changed: true,
        baselinePath: './screenshots/baseline/new-feature.png',
        currentPath: './screenshots/current/new-feature.png',
        diffPath: null,
      },
    ];

    const outputDir = join(FIXTURE_DIR, 'test-missing');
    await markdownReporter.generate(results, outputDir);

    const reportPath = join(outputDir, 'report.md');
    const content = readFileSync(reportPath, 'utf-8');

    // Check missing baseline section
    expect(content).toContain('## Missing Baseline');
    expect(content).toContain('These pages have no baseline screenshot');
    expect(content).toContain('- deployment-guide (`/guides/deployment`)');
    expect(content).toContain('- new-feature (`/features/new`)');
  });

  it('T022: Unchanged pages listed (P1)', async () => {
    const results: ComparisonResult[] = [
      {
        page: 'homepage',
        path: '/',
        baselineExists: true,
        diffPixels: 1000,
        totalPixels: 100000,
        diffPercentage: 0.01,
        changed: false,
        baselinePath: './screenshots/baseline/homepage.png',
        currentPath: './screenshots/current/homepage.png',
        diffPath: null,
      },
      {
        page: 'about',
        path: '/about',
        baselineExists: true,
        diffPixels: 500,
        totalPixels: 100000,
        diffPercentage: 0.005,
        changed: false,
        baselinePath: './screenshots/baseline/about.png',
        currentPath: './screenshots/current/about.png',
        diffPath: null,
      },
    ];

    const outputDir = join(FIXTURE_DIR, 'test-unchanged');
    await markdownReporter.generate(results, outputDir);

    const reportPath = join(outputDir, 'report.md');
    const content = readFileSync(reportPath, 'utf-8');

    // Check unchanged pages section
    expect(content).toContain('## Unchanged Pages');
    expect(content).toContain('- homepage');
    expect(content).toContain('- about');
  });

  it('T023: Diff image paths embedded in markdown (P1)', async () => {
    const results: ComparisonResult[] = [
      {
        page: 'getting-started',
        path: '/getting-started',
        baselineExists: true,
        diffPixels: 12400,
        totalPixels: 100000,
        diffPercentage: 0.124,
        changed: true,
        baselinePath: './screenshots/baseline/getting-started.png',
        currentPath: './screenshots/current/getting-started.png',
        diffPath: './screenshots/diff/getting-started-diff.png',
      },
    ];

    const outputDir = join(FIXTURE_DIR, 'test-diff-image');
    await markdownReporter.generate(results, outputDir);

    const reportPath = join(outputDir, 'report.md');
    const content = readFileSync(reportPath, 'utf-8');

    // Check diff image is embedded
    expect(content).toContain('![Diff](screenshots/diff/getting-started-diff.png)');
  });

  it('T024: Reporter registry allows registration and retrieval', async () => {
    // Register the markdown reporter
    registerReporter(markdownReporter);

    // Retrieve it
    const retrieved = getReporter('markdown');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('markdown');

    // Non-existent reporter returns undefined
    const notFound = getReporter('nonexistent');
    expect(notFound).toBeUndefined();
  });
});
