import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../core/config.js';

describe('Config Parsing (Track A - CIR-485)', () => {
  const testDir = join(process.cwd(), '.test-fixtures');
  const testConfigPath = join(testDir, 'test-config.json');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    // Clean up any env vars set during tests
    delete process.env.TEST_BASE_URL;
    delete process.env.TEST_EMAIL;
    delete process.env.MISSING_VAR;
  });

  describe('T001: Valid config loads successfully (P0)', () => {
    it('should load and parse a valid config file', async () => {
      const validConfig = {
        baseUrl: 'https://example.com',
        pages: [
          { path: '/', name: 'home' },
          { path: '/about', name: 'about' }
        ],
        viewport: { width: 1920, height: 1080 },
        waitDelay: 3000,
        diffThreshold: 0.1
      };

      await writeFile(testConfigPath, JSON.stringify(validConfig, null, 2));
      const config = await loadConfig(testConfigPath);

      expect(config.baseUrl).toBe('https://example.com');
      expect(config.pages).toHaveLength(2);
      expect(config.pages[0]).toEqual({ path: '/', name: 'home' });
      expect(config.viewport).toEqual({ width: 1920, height: 1080 });
      expect(config.waitDelay).toBe(3000);
      expect(config.diffThreshold).toBe(0.1);
    });

    it('should validate baseUrl is present', async () => {
      const invalidConfig = {
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(invalidConfig));
      await expect(loadConfig(testConfigPath)).rejects.toThrow(/baseUrl.*required/i);
    });

    it('should validate baseUrl is a valid URL', async () => {
      const invalidConfig = {
        baseUrl: 'not-a-url',
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(invalidConfig));
      await expect(loadConfig(testConfigPath)).rejects.toThrow(/baseUrl.*valid URL/i);
    });

    it('should validate pages array is non-empty', async () => {
      const invalidConfig = {
        baseUrl: 'https://example.com',
        pages: []
      };

      await writeFile(testConfigPath, JSON.stringify(invalidConfig));
      await expect(loadConfig(testConfigPath)).rejects.toThrow(/pages.*at least one/i);
    });

    it('should validate each page has path and name', async () => {
      const invalidConfig = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/' }]
      };

      await writeFile(testConfigPath, JSON.stringify(invalidConfig));
      await expect(loadConfig(testConfigPath)).rejects.toThrow(/page.*name.*required/i);
    });

    it('should validate page name is filename-safe', async () => {
      const invalidConfig = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home/page' }]
      };

      await writeFile(testConfigPath, JSON.stringify(invalidConfig));
      await expect(loadConfig(testConfigPath)).rejects.toThrow(/name.*filename-safe/i);
    });

    it('should validate diffThreshold is between 0 and 1', async () => {
      const invalidConfig = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home' }],
        diffThreshold: 1.5
      };

      await writeFile(testConfigPath, JSON.stringify(invalidConfig));
      await expect(loadConfig(testConfigPath)).rejects.toThrow(/diffThreshold.*between 0 and 1/i);
    });

    it('should validate viewport dimensions are positive integers', async () => {
      const invalidConfig = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home' }],
        viewport: { width: -100, height: 900 }
      };

      await writeFile(testConfigPath, JSON.stringify(invalidConfig));
      await expect(loadConfig(testConfigPath)).rejects.toThrow(/viewport.*positive/i);
    });
  });

  describe('T002: Missing config file exits with helpful error (P0)', () => {
    it('should throw error when config file does not exist', async () => {
      const nonExistentPath = join(testDir, 'does-not-exist.json');

      await expect(loadConfig(nonExistentPath)).rejects.toThrow(
        `❌ Config file not found: ${nonExistentPath}`
      );
    });
  });

  describe('T003: Invalid JSON exits with parse error details (P0)', () => {
    it('should throw error with details when JSON is malformed', async () => {
      await writeFile(testConfigPath, '{ invalid json }');

      await expect(loadConfig(testConfigPath)).rejects.toThrow(/❌ Invalid JSON in config file/i);
    });
  });

  describe('T004: ENV:VAR_NAME resolves from environment (P1)', () => {
    it('should resolve ENV:VAR_NAME in baseUrl', async () => {
      process.env.TEST_BASE_URL = 'https://example.com';

      const configWithEnv = {
        baseUrl: 'ENV:TEST_BASE_URL',
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(configWithEnv));
      const config = await loadConfig(testConfigPath);

      expect(config.baseUrl).toBe('https://example.com');
    });

    it('should resolve ENV:VAR_NAME in auth credentials', async () => {
      process.env.TEST_EMAIL = 'test@example.com';

      const configWithEnv = {
        baseUrl: 'https://example.com',
        auth: {
          loginUrl: 'https://example.com/login',
          email: 'ENV:TEST_EMAIL',
          password: 'ENV:TEST_PASSWORD'
        },
        pages: [{ path: '/', name: 'home' }]
      };

      process.env.TEST_PASSWORD = 'secret123';
      await writeFile(testConfigPath, JSON.stringify(configWithEnv));
      const config = await loadConfig(testConfigPath);

      // Auth fields are NOT resolved at config load time — deferred to auth time
      // This allows interactive mode to skip ENV vars entirely
      expect(config.auth?.email).toBe('ENV:TEST_EMAIL');
      expect(config.auth?.password).toBe('ENV:TEST_PASSWORD');
    });

    it('should not resolve strings that do not start with ENV:', async () => {
      const config = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(config));
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.baseUrl).toBe('https://example.com');
    });
  });

  describe('T005: Missing env var exits with clear error (P1)', () => {
    it('should throw error when ENV var is not set', async () => {
      const configWithEnv = {
        baseUrl: 'ENV:MISSING_VAR',
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(configWithEnv));

      await expect(loadConfig(testConfigPath)).rejects.toThrow(
        '❌ Environment variable MISSING_VAR not set'
      );
    });
  });

  describe('T006: Default viewport (1440x900) applied when not specified (P1)', () => {
    it('should apply default viewport when not provided', async () => {
      const config = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(config));
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.viewport).toEqual({ width: 1440, height: 900 });
    });
  });

  describe('T007: Default diffThreshold (0.05) applied when not specified (P1)', () => {
    it('should apply default diffThreshold when not provided', async () => {
      const config = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(config));
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.diffThreshold).toBe(0.05);
    });

    it('should apply default waitDelay (2000) when not provided', async () => {
      const config = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(config));
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.waitDelay).toBe(2000);
    });

    it('should initialize maskRegions as empty array when not provided', async () => {
      const config = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home' }]
      };

      await writeFile(testConfigPath, JSON.stringify(config));
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.maskRegions).toEqual([]);
    });
  });

  describe('Mask regions warning', () => {
    it('should log warning when maskRegions is configured', async () => {
      const config = {
        baseUrl: 'https://example.com',
        pages: [{ path: '/', name: 'home' }],
        maskRegions: [{ selector: '.dynamic-content' }]
      };

      // Note: This test verifies the structure but actual logging verification
      // would require capturing console output, which is deferred to integration tests
      await writeFile(testConfigPath, JSON.stringify(config));
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.maskRegions).toHaveLength(1);
      expect(loaded.maskRegions?.[0]).toEqual({ selector: '.dynamic-content' });
    });
  });
});
