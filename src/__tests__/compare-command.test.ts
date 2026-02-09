import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import type { Config } from '../types/index.js';

const FIXTURE_DIR = join(process.cwd(), 'test-fixtures-compare-cmd');

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

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(FIXTURE_DIR)) {
    rmSync(FIXTURE_DIR, { recursive: true });
  }
});

// Mock captureAllPages before each test
beforeEach(() => {
  vi.resetModules();
});

describe('Compare Command', () => {
  it('T025: compare command generates report (P0)', async () => {
    // Set up test directories
    const testDir = join(FIXTURE_DIR, 't025');
    const screenshotsDir = join(testDir, 'screenshots');
    const baselineDir = join(screenshotsDir, 'baseline');
    const outputDir = join(testDir, 'report');

    // Create baseline directory with real PNG screenshots
    mkdirSync(baselineDir, { recursive: true });
    const testPng = createSolidColorPNG(100, 100, 255, 0, 0);
    writeFileSync(join(baselineDir, 'homepage.png'), testPng);
    writeFileSync(join(baselineDir, 'about.png'), testPng);

    // Create a minimal config file
    const configPath = join(testDir, 'test-config.json');
    const config: Config = {
      baseUrl: 'http://example.com',
      pages: [
        { path: '/', name: 'homepage' },
        { path: '/about', name: 'about' },
      ],
      viewport: { width: 1440, height: 900 },
      waitDelay: 100,
      diffThreshold: 0.05,
    };
    writeFileSync(configPath, JSON.stringify(config));

    // Mock captureAllPages to avoid launching browser but create current screenshots
    vi.doMock('../core/screenshot.js', () => ({
      captureAllPages: vi.fn().mockImplementation(async (cfg: Config, dir: string) => {
        // Create current screenshots
        mkdirSync(dir, { recursive: true });
        const currentPng = createSolidColorPNG(100, 100, 255, 0, 0);
        writeFileSync(join(dir, 'homepage.png'), currentPng);
        writeFileSync(join(dir, 'about.png'), currentPng);

        return [
          {
            page: 'homepage',
            path: '/',
            success: true,
            screenshotPath: join(dir, 'homepage.png'),
          },
          {
            page: 'about',
            path: '/about',
            success: true,
            screenshotPath: join(dir, 'about.png'),
          },
        ];
      }),
      createBrowser: vi.fn(),
      createPage: vi.fn(),
      captureScreenshot: vi.fn(),
    }));

    const { compareCommand } = await import('../commands/compare.js');

    // Run compare command
    await compareCommand({ config: configPath, output: outputDir });

    // Verify report was created
    const reportPath = join(outputDir, 'report.md');
    expect(existsSync(reportPath)).toBe(true);
  });

  it('T027: --output flag accepts custom report path (P1)', async () => {
    // Create a minimal config file
    const configPath = join(FIXTURE_DIR, 'test-config-custom.json');
    const config: Config = {
      baseUrl: 'http://example.com',
      pages: [{ path: '/', name: 'homepage' }],
      viewport: { width: 1440, height: 900 },
      waitDelay: 100,
      diffThreshold: 0.05,
    };
    writeFileSync(configPath, JSON.stringify(config));

    // Create baseline with real PNG
    const baselineDir = join(FIXTURE_DIR, 'screenshots', 'baseline');
    mkdirSync(baselineDir, { recursive: true });
    const testPng = createSolidColorPNG(100, 100, 255, 0, 0);
    writeFileSync(join(baselineDir, 'homepage.png'), testPng);

    // Mock captureAllPages
    vi.doMock('../core/screenshot.js', () => ({
      captureAllPages: vi.fn().mockImplementation(async (cfg: Config, dir: string) => {
        mkdirSync(dir, { recursive: true });
        const currentPng = createSolidColorPNG(100, 100, 255, 0, 0);
        writeFileSync(join(dir, 'homepage.png'), currentPng);

        return [
          {
            page: 'homepage',
            path: '/',
            success: true,
            screenshotPath: join(dir, 'homepage.png'),
          },
        ];
      }),
      createBrowser: vi.fn(),
      createPage: vi.fn(),
      captureScreenshot: vi.fn(),
    }));

    const { compareCommand } = await import('../commands/compare.js');
    const customOutputDir = join(FIXTURE_DIR, 'custom-report-dir');

    // Run compare command with custom output
    await compareCommand({ config: configPath, output: customOutputDir });

    // Verify report was created in custom location
    const reportPath = join(customOutputDir, 'report.md');
    expect(existsSync(reportPath)).toBe(true);
  });
});
