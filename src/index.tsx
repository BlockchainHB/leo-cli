#!/usr/bin/env node
/**
 * Leo - AI Blog Writing Agent
 *
 * Create SEO-optimized blog content with Claude.
 * Built with Ink (React for terminals) for a polished experience.
 *
 * Usage:
 *   leo                    # Interactive mode (runs setup on first use)
 *   leo write "keyword"    # Write article for keyword
 *   leo write next         # Write next article in queue
 *   leo settings           # Configure API keys
 *   leo update             # Update to latest version
 *   leo --help             # Show help
 */

import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

// ─────────────────────────────────────────────────────────────────────────────
// CLI Arguments
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const isJsonMode = args.includes('--json') || args.includes('-j');
const showHelp = args.includes('--help') || args.includes('-h');
const showVersion = args.includes('--version') || args.includes('-v');

// Version from package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const version = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, 'utf-8')).version
  : '0.1.0';

if (showHelp) {
  console.log(`
Leo - AI Blog Writing Agent v${version}

Usage:
  leo [command] [options]

Commands:
  (none)              Start interactive mode (runs setup on first use)
  write <keyword>     Write article for a keyword
  write next          Write the next article in queue
  queue status        Show keyword queue status
  queue add "kw"      Add keyword to queue
  queue list          List pending keywords
  settings            Configure API keys
  update              Update Leo to latest version
  update check        Check for available updates
  reset               Reset Leo (delete config to re-run onboarding)
  reset --hard        Full reset (delete config, drafts, and cache)

Options:
  --json, -j          Output in JSON format (for automation)
  --help, -h          Show this help message
  --version, -v       Show version

Interactive Commands (inside Leo):
  /write-blog [keyword]  Research and write article
  /queue-status          View keyword queue
  /publish [slug]        Publish to CMS
  /settings              Configure API keys
  /sessions              List recent sessions
  /cost                  Show session costs
  /clear                 Clear conversation
  /help                  Show all commands

Examples:
  leo                           Start interactive mode
  leo write "how to start a blog"
  leo queue add "seo tips 2025"
  leo settings
  leo update

Documentation: https://github.com/anthropics/leo
`);
  process.exit(0);
}

if (showVersion) {
  console.log(`Leo v${version}`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Config & Environment Check
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_FILE = 'leo.config.json';

function configExists(): boolean {
  return fs.existsSync(path.join(process.cwd(), CONFIG_FILE));
}

function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Export for use by App
export const JSON_OUTPUT_MODE = isJsonMode;
export const NEEDS_ONBOARDING = !configExists();
export const NEEDS_API_KEY = !hasAnthropicKey();

// ─────────────────────────────────────────────────────────────────────────────
// Handle CLI Commands
// ─────────────────────────────────────────────────────────────────────────────

async function handleCommand() {
  switch (command) {
    case 'reset': {
      const isHard = args.includes('--hard');
      const configPath = path.join(process.cwd(), CONFIG_FILE);

      console.log('\n\x1b[38;2;249;115;22m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
      console.log('\x1b[1m  Leo Reset\x1b[0m');
      console.log('\x1b[38;2;249;115;22m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

      // Delete config file
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
        console.log('  \x1b[32m✓\x1b[0m Deleted leo.config.json');
      } else {
        console.log('  \x1b[33m○\x1b[0m No config file found');
      }

      // Delete progress file
      const progressPath = path.join(process.cwd(), 'blog-progress.json');
      if (fs.existsSync(progressPath)) {
        fs.unlinkSync(progressPath);
        console.log('  \x1b[32m✓\x1b[0m Deleted blog-progress.json');
      }

      if (isHard) {
        // Delete drafts folder
        const draftsPath = path.join(process.cwd(), 'drafts');
        if (fs.existsSync(draftsPath)) {
          fs.rmSync(draftsPath, { recursive: true });
          console.log('  \x1b[32m✓\x1b[0m Deleted drafts/ folder');
        }

        // Delete images folder
        const imagesPath = path.join(process.cwd(), 'images');
        if (fs.existsSync(imagesPath)) {
          fs.rmSync(imagesPath, { recursive: true });
          console.log('  \x1b[32m✓\x1b[0m Deleted images/ folder');
        }

        // Delete keywords.json
        const keywordsPath = path.join(process.cwd(), 'keywords.json');
        if (fs.existsSync(keywordsPath)) {
          fs.unlinkSync(keywordsPath);
          console.log('  \x1b[32m✓\x1b[0m Deleted keywords.json');
        }
      }

      console.log('\n  \x1b[32m✨ Reset complete!\x1b[0m');
      console.log('  Run \x1b[38;2;249;115;22mleo\x1b[0m to start fresh with onboarding.\n');
      return true;
    }

    case 'update': {
      const { performUpdate, showUpdateStatus } = await import('./cli/update.js');
      if (args[1] === 'check') {
        await showUpdateStatus();
      } else {
        const result = await performUpdate();
        console.log(result.message);
        process.exit(result.success ? 0 : 1);
      }
      return true;
    }

    case 'queue': {
      // Delegate to queue CLI
      const subcommand = args[1] || 'status';
      const queueArgs = args.slice(2);

      process.argv = ['node', 'queue.ts', subcommand, ...queueArgs];
      await import('./cli/queue.js');
      return true;
    }

    case 'settings': {
      // Will be handled by App with settings screen
      return false;
    }

    case 'write': {
      // Will be handled by App with write command
      return false;
    }

    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // Handle CLI commands that don't need the UI
  if (command && await handleCommand()) {
    return;
  }

  // Onboarding messages now handled by OnboardingWizard component

  // JSON mode
  if (isJsonMode) {
    console.log(JSON.stringify({
      status: 'ready',
      version,
      needsOnboarding: NEEDS_ONBOARDING,
      needsApiKey: NEEDS_API_KEY,
      commands: ['/write-blog', '/queue-status', '/publish', '/settings', '/help', '/quit']
    }));

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data) => {
      const input = data.toString().trim();
      if (input === '/quit' || input === 'exit') {
        console.log(JSON.stringify({ status: 'exit', message: 'Goodbye!' }));
        process.exit(0);
      }
      console.log(JSON.stringify({
        status: 'received',
        command: input,
        message: 'Processing...'
      }));
    });
    return;
  }

  // Normal interactive mode
  const { App } = await import('./ui/App.js');

  render(<App />, {
    patchConsole: false
  });
}

main().catch(error => {
  console.error('\x1b[31mFatal error:\x1b[0m', error.message);
  process.exit(1);
});
