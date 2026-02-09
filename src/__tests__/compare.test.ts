import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import {
  compareImages,
  comparePageScreenshots,
  compareAllPages,
} from '../core/compare.js';
import type { Config } from '../types/index.js';

const FIXTURE_DIR = join(process.cwd(), 'test-fixtures');

// Helper to create a solid color PNG
function createSolidColorPNG(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

// Helper to create a PNG with some changed pixels
function createPartiallyChangedPNG(
  width: number,
  height: number,
  baseColor: { r: number; g: number; b: number },
  changeColor: { r: number; g: number; b: number },
  changePercentage: number,
): Buffer {
  const png = new PNG({ width, height });
  const totalPixels = width * height;
  const pixelsToChange = Math.floor(totalPixels * changePercentage);

  // Fill with base color
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = baseColor.r;
      png.data[idx + 1] = baseColor.g;
      png.data[idx + 2] = baseColor.b;
      png.data[idx + 3] = 255;
    }
  }

  // Change some pixels
  for (let i = 0; i < pixelsToChange; i++) {
    const idx = i << 2;
    png.data[idx] = changeColor.r;
    png.data[idx + 1] = changeColor.g;
    png.data[idx + 2] = changeColor.b;
  }

  return PNG.sync.write(png);
}

describe('compare.ts - Image Comparison Engine (Track C)', () => {
  let baselineDir: string;
  let currentDir: string;
  let diffDir: string;

  beforeAll(() => {
    // Clean up any existing fixtures
    if (existsSync(FIXTURE_DIR)) {
      rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }

    // Create directories
    baselineDir = join(FIXTURE_DIR, 'baseline');
    currentDir = join(FIXTURE_DIR, 'current');
    diffDir = join(FIXTURE_DIR, 'diff');

    mkdirSync(baselineDir, { recursive: true });
    mkdirSync(currentDir, { recursive: true });
    mkdirSync(diffDir, { recursive: true });

    // Generate test fixtures
    const redPNG = createSolidColorPNG(10, 10, 255, 0, 0);
    const redIdenticalPNG = createSolidColorPNG(10, 10, 255, 0, 0);
    const changedPNG = createPartiallyChangedPNG(
      10,
      10,
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 },
      0.3, // 30% changed
    );
    const minorChangePNG = createPartiallyChangedPNG(
      10,
      10,
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 },
      0.03, // 3% changed
    );

    // Write baseline fixtures
    writeFileSync(join(baselineDir, 'identical.png'), redPNG);
    writeFileSync(join(baselineDir, 'changed.png'), redPNG);
    writeFileSync(join(baselineDir, 'minor.png'), redPNG);
    writeFileSync(join(baselineDir, 'page1.png'), redPNG);
    writeFileSync(join(baselineDir, 'page2.png'), redPNG);

    // Write current fixtures
    writeFileSync(join(currentDir, 'identical.png'), redIdenticalPNG);
    writeFileSync(join(currentDir, 'changed.png'), changedPNG);
    writeFileSync(join(currentDir, 'minor.png'), minorChangePNG);
    writeFileSync(join(currentDir, 'page1.png'), redIdenticalPNG);
    writeFileSync(join(currentDir, 'page2.png'), changedPNG);

    // Note: no baseline for 'missing.png' - intentionally omitted for T017
  });

  afterAll(() => {
    // Clean up fixtures
    if (existsSync(FIXTURE_DIR)) {
      rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
  });

  describe('compareImages()', () => {
    it('T013: Identical images produce 0% diff (P0)', async () => {
      const baselinePath = join(baselineDir, 'identical.png');
      const currentPath = join(currentDir, 'identical.png');
      const diffPath = join(diffDir, 'identical-diff.png');

      const result = await compareImages(
        baselinePath,
        currentPath,
        diffPath,
        0.05,
      );

      expect(result.baselineExists).toBe(true);
      expect(result.diffPixels).toBe(0);
      expect(result.totalPixels).toBe(100); // 10x10
      expect(result.diffPercentage).toBe(0);
      expect(result.changed).toBe(false);
      expect(result.baselinePath).toBe(baselinePath);
      expect(result.currentPath).toBe(currentPath);
      expect(result.diffPath).toBeNull(); // No diff image for identical images
    });

    it('T014: Known-changed images produce >0% diff (P0)', async () => {
      const baselinePath = join(baselineDir, 'changed.png');
      const currentPath = join(currentDir, 'changed.png');
      const diffPath = join(diffDir, 'changed-diff.png');

      const result = await compareImages(
        baselinePath,
        currentPath,
        diffPath,
        0.05,
      );

      expect(result.baselineExists).toBe(true);
      expect(result.diffPixels).toBeGreaterThan(0);
      expect(result.totalPixels).toBe(100);
      expect(result.diffPercentage).toBeGreaterThan(0);
    });

    it('T015: Diff exceeding threshold (>5%) marked as "changed" (P0)', async () => {
      const baselinePath = join(baselineDir, 'changed.png');
      const currentPath = join(currentDir, 'changed.png');
      const diffPath = join(diffDir, 'changed-diff.png');

      const result = await compareImages(
        baselinePath,
        currentPath,
        diffPath,
        0.05, // 5% threshold
      );

      expect(result.diffPercentage).toBeGreaterThan(0.05);
      expect(result.changed).toBe(true);
    });

    it('T016: Diff below threshold (<=5%) marked as "unchanged" (P0)', async () => {
      const baselinePath = join(baselineDir, 'minor.png');
      const currentPath = join(currentDir, 'minor.png');
      const diffPath = join(diffDir, 'minor-diff.png');

      const result = await compareImages(
        baselinePath,
        currentPath,
        diffPath,
        0.05, // 5% threshold
      );

      expect(result.diffPercentage).toBeLessThanOrEqual(0.05);
      expect(result.changed).toBe(false);
      expect(result.diffPath).toBeNull(); // No diff image for unchanged
    });

    it('T017: Missing baseline returns baselineExists: false (P0)', async () => {
      const baselinePath = join(baselineDir, 'missing.png');
      const currentPath = join(currentDir, 'identical.png');
      const diffPath = join(diffDir, 'missing-diff.png');

      const result = await compareImages(
        baselinePath,
        currentPath,
        diffPath,
        0.05,
      );

      expect(result.baselineExists).toBe(false);
      expect(result.changed).toBe(true); // Missing baseline is a change
      expect(result.diffPixels).toBe(0);
      expect(result.totalPixels).toBe(0);
      expect(result.diffPercentage).toBe(0);
      expect(result.diffPath).toBeNull();
    });

    it('T018: Diff image generated with changed pixels highlighted (P1)', async () => {
      const baselinePath = join(baselineDir, 'changed.png');
      const currentPath = join(currentDir, 'changed.png');
      const diffPath = join(diffDir, 'changed-diff.png');

      const result = await compareImages(
        baselinePath,
        currentPath,
        diffPath,
        0.05,
      );

      expect(result.changed).toBe(true);
      expect(result.diffPath).toBe(diffPath);
      expect(existsSync(diffPath)).toBe(true);

      // Verify diff image has correct dimensions
      const diffPNG = PNG.sync.read(
        await import('node:fs').then((fs) => fs.readFileSync(diffPath)),
      );
      expect(diffPNG.width).toBe(10);
      expect(diffPNG.height).toBe(10);
    });

    it('Extra: Size mismatch handled gracefully', async () => {
      // Create a mismatched size image
      const mismatchedPNG = createSolidColorPNG(20, 20, 0, 255, 0); // 20x20 green
      const mismatchedPath = join(currentDir, 'mismatched.png');
      writeFileSync(mismatchedPath, mismatchedPNG);

      const baselinePath = join(baselineDir, 'identical.png'); // 10x10
      const diffPath = join(diffDir, 'mismatched-diff.png');

      const result = await compareImages(
        baselinePath,
        mismatchedPath,
        diffPath,
        0.05,
      );

      expect(result.baselineExists).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.diffPath).toBeNull(); // No diff image for size mismatch
    });
  });

  describe('comparePageScreenshots()', () => {
    it('should compare screenshots for a single page', async () => {
      const pageConfig = { path: '/test', name: 'page1' };

      const result = await comparePageScreenshots(
        pageConfig,
        baselineDir,
        currentDir,
        diffDir,
        0.05,
      );

      expect(result.page).toBe('page1');
      expect(result.path).toBe('/test');
      expect(result.baselineExists).toBe(true);
      expect(result.changed).toBe(false);
    });

    it('should handle changed page screenshots', async () => {
      const pageConfig = { path: '/changed', name: 'page2' };

      const result = await comparePageScreenshots(
        pageConfig,
        baselineDir,
        currentDir,
        diffDir,
        0.05,
      );

      expect(result.page).toBe('page2');
      expect(result.path).toBe('/changed');
      expect(result.changed).toBe(true);
    });
  });

  describe('compareAllPages()', () => {
    it('should compare all pages in config', async () => {
      const config: Config = {
        baseUrl: 'https://example.com',
        pages: [
          { path: '/test', name: 'page1' },
          { path: '/changed', name: 'page2' },
        ],
        diffThreshold: 0.05,
      };

      const results = await compareAllPages(
        config,
        baselineDir,
        currentDir,
        diffDir,
      );

      expect(results).toHaveLength(2);
      expect(results[0].page).toBe('page1');
      expect(results[0].changed).toBe(false);
      expect(results[1].page).toBe('page2');
      expect(results[1].changed).toBe(true);
    });
  });
});
