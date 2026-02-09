import { readFile } from 'node:fs/promises';
import { Config } from '../types/index.js';

/**
 * Resolve environment variable references in the format ENV:VAR_NAME
 */
export function resolveEnvValue(value: string): string {
  if (!value.startsWith('ENV:')) {
    return value;
  }

  const envVarName = value.slice(4); // Remove 'ENV:' prefix
  const envValue = process.env[envVarName];

  if (!envValue) {
    throw new Error(`❌ Environment variable ${envVarName} not set`);
  }

  return envValue;
}

/**
 * Recursively resolve ENV:VAR_NAME references in an object
 */
function resolveEnvInObject(obj: any): any {
  if (typeof obj === 'string') {
    return resolveEnvValue(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(resolveEnvInObject);
  }

  if (obj !== null && typeof obj === 'object') {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveEnvInObject(value);
    }
    return resolved;
  }

  return obj;
}

/**
 * Validate that a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a string is filename-safe (no path separators or special chars)
 */
function isFilenameSafe(name: string): boolean {
  // Check for path separators and other problematic characters
  const unsafeChars = /[\/\\:*?"<>|]/;
  return !unsafeChars.test(name);
}

/**
 * Validate the loaded configuration
 */
function validateConfig(config: any): void {
  // Validate baseUrl
  if (!config.baseUrl) {
    throw new Error('❌ Config validation failed: baseUrl is required');
  }

  if (!isValidUrl(config.baseUrl)) {
    throw new Error('❌ Config validation failed: baseUrl must be a valid URL');
  }

  // Validate pages
  if (!Array.isArray(config.pages)) {
    throw new Error('❌ Config validation failed: pages must be an array');
  }

  if (config.pages.length === 0) {
    throw new Error('❌ Config validation failed: pages must contain at least one page');
  }

  for (let i = 0; i < config.pages.length; i++) {
    const page = config.pages[i];

    if (!page.path) {
      throw new Error(`❌ Config validation failed: page at index ${i} must have a path`);
    }

    if (!page.name) {
      throw new Error(`❌ Config validation failed: page at index ${i} must have a name (required)`);
    }

    if (!isFilenameSafe(page.name)) {
      throw new Error(
        `❌ Config validation failed: page name "${page.name}" must be filename-safe (no /\\:*?"<>| characters)`
      );
    }
  }

  // Validate diffThreshold if present
  if (config.diffThreshold !== undefined) {
    if (
      typeof config.diffThreshold !== 'number' ||
      config.diffThreshold < 0 ||
      config.diffThreshold > 1
    ) {
      throw new Error('❌ Config validation failed: diffThreshold must be between 0 and 1');
    }
  }

  // Validate viewport if present
  if (config.viewport !== undefined) {
    if (
      !config.viewport.width ||
      !config.viewport.height ||
      config.viewport.width <= 0 ||
      config.viewport.height <= 0
    ) {
      throw new Error(
        '❌ Config validation failed: viewport dimensions must be positive integers'
      );
    }
  }
}

/**
 * Apply default values to configuration
 */
function applyDefaults(config: any): Config {
  return {
    ...config,
    viewport: config.viewport || { width: 1440, height: 900 },
    waitDelay: config.waitDelay ?? 2000,
    diffThreshold: config.diffThreshold ?? 0.05,
    maskRegions: config.maskRegions || []
  } as Config;
}

/**
 * Load and parse configuration from a JSON file
 * @param configPath - Absolute path to the config file
 * @returns Parsed and validated configuration with defaults applied
 */
export async function loadConfig(configPath: string): Promise<Config> {
  // Read file
  let fileContent: string;
  try {
    fileContent = await readFile(configPath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`❌ Config file not found: ${configPath}`);
    }
    throw error;
  }

  // Parse JSON
  let rawConfig: any;
  try {
    rawConfig = JSON.parse(fileContent);
  } catch (error: any) {
    throw new Error(`❌ Invalid JSON in config file: ${error.message}`);
  }

  // Resolve environment variables
  const resolvedConfig = resolveEnvInObject(rawConfig);

  // Validate configuration
  validateConfig(resolvedConfig);

  // Apply defaults
  const config = applyDefaults(resolvedConfig);

  // Log warning if maskRegions are configured
  if (config.maskRegions && config.maskRegions.length > 0) {
    console.log('⚠️  Mask regions configured but not yet implemented. Screenshots will include masked areas.');
  }

  return config;
}
