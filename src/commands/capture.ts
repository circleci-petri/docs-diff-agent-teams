import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../core/config.js";
import { captureAllPages } from "../core/screenshot.js";

export async function captureCommand(options: {
  config: string;
}): Promise<void> {
  try {
    // Load and validate config
    const configPath = resolve(options.config);
    const config = await loadConfig(configPath);

    // Create output directory if it doesn't exist
    const outputDir = resolve("./screenshots");
    mkdirSync(outputDir, { recursive: true });

    // Capture all screenshots
    console.log("📸 Capturing baseline screenshots...");
    const results = await captureAllPages(config, outputDir);

    // Log summary
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    if (failureCount > 0) {
      console.log(
        `\n✓ Captured ${successCount} screenshots (${failureCount} failed)`,
      );
      process.exit(1);
    } else {
      console.log(`\n✓ Captured ${successCount} screenshots`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("❌ An unexpected error occurred");
    }
    process.exit(1);
  }
}
