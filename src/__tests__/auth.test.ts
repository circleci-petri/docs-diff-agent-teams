import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { Config } from '../types/index.js';

// Mock playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('Auth Module (Track E - CIR-489)', () => {
  let mockBrowser: Browser;
  let mockContext: BrowserContext;
  let mockPage: Page;

  const baseConfig: Config = {
    baseUrl: 'https://example.com',
    pages: [{ path: '/dashboard', name: 'dashboard' }],
    viewport: { width: 1440, height: 900 },
    waitDelay: 2000,
    diffThreshold: 0.05,
  };

  const authConfig: Config = {
    ...baseConfig,
    auth: {
      loginUrl: '/login',
      email: 'test@example.com',
      password: 'secret123',
      mode: 'automated',
      selectors: {
        email: 'input[type="email"]',
        password: 'input[type="password"]',
        submit: 'button[type="submit"]',
      },
    },
  };

  beforeEach(() => {
    vi.resetModules();

    // Setup mock page
    mockPage = {
      goto: vi.fn().mockResolvedValue(null),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(null),
      waitForURL: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
      close: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://example.com/dashboard'),
      fill: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;

    // Setup mock context
    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
      storageState: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext;

    // Setup mock browser
    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Browser;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    delete process.env.TEST_AUTH_PASSWORD;
  });

  describe('T029: No auth config returns plain context (P0)', () => {
    it('should return a plain browser context when no auth is configured', async () => {
      const { authenticate } = await import('../core/auth.js');

      const context = await authenticate(mockBrowser, baseConfig);

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1440, height: 900 },
      });
      expect(context).toBe(mockContext);
    });

    it('should not attempt session restoration when no auth configured', async () => {
      const { existsSync } = await import('node:fs');
      const { authenticate } = await import('../core/auth.js');

      await authenticate(mockBrowser, baseConfig);

      expect(existsSync).not.toHaveBeenCalled();
    });
  });

  describe('T030: Automated mode fills selectors and submits (P0)', () => {
    it('should fill email, password and submit in automated mode', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { authenticate } = await import('../core/auth.js');

      const context = await authenticate(mockBrowser, authConfig);

      // Should navigate to login URL
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com/login',
        expect.objectContaining({ waitUntil: 'load' })
      );

      // Should fill email and password
      expect(mockPage.fill).toHaveBeenCalledWith('input[type="email"]', 'test@example.com');
      expect(mockPage.fill).toHaveBeenCalledWith('input[type="password"]', 'secret123');

      // Should click submit
      expect(mockPage.click).toHaveBeenCalledWith('button[type="submit"]');

      // Should wait for page load
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('load');

      expect(context).toBe(mockContext);
    });
  });

  describe('T031: Custom selectors used from config (P1)', () => {
    it('should use custom selectors when provided', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const customConfig: Config = {
        ...baseConfig,
        auth: {
          loginUrl: '/login',
          email: 'user@test.com',
          password: 'pass123',
          mode: 'automated',
          selectors: {
            email: 'input[name="login"]',
            password: '#password-field',
            submit: '.login-btn',
          },
        },
      };

      const { authenticate } = await import('../core/auth.js');
      await authenticate(mockBrowser, customConfig);

      expect(mockPage.fill).toHaveBeenCalledWith('input[name="login"]', 'user@test.com');
      expect(mockPage.fill).toHaveBeenCalledWith('#password-field', 'pass123');
      expect(mockPage.click).toHaveBeenCalledWith('.login-btn');
    });
  });

  describe('T032: Default selectors applied when not specified (P1)', () => {
    it('should use default selectors when none provided', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const configNoSelectors: Config = {
        ...baseConfig,
        auth: {
          loginUrl: '/login',
          email: 'user@test.com',
          password: 'pass123',
          mode: 'automated',
        },
      };

      const { authenticate } = await import('../core/auth.js');
      await authenticate(mockBrowser, configNoSelectors);

      // Default selectors: input[type="email"], input[type="password"], button[type="submit"]
      expect(mockPage.fill).toHaveBeenCalledWith(
        'input[type="email"], input[name="email"]',
        'user@test.com'
      );
      expect(mockPage.fill).toHaveBeenCalledWith('input[type="password"]', 'pass123');
      expect(mockPage.click).toHaveBeenCalledWith('button[type="submit"]');
    });
  });

  describe('T033: Session saved after login (P1)', () => {
    it('should save session state to file after successful login', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { authenticate } = await import('../core/auth.js');
      await authenticate(mockBrowser, authConfig);

      // Should call storageState to save session
      expect(mockContext.storageState).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('session.json') })
      );
    });

    it('should create .auth directory if it does not exist', async () => {
      const { existsSync, mkdirSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { authenticate } = await import('../core/auth.js');
      await authenticate(mockBrowser, authConfig);

      expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('T034: Session restored on next run (P1)', () => {
    it('should restore session from file when it exists and is valid', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      // Simulate valid session: URL does not redirect to login
      vi.mocked(mockPage.url).mockReturnValue('https://example.com/dashboard');

      const { authenticate } = await import('../core/auth.js');
      await authenticate(mockBrowser, authConfig);

      // Should create context with storageState
      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          storageState: expect.stringContaining('session.json'),
        })
      );

      // Should NOT fill email/password (session was restored)
      expect(mockPage.fill).not.toHaveBeenCalled();
    });
  });

  describe('T035: Expired session re-authenticates (P1)', () => {
    it('should re-authenticate when session is expired (redirects to login)', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      // First call with storageState: simulate redirect to login page (expired)
      const expiredContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
        storageState: vi.fn().mockResolvedValue(undefined),
      } as unknown as BrowserContext;

      // Second call without storageState: fresh auth context
      const freshContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
        storageState: vi.fn().mockResolvedValue(undefined),
      } as unknown as BrowserContext;

      vi.mocked(mockBrowser.newContext)
        .mockResolvedValueOnce(expiredContext)  // Session restore attempt
        .mockResolvedValueOnce(freshContext);    // Fresh auth

      // On session restore test page, URL includes login (session expired)
      vi.mocked(mockPage.url).mockReturnValue('https://example.com/login?redirect=dashboard');

      const { authenticate } = await import('../core/auth.js');
      const context = await authenticate(mockBrowser, authConfig);

      // Should have closed the expired context
      expect(expiredContext.close).toHaveBeenCalled();

      // Should have performed fresh authentication
      expect(mockPage.fill).toHaveBeenCalled();
      expect(context).toBe(freshContext);
    });
  });

  describe('T036: auth-check reports success/failure (P0)', () => {
    it('should launch browser, authenticate, and close on success', async () => {
      const { chromium } = await import('playwright');
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { checkAuth } = await import('../core/auth.js');

      await expect(checkAuth(authConfig)).resolves.not.toThrow();
      expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should throw and still close browser on auth failure', async () => {
      const { chromium } = await import('playwright');
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      // Make authentication fail
      vi.mocked(mockPage.goto).mockRejectedValue(new Error('Connection refused'));

      const { checkAuth } = await import('../core/auth.js');

      await expect(checkAuth(authConfig)).rejects.toThrow(/Authentication failed/);
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('T037: clearSession deletes session file (P0)', () => {
    it('should delete session file when it exists', async () => {
      const { existsSync, unlinkSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const { clearSession } = await import('../core/auth.js');
      await clearSession(authConfig);

      expect(unlinkSync).toHaveBeenCalledWith(expect.stringContaining('session.json'));
    });

    it('should not throw when session file does not exist', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { clearSession } = await import('../core/auth.js');

      await expect(clearSession(authConfig)).resolves.not.toThrow();
    });

    it('should use custom sessionPath from config', async () => {
      const { existsSync, unlinkSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const customConfig: Config = {
        ...baseConfig,
        auth: {
          ...authConfig.auth!,
          sessionPath: '.auth/custom-session.json',
        },
      };

      const { clearSession } = await import('../core/auth.js');
      await clearSession(customConfig);

      expect(unlinkSync).toHaveBeenCalledWith(expect.stringContaining('custom-session.json'));
    });
  });

  describe('T038: ENV:VAR_NAME resolved for password at auth time (P0)', () => {
    it('should resolve ENV:VAR_NAME for password during authentication', async () => {
      process.env.TEST_AUTH_PASSWORD = 'resolved-secret';
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const envConfig: Config = {
        ...baseConfig,
        auth: {
          loginUrl: '/login',
          email: 'test@example.com',
          password: 'ENV:TEST_AUTH_PASSWORD',
          mode: 'automated',
          selectors: {
            email: 'input[type="email"]',
            password: 'input[type="password"]',
            submit: 'button[type="submit"]',
          },
        },
      };

      const { authenticate } = await import('../core/auth.js');
      await authenticate(mockBrowser, envConfig);

      // Password should be resolved from env var
      expect(mockPage.fill).toHaveBeenCalledWith('input[type="password"]', 'resolved-secret');
    });

    it('should throw when referenced env var is not set', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const envConfig: Config = {
        ...baseConfig,
        auth: {
          loginUrl: '/login',
          email: 'test@example.com',
          password: 'ENV:NONEXISTENT_VAR',
          mode: 'automated',
          selectors: {
            email: 'input[type="email"]',
            password: 'input[type="password"]',
            submit: 'button[type="submit"]',
          },
        },
      };

      const { authenticate } = await import('../core/auth.js');

      await expect(authenticate(mockBrowser, envConfig)).rejects.toThrow(/NONEXISTENT_VAR/);
    });
  });

  describe('T039: Auth failure throws clear error (P0)', () => {
    it('should throw descriptive error when login page navigation fails', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      vi.mocked(mockPage.goto).mockRejectedValue(new Error('ERR_CONNECTION_REFUSED'));

      const { authenticate } = await import('../core/auth.js');

      await expect(authenticate(mockBrowser, authConfig)).rejects.toThrow(
        /Authentication failed.*ERR_CONNECTION_REFUSED/
      );
    });

    it('should throw descriptive error when form fill fails', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      vi.mocked(mockPage.fill).mockRejectedValue(new Error('Element not found'));

      const { authenticate } = await import('../core/auth.js');

      await expect(authenticate(mockBrowser, authConfig)).rejects.toThrow(
        /Authentication failed.*Element not found/
      );
    });

    it('should throw when automated mode lacks credentials', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const noCredsConfig: Config = {
        ...baseConfig,
        auth: {
          loginUrl: '/login',
          email: '',
          password: '',
          mode: 'automated',
        },
      };

      const { authenticate } = await import('../core/auth.js');

      await expect(authenticate(mockBrowser, noCredsConfig)).rejects.toThrow(
        /email.*password/i
      );
    });
  });

  describe('T040: removeElements strips DOM elements before capture (P1)', () => {
    it('should remove elements matching configured selectors before screenshot', async () => {
      const { chromium } = await import('playwright');
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

      const configWithRemove: Config = {
        ...baseConfig,
        removeElements: ['.cookie-banner', '#dynamic-ad'],
      };

      // Import captureAllPages and test removeElements support
      const { captureAllPages } = await import('../core/screenshot.js');
      await captureAllPages(configWithRemove, '/output');

      // Should have called evaluate to remove elements
      expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should not call evaluate when removeElements is not configured', async () => {
      const { chromium } = await import('playwright');
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

      const { captureAllPages } = await import('../core/screenshot.js');
      await captureAllPages(baseConfig, '/output');

      // evaluate should not be called for removeElements
      expect(mockPage.evaluate).not.toHaveBeenCalled();
    });
  });
});
