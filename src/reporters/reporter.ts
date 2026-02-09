import type { Reporter } from '../types/index.js';

const reporters = new Map<string, Reporter>();

/**
 * Register a reporter for use
 */
export function registerReporter(reporter: Reporter): void {
  reporters.set(reporter.name, reporter);
}

/**
 * Get a registered reporter by name
 */
export function getReporter(name: string): Reporter | undefined {
  return reporters.get(name);
}
