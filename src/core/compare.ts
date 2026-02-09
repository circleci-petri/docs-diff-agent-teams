import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { ComparisonResult, Config } from '../types/index.js';
import { join } from 'node:path';

/**
 * Compare two PNG images and generate a diff image if they differ.
 * Handles missing baseline, size mismatch, and threshold-based change detection.
 *
 * @param baselinePath - Path to the baseline image
 * @param currentPath - Path to the current image
 * @param diffPath - Path where diff image should be written
 * @param threshold - Percentage threshold (0-1) for considering images as "changed"
 * @returns ComparisonResult with detailed comparison metrics
 */
export async function compareImages(
  baselinePath: string,
  currentPath: string,
  diffPath: string,
  threshold: number,
): Promise<ComparisonResult> {
  // Check if baseline exists
  if (!existsSync(baselinePath)) {
    return {
      page: '',
      path: '',
      baselineExists: false,
      diffPixels: 0,
      totalPixels: 0,
      diffPercentage: 0,
      changed: true,
      baselinePath,
      currentPath,
      diffPath: null,
    };
  }

  // Read both images
  let baseline: PNG;
  let current: PNG;
  try {
    const baselineBuffer = readFileSync(baselinePath);
    baseline = PNG.sync.read(baselineBuffer);
  } catch (error) {
    console.warn(
      `⚠️  Corrupt or unreadable baseline image: ${baselinePath} (${error instanceof Error ? error.message : String(error)})`,
    );
    return {
      page: '',
      path: '',
      baselineExists: true,
      diffPixels: 0,
      totalPixels: 0,
      diffPercentage: 0,
      changed: true,
      baselinePath,
      currentPath,
      diffPath: null,
    };
  }
  try {
    const currentBuffer = readFileSync(currentPath);
    current = PNG.sync.read(currentBuffer);
  } catch (error) {
    console.warn(
      `⚠️  Corrupt or unreadable current image: ${currentPath} (${error instanceof Error ? error.message : String(error)})`,
    );
    return {
      page: '',
      path: '',
      baselineExists: true,
      diffPixels: 0,
      totalPixels: 0,
      diffPercentage: 0,
      changed: true,
      baselinePath,
      currentPath,
      diffPath: null,
    };
  }

  // Handle size mismatch
  if (baseline.width !== current.width || baseline.height !== current.height) {
    console.warn(
      `⚠️  Size mismatch: baseline ${baseline.width}x${baseline.height}, current ${current.width}x${current.height}`,
    );
    return {
      page: '',
      path: '',
      baselineExists: true,
      diffPixels: 0,
      totalPixels: baseline.width * baseline.height,
      diffPercentage: 0,
      changed: true,
      baselinePath,
      currentPath,
      diffPath: null,
    };
  }

  // Run pixelmatch
  const { width, height } = baseline;
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }, // pixelmatch's color sensitivity threshold
  );

  const totalPixels = width * height;
  const diffPercentage = diffPixels / totalPixels;
  const changed = diffPercentage > threshold;

  // Write diff image only if changed
  let finalDiffPath: string | null = null;
  if (changed) {
    writeFileSync(diffPath, PNG.sync.write(diff));
    finalDiffPath = diffPath;
  }

  return {
    page: '',
    path: '',
    baselineExists: true,
    diffPixels,
    totalPixels,
    diffPercentage,
    changed,
    baselinePath,
    currentPath,
    diffPath: finalDiffPath,
  };
}

/**
 * Compare screenshots for a single page configuration.
 *
 * @param pageConfig - Page configuration with name and path
 * @param baselineDir - Directory containing baseline images
 * @param currentDir - Directory containing current images
 * @param diffDir - Directory where diff images should be written
 * @param threshold - Percentage threshold for considering images as "changed"
 * @returns ComparisonResult with page metadata filled in
 */
export async function comparePageScreenshots(
  pageConfig: { name: string; path: string },
  baselineDir: string,
  currentDir: string,
  diffDir: string,
  threshold: number,
): Promise<ComparisonResult> {
  const baselinePath = join(baselineDir, `${pageConfig.name}.png`);
  const currentPath = join(currentDir, `${pageConfig.name}.png`);
  const diffPath = join(diffDir, `${pageConfig.name}-diff.png`);

  const result = await compareImages(
    baselinePath,
    currentPath,
    diffPath,
    threshold,
  );

  // Fill in page metadata
  return {
    ...result,
    page: pageConfig.name,
    path: pageConfig.path,
  };
}

/**
 * Compare screenshots for all pages in the configuration.
 *
 * @param config - Full configuration with pages list
 * @param baselineDir - Directory containing baseline images
 * @param currentDir - Directory containing current images
 * @param diffDir - Directory where diff images should be written
 * @returns Array of ComparisonResults for each page
 */
export async function compareAllPages(
  config: Config,
  baselineDir: string,
  currentDir: string,
  diffDir: string,
): Promise<ComparisonResult[]> {
  const threshold = config.diffThreshold ?? 0.05;

  const results = await Promise.all(
    config.pages.map((page) =>
      comparePageScreenshots(page, baselineDir, currentDir, diffDir, threshold),
    ),
  );

  return results;
}
