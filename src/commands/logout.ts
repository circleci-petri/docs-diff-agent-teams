import { resolve } from "node:path";
import { loadConfig } from "../core/config.js";
import { clearSession } from "../core/auth.js";

export async function logoutCommand(options: {
  config: string;
}): Promise<void> {
  try {
    const configPath = resolve(options.config);
    const config = await loadConfig(configPath);

    await clearSession(config);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("An unexpected error occurred");
    }
    process.exit(1);
  }
}
