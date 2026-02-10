import { resolve } from "node:path";
import { chromium } from "playwright";
import { loadConfig } from "../core/config.js";
import { authenticate } from "../core/auth.js";

export async function loginCommand(options: {
  config: string;
}): Promise<void> {
  try {
    const configPath = resolve(options.config);
    const config = await loadConfig(configPath);

    if (!config.auth) {
      console.log("No auth configuration found in config file.");
      console.log('Add an "auth" section with at least a "loginUrl" to enable authentication.');
      return;
    }

    const browser = await chromium.launch({ headless: true });

    try {
      await authenticate(browser, config, { forceInteractive: true });
      console.log("\nLogin successful! Session saved for future runs.");
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("An unexpected error occurred");
    }
    process.exit(1);
  }
}
