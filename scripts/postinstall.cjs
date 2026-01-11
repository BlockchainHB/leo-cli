#!/usr/bin/env node
/**
 * Post-installation script
 *
 * Runs after npm install to:
 * 1. Display welcome message
 * 2. Check for required dependencies
 * 3. Prompt for first-time setup
 */

const fs = require('fs');
const path = require('path');

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function printBanner() {
  console.log('');
  log('  _                ', CYAN);
  log(' | |    ___  ___   ', CYAN);
  log(' | |   / _ \\/ _ \\  ', CYAN);
  log(' | |__|  __/ (_) | ', CYAN);
  log(' |_____\\___|\\___/  ', CYAN);
  console.log('');
  log(`${BOLD}AI Blog Writing Agent${RESET}`, GREEN);
  console.log('');
}

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major < 18) {
    log(`${YELLOW}Warning: Node.js ${version} detected. Leo requires Node.js 18+${RESET}`);
    return false;
  }

  return true;
}

function checkConfigExists() {
  const configPath = path.join(process.cwd(), 'leo.config.json');
  return fs.existsSync(configPath);
}

function printNextSteps() {
  console.log('');
  log(`${BOLD}Installation complete!${RESET}`, GREEN);
  console.log('');

  if (!checkConfigExists()) {
    log('Get started by running:', CYAN);
    console.log('');
    log('  npx leo', BOLD);
    console.log('');
    log('This will guide you through the setup process.', RESET);
  } else {
    log('Leo is configured and ready to use!', GREEN);
    console.log('');
    log('Quick commands:', CYAN);
    console.log('');
    log('  leo              Start Leo', RESET);
    log('  leo write next   Write next article in queue', RESET);
    log('  leo settings     Configure API keys', RESET);
    log('  leo help         Show all commands', RESET);
  }

  console.log('');
  log('Documentation: https://github.com/anthropics/leo', CYAN);
  console.log('');
}

function main() {
  // Only run in interactive terminal
  if (!process.stdout.isTTY) {
    return;
  }

  printBanner();

  if (!checkNodeVersion()) {
    console.log('');
  }

  printNextSteps();
}

try {
  main();
} catch (error) {
  // Silently fail - don't block installation
  process.exit(0);
}
