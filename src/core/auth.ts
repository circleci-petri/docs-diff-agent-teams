import type { Browser, BrowserContext } from 'playwright';
import type { Config } from '../types/index.js';

const DEFAULT_SESSION_PATH = '.auth/session.json';

/**
 * Authenticate and return a BrowserContext.
 * No-op if no auth config — returns plain context.
 */
export async function authenticate(
  _browser: Browser,
  _config: Config,
  _options: { forceInteractive?: boolean } = {},
): Promise<BrowserContext> {
  throw new Error('authenticate() not yet implemented');
}

/**
 * Check authentication by launching browser, authenticating, and closing.
 */
export async function checkAuth(_config: Config): Promise<void> {
  throw new Error('checkAuth() not yet implemented');
}

/**
 * Clear saved session file.
 */
export async function clearSession(_config: Config): Promise<void> {
  throw new Error('clearSession() not yet implemented');
}
