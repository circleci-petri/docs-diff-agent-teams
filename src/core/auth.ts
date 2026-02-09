import type { Browser, BrowserContext } from 'playwright';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Config } from '../types/index.js';
import { resolveEnvValue } from './config.js';

const DEFAULT_SESSION_PATH = '.auth/session.json';

const DEFAULT_AUTH_SELECTORS = {
  email: 'input[type="email"], input[name="email"]',
  password: 'input[type="password"]',
  submit: 'button[type="submit"]',
};

/**
 * Authenticate and return a BrowserContext.
 * If no auth config, returns a plain browser context (no-op).
 * If session file exists, tries to restore it first.
 * Falls back to interactive or automated mode as configured.
 */
export async function authenticate(
  browser: Browser,
  config: Config,
  options: { forceInteractive?: boolean } = {},
): Promise<BrowserContext> {
  if (!config.auth) {
    return browser.newContext({
      viewport: config.viewport,
    });
  }

  const sessionPath = resolve(config.auth.sessionPath || DEFAULT_SESSION_PATH);
  const mode = options.forceInteractive ? 'interactive' : (config.auth.mode || 'interactive');

  // Try to restore existing session first
  if (existsSync(sessionPath)) {
    console.log('Found existing session, attempting to restore...');
    try {
      const context = await browser.newContext({
        viewport: config.viewport,
        storageState: sessionPath,
      });

      // Validate session by navigating to a page
      const testPage = await context.newPage();
      const testUrl = `${config.baseUrl}${config.pages[0]?.path || '/'}`;
      await testPage.goto(testUrl, { waitUntil: 'load', timeout: 30000 });

      // Check if we got redirected to login page
      const currentUrl = testPage.url();

      if (!currentUrl.includes(config.auth.loginUrl)) {
        console.log('Session restored successfully');
        await testPage.close();
        return context;
      }

      console.log('Session expired, need to re-authenticate...');
      await testPage.close();
      await context.close();
    } catch {
      console.log('Failed to restore session, re-authenticating...');
    }
  }

  // Need fresh authentication
  if (mode === 'interactive') {
    return authenticateInteractive(browser, config, sessionPath);
  }
  return authenticateAutomated(browser, config, sessionPath);
}

/**
 * Interactive auth: opens a headed browser for manual login.
 */
async function authenticateInteractive(
  browser: Browser,
  config: Config,
  sessionPath: string,
): Promise<BrowserContext> {
  const { chromium } = await import('playwright');

  console.log('\nInteractive login required');
  console.log('A browser window will open. Please log in manually.');
  console.log('The window will close automatically once login is detected.\n');

  const headedBrowser = await chromium.launch({ headless: false });
  const context = await headedBrowser.newContext({
    viewport: config.viewport,
  });

  const page = await context.newPage();
  const loginUrl = `${config.baseUrl}${config.auth!.loginUrl}`;

  await page.goto(loginUrl, { waitUntil: 'load' });

  const successIndicator = config.auth!.successIndicator;

  console.log('Waiting for you to log in...');

  try {
    if (successIndicator) {
      await page.waitForSelector(successIndicator, { timeout: 300000 });
    } else {
      await page.waitForURL(
        (url) => !url.pathname.includes(config.auth!.loginUrl),
        { timeout: 300000 },
      );
    }

    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);

    console.log('Login detected!');

    await saveSession(context, sessionPath);
    await page.close();
    await headedBrowser.close();

    // Create new context on original browser with saved state
    return browser.newContext({
      viewport: config.viewport,
      storageState: sessionPath,
    });
  } catch {
    await headedBrowser.close();
    throw new Error('Login timed out. Please try again.');
  }
}

/**
 * Automated auth: fills credentials and submits login form.
 * Resolves ENV:VAR_NAME in password at auth time (not config load time).
 * NEVER logs the resolved password value.
 */
async function authenticateAutomated(
  browser: Browser,
  config: Config,
  sessionPath: string,
): Promise<BrowserContext> {
  if (!config.auth!.email || !config.auth!.password) {
    throw new Error(
      'Automated auth mode requires "email" and "password" in config. '
      + 'Use mode: "interactive" for manual login.',
    );
  }

  const context = await browser.newContext({
    viewport: config.viewport,
  });

  const page = await context.newPage();

  try {
    const loginUrl = `${config.baseUrl}${config.auth!.loginUrl}`;
    console.log(`Navigating to login page: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'load' });

    // Get selectors with defaults
    const selectors = {
      ...DEFAULT_AUTH_SELECTORS,
      ...config.auth!.selectors,
    };

    console.log('Filling email...');
    await page.fill(selectors.email, config.auth!.email);

    console.log('Filling password...');
    // Resolve ENV:VAR_NAME at auth time — NEVER log the resolved value
    const password = resolveEnvValue(config.auth!.password);
    await page.fill(selectors.password, password);

    console.log('Submitting login form...');
    await page.click(selectors.submit);

    await page.waitForLoadState('load');

    console.log('Authenticated successfully');

    // Save session for future use
    await saveSession(context, sessionPath);

    await page.close();
    return context;
  } catch (error) {
    await context.close();
    throw new Error(
      `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Save browser session state to file for future restoration.
 */
async function saveSession(context: BrowserContext, sessionPath: string): Promise<void> {
  const dir = dirname(sessionPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  await context.storageState({ path: sessionPath });
  console.log(`Session saved to ${sessionPath}`);
}

/**
 * Check authentication by launching a browser, authenticating, and closing.
 * Throws on failure.
 */
export async function checkAuth(config: Config): Promise<void> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });

  try {
    await authenticate(browser, config);
    console.log('\nAuthentication check passed');
  } finally {
    await browser.close();
  }
}

/**
 * Clear saved session file.
 */
export async function clearSession(config: Config): Promise<void> {
  const sessionPath = resolve(config.auth?.sessionPath || DEFAULT_SESSION_PATH);

  if (existsSync(sessionPath)) {
    unlinkSync(sessionPath);
    console.log(`Session cleared: ${sessionPath}`);
  } else {
    console.log('No session file to clear');
  }
}
