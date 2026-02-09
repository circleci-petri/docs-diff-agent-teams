import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Browser, BrowserContext, Page } from "playwright";
import {
  createBrowser,
  createPage,
  captureScreenshot,
  captureAllPages,
} from "../core/screenshot.js";
import type { Config } from "../types/index.js";

// Mock playwright
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe("screenshot capture", () => {
  let mockBrowser: Browser;
  let mockContext: BrowserContext;
  let mockPage: Page;

  beforeEach(() => {
    // Setup mock page
    mockPage = {
      goto: vi.fn().mockResolvedValue(null),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;

    // Setup mock context
    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext;

    // Setup mock browser
    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Browser;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("T008: Single page captured at correct viewport size (P0)", () => {
    it("should capture a screenshot at the specified viewport", async () => {
      const { chromium } = await import("playwright");
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

      const browser = await createBrowser();
      const page = await createPage(browser, { width: 1440, height: 900 });

      expect(browser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1440, height: 900 },
      });
      expect(mockContext.newPage).toHaveBeenCalled();
      expect(page).toBe(mockPage);
    });

    it("should capture screenshot with correct parameters", async () => {
      const pageConfig = { path: "/docs", name: "docs-page" };
      const result = await captureScreenshot(
        mockPage,
        "https://example.com",
        pageConfig,
        "/output",
        2000,
      );

      expect(mockPage.goto).toHaveBeenCalledWith("https://example.com/docs", {
        waitUntil: "networkidle",
      });
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: "/output/docs-page.png",
        fullPage: false,
      });
      expect(result.success).toBe(true);
      expect(result.page).toBe("docs-page");
      expect(result.path).toBe("/docs");
      expect(result.screenshotPath).toBe("/output/docs-page.png");
    });
  });

  describe("T009: Multiple pages captured in sequence (P0)", () => {
    it("should capture all pages in config", async () => {
      const { chromium } = await import("playwright");
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

      const config: Config = {
        baseUrl: "https://example.com",
        pages: [
          { path: "/page1", name: "page-1" },
          { path: "/page2", name: "page-2" },
          { path: "/page3", name: "page-3" },
        ],
        viewport: { width: 1440, height: 900 },
        waitDelay: 2000,
      };

      const results = await captureAllPages(config, "/output");

      expect(results).toHaveLength(3);
      expect(results[0].page).toBe("page-1");
      expect(results[1].page).toBe("page-2");
      expect(results[2].page).toBe("page-3");
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe("T010: Screenshot saved to correct path with sanitized name (P0)", () => {
    it("should save screenshot with sanitized filename", async () => {
      const pageConfig = { path: "/docs/api/v1", name: "docs-api-v1" };
      const result = await captureScreenshot(
        mockPage,
        "https://example.com",
        pageConfig,
        "/output",
        2000,
      );

      expect(result.screenshotPath).toBe("/output/docs-api-v1.png");
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: "/output/docs-api-v1.png",
        fullPage: false,
      });
    });

    it("should handle names with special characters", async () => {
      const pageConfig = { path: "/docs?query=test", name: "docs-query" };
      const result = await captureScreenshot(
        mockPage,
        "https://example.com",
        pageConfig,
        "/output",
        2000,
      );

      expect(result.screenshotPath).toBe("/output/docs-query.png");
    });
  });

  describe("T011: Page load failure logged, marked as error, continues to next (P1)", () => {
    it("should handle page load failure gracefully", async () => {
      const pageConfig = { path: "/broken", name: "broken-page" };
      vi.mocked(mockPage.goto).mockRejectedValue(
        new Error("Navigation failed"),
      );

      const result = await captureScreenshot(
        mockPage,
        "https://example.com",
        pageConfig,
        "/output",
        2000,
      );

      expect(result.success).toBe(false);
      expect(result.page).toBe("broken-page");
      expect(result.error).toBe("Navigation failed");
      expect(mockPage.screenshot).not.toHaveBeenCalled();
    });

    it("should continue capturing after failure", async () => {
      const { chromium } = await import("playwright");
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

      // First page fails, second succeeds
      vi.mocked(mockPage.goto)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue(null);

      const config: Config = {
        baseUrl: "https://example.com",
        pages: [
          { path: "/broken", name: "broken-page" },
          { path: "/working", name: "working-page" },
        ],
        viewport: { width: 1440, height: 900 },
        waitDelay: 2000,
      };

      const results = await captureAllPages(config, "/output");

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Network error");
      expect(results[1].success).toBe(true);
    });
  });

  describe("T012: Wait delay respected before capture (P1)", () => {
    it("should wait for specified delay before screenshot", async () => {
      const pageConfig = { path: "/docs", name: "docs-page" };
      await captureScreenshot(
        mockPage,
        "https://example.com",
        pageConfig,
        "/output",
        3000,
      );

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(3000);
      const gotoCall = vi.mocked(mockPage.goto).mock.invocationCallOrder[0];
      const waitCall =
        vi.mocked(mockPage.waitForTimeout).mock.invocationCallOrder[0];
      const screenshotCall =
        vi.mocked(mockPage.screenshot).mock.invocationCallOrder[0];

      // Verify order: goto -> wait -> screenshot
      expect(gotoCall).toBeLessThan(waitCall);
      expect(waitCall).toBeLessThan(screenshotCall);
    });

    it("should use default delay of 2000ms when not specified", async () => {
      const { chromium } = await import("playwright");
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

      const config: Config = {
        baseUrl: "https://example.com",
        pages: [{ path: "/page", name: "page" }],
      };

      await captureAllPages(config, "/output");

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });
  });
});
