import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from "vitest";
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import type { Config } from "../types/index.js";

const FIXTURE_DIR = join(process.cwd(), "test-fixtures-integration");

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

beforeEach(() => {
  vi.resetModules();
});

describe("Integration Tests", () => {
  describe("E2E-1: Happy path — create mock baselines, run compare, verify report", () => {
    it("should create correct report with proper counts", async () => {
      const testDir = join(FIXTURE_DIR, "e2e-1");
      const outputDir = join(testDir, "report");

      // Create test directory
      mkdirSync(testDir, { recursive: true });

      // compareCommand uses hardcoded paths relative to cwd:
      // baselineDir = resolve('./screenshots/baseline')
      // So we need to create baselines in the CWD's screenshots/baseline
      const baselineDir = join(process.cwd(), "screenshots", "baseline");

      // Create baseline directory with 3 screenshots
      // 1 unchanged, 1 changed, 1 missing baseline (only current exists)
      mkdirSync(baselineDir, { recursive: true });

      const redPng = createSolidColorPNG(100, 100, 255, 0, 0);
      const bluePng = createSolidColorPNG(100, 100, 0, 0, 255);

      // Baseline for unchanged page
      writeFileSync(join(baselineDir, "unchanged-page.png"), redPng);
      // Baseline for changed page
      writeFileSync(join(baselineDir, "changed-page.png"), redPng);
      // No baseline for missing-baseline-page

      // Create config
      const configPath = join(testDir, "test-config.json");
      const config: Config = {
        baseUrl: "http://example.com",
        pages: [
          { path: "/unchanged", name: "unchanged-page" },
          { path: "/changed", name: "changed-page" },
          { path: "/missing", name: "missing-baseline-page" },
        ],
        viewport: { width: 1440, height: 900 },
        waitDelay: 100,
        diffThreshold: 0.05,
      };
      writeFileSync(configPath, JSON.stringify(config));

      // Mock captureAllPages to create current screenshots
      vi.doMock("../core/screenshot.js", () => ({
        captureAllPages: vi
          .fn()
          .mockImplementation(async (cfg: Config, dir: string) => {
            mkdirSync(dir, { recursive: true });

            // Unchanged page - same as baseline
            writeFileSync(join(dir, "unchanged-page.png"), redPng);
            // Changed page - different from baseline
            writeFileSync(join(dir, "changed-page.png"), bluePng);
            // Missing baseline page - new screenshot
            writeFileSync(join(dir, "missing-baseline-page.png"), redPng);

            return [
              {
                page: "unchanged-page",
                path: "/unchanged",
                success: true,
                screenshotPath: join(dir, "unchanged-page.png"),
              },
              {
                page: "changed-page",
                path: "/changed",
                success: true,
                screenshotPath: join(dir, "changed-page.png"),
              },
              {
                page: "missing-baseline-page",
                path: "/missing",
                success: true,
                screenshotPath: join(dir, "missing-baseline-page.png"),
              },
            ];
          }),
        createBrowser: vi.fn(),
        createPage: vi.fn(),
        captureScreenshot: vi.fn(),
      }));

      const { compareCommand } = await import("../commands/compare.js");

      // Run compare command
      await compareCommand({ config: configPath, output: outputDir });

      // Verify report was created
      const reportPath = join(outputDir, "report.md");
      expect(existsSync(reportPath)).toBe(true);

      // Read and verify report content
      const reportContent = readFileSync(reportPath, "utf-8");

      // Verify summary section
      expect(reportContent).toContain("## Summary");
      expect(reportContent).toContain("- **Total Pages**: 3");
      expect(reportContent).toContain("- **Changed**: 1");
      expect(reportContent).toContain("- **Unchanged**: 1");
      expect(reportContent).toContain("- **Missing Baseline**: 1");

      // Verify sections exist
      expect(reportContent).toContain("## Changed Pages");
      expect(reportContent).toContain("## Missing Baseline");
      expect(reportContent).toContain("## Unchanged Pages");

      // Verify page names appear correctly
      expect(reportContent).toContain("changed-page");
      expect(reportContent).toContain("missing-baseline-page");
      expect(reportContent).toContain("unchanged-page");

      // Cleanup baseline directory
      if (existsSync(baselineDir)) {
        rmSync(baselineDir, { recursive: true, force: true });
      }
    });
  });

  describe("E2E-4: Invalid config rejected with clear error message", () => {
    it("should reject config with missing baseUrl", async () => {
      const testDir = join(FIXTURE_DIR, "e2e-4-missing-baseurl");
      mkdirSync(testDir, { recursive: true });

      const configPath = join(testDir, "invalid-config.json");
      const invalidConfig = {
        pages: [{ path: "/", name: "home" }],
      };
      writeFileSync(configPath, JSON.stringify(invalidConfig));

      const { captureCommand } = await import("../commands/capture.js");

      // Capture stderr
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const processExitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await captureCommand({ config: configPath });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config validation failed: baseUrl is required"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("should reject config with invalid JSON", async () => {
      const testDir = join(FIXTURE_DIR, "e2e-4-invalid-json");
      mkdirSync(testDir, { recursive: true });

      const configPath = join(testDir, "invalid-json.json");
      writeFileSync(configPath, "{ invalid json }");

      const { captureCommand } = await import("../commands/capture.js");

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const processExitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await captureCommand({ config: configPath });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid JSON in config file"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("should reject config with invalid baseUrl", async () => {
      const testDir = join(FIXTURE_DIR, "e2e-4-invalid-url");
      mkdirSync(testDir, { recursive: true });

      const configPath = join(testDir, "invalid-url-config.json");
      const invalidConfig = {
        baseUrl: "not-a-valid-url",
        pages: [{ path: "/", name: "home" }],
      };
      writeFileSync(configPath, JSON.stringify(invalidConfig));

      const { captureCommand } = await import("../commands/capture.js");

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const processExitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await captureCommand({ config: configPath });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("baseUrl must be a valid URL"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("should reject config with empty pages array", async () => {
      const testDir = join(FIXTURE_DIR, "e2e-4-empty-pages");
      mkdirSync(testDir, { recursive: true });

      const configPath = join(testDir, "empty-pages-config.json");
      const invalidConfig = {
        baseUrl: "http://example.com",
        pages: [],
      };
      writeFileSync(configPath, JSON.stringify(invalidConfig));

      const { captureCommand } = await import("../commands/capture.js");

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const processExitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await captureCommand({ config: configPath });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("pages must contain at least one page"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe("E2E-6: Custom output path works with --output flag", () => {
    it("should save report to custom output directory", async () => {
      const testDir = join(FIXTURE_DIR, "e2e-6");
      const customOutputDir = join(testDir, "my-custom-reports");

      // Create test directory
      mkdirSync(testDir, { recursive: true });

      // compareCommand uses hardcoded paths relative to cwd
      const baselineDir = join(process.cwd(), "screenshots", "baseline");

      // Create baseline
      mkdirSync(baselineDir, { recursive: true });
      const testPng = createSolidColorPNG(100, 100, 255, 0, 0);
      writeFileSync(join(baselineDir, "page.png"), testPng);

      // Create config
      const configPath = join(testDir, "test-config.json");
      const config: Config = {
        baseUrl: "http://example.com",
        pages: [{ path: "/", name: "page" }],
        viewport: { width: 1440, height: 900 },
        waitDelay: 100,
        diffThreshold: 0.05,
      };
      writeFileSync(configPath, JSON.stringify(config));

      // Mock captureAllPages
      vi.doMock("../core/screenshot.js", () => ({
        captureAllPages: vi
          .fn()
          .mockImplementation(async (cfg: Config, dir: string) => {
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, "page.png"), testPng);

            return [
              {
                page: "page",
                path: "/",
                success: true,
                screenshotPath: join(dir, "page.png"),
              },
            ];
          }),
        createBrowser: vi.fn(),
        createPage: vi.fn(),
        captureScreenshot: vi.fn(),
      }));

      const { compareCommand } = await import("../commands/compare.js");

      // Run compare with custom output path
      await compareCommand({ config: configPath, output: customOutputDir });

      // Verify report was created in custom directory
      const reportPath = join(customOutputDir, "report.md");
      expect(existsSync(reportPath)).toBe(true);

      // Verify content
      const reportContent = readFileSync(reportPath, "utf-8");
      expect(reportContent).toContain("# Screenshot Comparison Report");

      // Cleanup baseline directory
      if (existsSync(baselineDir)) {
        rmSync(baselineDir, { recursive: true, force: true });
      }
    });
  });
});
