import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { join } from "node:path";
import type { Config } from "../types/index.js";

export interface CaptureResult {
  page: string;
  path: string;
  success: boolean;
  error?: string;
  screenshotPath?: string;
}

/**
 * Create a headless Chromium browser instance
 */
export async function createBrowser(): Promise<Browser> {
  return await chromium.launch({ headless: true });
}

/**
 * Create a new page with specified viewport
 */
export async function createPage(
  browser: Browser,
  viewport: { width: number; height: number },
): Promise<Page> {
  const context = await browser.newContext({ viewport });
  return await context.newPage();
}

/**
 * Capture a screenshot of a single page
 * NEVER crashes - returns error in result if capture fails
 */
export async function captureScreenshot(
  page: Page,
  baseUrl: string,
  pageConfig: { path: string; name: string },
  outputDir: string,
  waitDelay: number,
  removeElements?: string[],
): Promise<CaptureResult> {
  const result: CaptureResult = {
    page: pageConfig.name,
    path: pageConfig.path,
    success: false,
  };

  try {
    const url = `${baseUrl}${pageConfig.path}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(waitDelay);

    // Remove unwanted DOM elements before screenshot
    if (removeElements && removeElements.length > 0) {
      for (const selector of removeElements) {
        await page.evaluate((sel: string) => {
          const elements = document.querySelectorAll(sel);
          elements.forEach((el) => el.remove());
        }, selector);
      }
    }

    const screenshotPath = join(outputDir, `${pageConfig.name}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: false, // viewport only!
    });

    result.success = true;
    result.screenshotPath = screenshotPath;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

/**
 * Capture all pages from config
 * Logs progress and warnings
 * If externalContext is provided, it is used instead of creating a new browser.
 * The caller is responsible for closing the external context/browser.
 */
export async function captureAllPages(
  config: Config,
  outputDir: string,
  externalContext?: BrowserContext,
): Promise<CaptureResult[]> {
  const viewport = config.viewport || { width: 1440, height: 900 };
  const waitDelay = config.waitDelay ?? 2000;

  // Log warning if maskRegions is configured
  if (config.maskRegions && config.maskRegions.length > 0) {
    console.log(
      `⚠️  Mask regions configured but not yet implemented. Screenshots will include masked areas.`,
    );
  }

  // Use external context if provided, otherwise create browser internally
  let browser: Browser | null = null;
  let page: Page;

  if (externalContext) {
    page = await externalContext.newPage();
  } else {
    browser = await createBrowser();
    page = await createPage(browser, viewport);
  }

  const results: CaptureResult[] = [];

  try {
    const total = config.pages.length;
    for (let i = 0; i < config.pages.length; i++) {
      const pageConfig = config.pages[i];
      const progress = `  [${i + 1}/${total}]`;

      const result = await captureScreenshot(
        page,
        config.baseUrl,
        pageConfig,
        outputDir,
        waitDelay,
        config.removeElements,
      );
      results.push(result);

      if (result.success) {
        console.log(`${progress} ${pageConfig.name} ✓`);
      } else {
        console.log(`${progress} ${pageConfig.name} ✗ - ${result.error}`);
      }
    }
  } finally {
    await page.close();
    // Only close browser if we created it internally
    if (browser) {
      await browser.close();
    }
  }

  return results;
}
