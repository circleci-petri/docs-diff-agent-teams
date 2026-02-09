#!/usr/bin/env node
import { Command } from "commander";
import { captureCommand } from "./commands/capture.js";
import { compareCommand } from "./commands/compare.js";
import { authCheckCommand } from "./commands/auth-check.js";

const program = new Command();

program
  .name("docs-screenshot-diff")
  .description("CLI tool to detect visual changes in product website pages")
  .version("0.1.0");

program
  .command("capture")
  .description("Capture baseline screenshots")
  .option("-c, --config <path>", "Config file path", "./config.json")
  .action(captureCommand);

program
  .command("compare")
  .description("Compare current screenshots against baselines")
  .option("-c, --config <path>", "Config file path", "./config.json")
  .option("-o, --output <path>", "Report output directory", "./report")
  .action(compareCommand);

program
  .command("auth-check")
  .description("Verify authentication works")
  .option("-c, --config <path>", "Config file path", "./config.json")
  .action(authCheckCommand);

program.parse();
