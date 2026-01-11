/**
 * Environment Variable Manager
 *
 * Read, write, and hot reload .env files
 */

import fs from 'fs';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';

const ENV_PATH = path.join(process.cwd(), '.env');
const BACKUP_PATH = path.join(process.cwd(), '.env.backup');

/**
 * Read and parse the .env file into a Map
 */
export function readEnvFile(): Map<string, string> {
  const envMap = new Map<string, string>();

  if (!fs.existsSync(ENV_PATH)) {
    return envMap;
  }

  const content = fs.readFileSync(ENV_PATH, 'utf-8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE format
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1);

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) {
      envMap.set(key, value);
    }
  }

  return envMap;
}

/**
 * Write environment variables to .env file
 * Preserves comments and ordering from existing file
 */
export function writeEnvFile(envMap: Map<string, string>): void {
  // Create backup of existing file
  if (fs.existsSync(ENV_PATH)) {
    fs.copyFileSync(ENV_PATH, BACKUP_PATH);
  }

  const lines: string[] = [];
  const usedKeys = new Set<string>();

  // Preserve existing file structure if it exists
  if (fs.existsSync(ENV_PATH)) {
    const existing = fs.readFileSync(ENV_PATH, 'utf-8');

    for (const line of existing.split('\n')) {
      const trimmed = line.trim();

      // Keep comments and empty lines as-is
      if (!trimmed || trimmed.startsWith('#')) {
        lines.push(line);
        continue;
      }

      // Parse and replace existing keys
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        lines.push(line);
        continue;
      }

      const key = trimmed.slice(0, equalIndex).trim();

      if (key && envMap.has(key)) {
        const newValue = envMap.get(key)!;
        // Quote values with spaces or special characters
        const quotedValue = needsQuotes(newValue) ? `"${newValue}"` : newValue;
        lines.push(`${key}=${quotedValue}`);
        usedKeys.add(key);
      } else if (key) {
        // Keep keys that aren't in our map (preserve other env vars)
        lines.push(line);
      }
    }
  }

  // Add any new keys not in original file
  for (const [key, value] of envMap) {
    if (!usedKeys.has(key)) {
      const quotedValue = needsQuotes(value) ? `"${value}"` : value;
      lines.push(`${key}=${quotedValue}`);
    }
  }

  // Write with trailing newline
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}

/**
 * Check if a value needs to be quoted
 */
function needsQuotes(value: string): boolean {
  return value.includes(' ') ||
         value.includes('#') ||
         value.includes('"') ||
         value.includes("'") ||
         value.includes('\n');
}

/**
 * Reload environment variables from .env file
 * Updates process.env with new values
 */
export function reloadEnv(): void {
  if (!fs.existsSync(ENV_PATH)) {
    return;
  }

  // Node.js 20.6+ has native loadEnvFile
  if (typeof (process as any).loadEnvFile === 'function') {
    try {
      (process as any).loadEnvFile(ENV_PATH);
      return;
    } catch {
      // Fall back to manual reload
    }
  }

  // Fallback: use dotenv with override
  dotenvConfig({ path: ENV_PATH, override: true });
}

/**
 * Get a single environment variable value
 */
export function getEnvValue(key: string): string {
  // First check process.env (in case it was set after .env load)
  if (process.env[key]) {
    return process.env[key]!;
  }

  // Then check .env file
  const envMap = readEnvFile();
  return envMap.get(key) || '';
}

/**
 * Check if .env file exists
 */
export function envFileExists(): boolean {
  return fs.existsSync(ENV_PATH);
}

/**
 * Create a blank .env file with template
 */
export function createEnvTemplate(): void {
  const template = `# Leo - AI Blog Agent
# API Keys Configuration

# === CORE (Required) ===
ANTHROPIC_API_KEY=

# === RESEARCH ===
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
PERPLEXITY_API_KEY=
FIRECRAWL_API_KEY=

# === IMAGE GENERATION ===
OPENROUTER_API_KEY=

# === CMS (Sanity - optional) ===
SANITY_API_KEY=
SANITY_PROJECT_ID=
SANITY_DATASET=production
SANITY_STUDIO_URL=

# === QUEUE (Supabase - optional) ===
SUPABASE_ACCESS_TOKEN=

# === BLOG ===
BLOG_BASE_URL=
`;

  fs.writeFileSync(ENV_PATH, template);
}
