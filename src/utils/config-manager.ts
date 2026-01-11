/**
 * Config Manager
 *
 * Handles reading, writing, and managing leo.config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  LeoConfig,
  validateConfig,
  mergeWithDefaults,
  DEFAULT_CONFIG
} from '../types/config.js';

const CONFIG_FILE = 'leo.config.json';

/**
 * Get the path to the config file
 */
export function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILE);
}

/**
 * Check if config file exists
 */
export function configExists(): boolean {
  return fs.existsSync(getConfigPath());
}

/**
 * Load the configuration file
 */
export function loadConfig(): LeoConfig | null {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return mergeWithDefaults(parsed);
  } catch (error) {
    console.error('[Config] Failed to load config:', error);
    return null;
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: LeoConfig): void {
  const configPath = getConfigPath();

  // Update timestamp
  config.updatedAt = new Date().toISOString();

  // Validate before saving
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('[Config] Saved configuration to', configPath);
}

/**
 * Create a new configuration with defaults
 */
export function createConfig(userConfig: Partial<LeoConfig>): LeoConfig {
  const config = mergeWithDefaults({
    ...userConfig,
    createdAt: new Date().toISOString()
  });

  saveConfig(config);
  return config;
}

/**
 * Update existing configuration
 */
export function updateConfig(updates: Partial<LeoConfig>): LeoConfig {
  const existing = loadConfig();

  if (!existing) {
    throw new Error('No existing configuration found. Run onboarding first.');
  }

  const updated = mergeWithDefaults({
    ...existing,
    ...updates
  });

  saveConfig(updated);
  return updated;
}

/**
 * Add a category to the configuration
 */
export function addCategory(category: { slug: string; name: string; description?: string }): void {
  const config = loadConfig();

  if (!config) {
    throw new Error('No configuration found');
  }

  // Check for duplicates
  if (config.categories.some(c => c.slug === category.slug)) {
    throw new Error(`Category with slug "${category.slug}" already exists`);
  }

  config.categories.push(category);
  saveConfig(config);
}

/**
 * Add an internal link
 */
export function addInternalLink(link: {
  title: string;
  url: string;
  topics: string[];
  description?: string;
}): void {
  const config = loadConfig();

  if (!config) {
    throw new Error('No configuration found');
  }

  if (!config.internalLinks) {
    config.internalLinks = [];
  }

  // Check for duplicates
  if (config.internalLinks.some(l => l.url === link.url)) {
    console.log(`[Config] Updating existing link: ${link.url}`);
    config.internalLinks = config.internalLinks.filter(l => l.url !== link.url);
  }

  config.internalLinks.push(link);
  saveConfig(config);
}

/**
 * Get internal links by topic
 */
export function getInternalLinksByTopic(topics: string[]): Array<{
  title: string;
  url: string;
  description?: string;
}> {
  const config = loadConfig();

  if (!config || !config.internalLinks) {
    return [];
  }

  return config.internalLinks.filter(link =>
    link.topics.some(t => topics.includes(t.toLowerCase()))
  );
}

/**
 * Generate the system prompt additions from user config
 */
export function generateSystemPromptFromConfig(config: LeoConfig): string {
  const lines: string[] = [];

  lines.push('## Blog Configuration\n');
  lines.push(`**Blog Name**: ${config.blog.name}`);
  lines.push(`**Niche**: ${config.blog.niche}`);
  lines.push(`**Target Audience**: ${config.blog.targetAudience}`);
  lines.push(`**Brand Voice**: ${config.blog.brandVoice}`);
  lines.push(`**Base URL**: ${config.blog.baseUrl}`);
  if (config.blog.tagline) {
    lines.push(`**Tagline**: ${config.blog.tagline}`);
  }
  lines.push('');

  lines.push('## Author\n');
  lines.push(`**Name**: ${config.author.name}`);
  if (config.author.bio) {
    lines.push(`**Bio**: ${config.author.bio}`);
  }
  lines.push('');

  if (config.categories.length > 0) {
    lines.push('## Categories\n');
    config.categories.forEach(cat => {
      lines.push(`- **${cat.name}** (\`${cat.slug}\`)${cat.description ? `: ${cat.description}` : ''}`);
    });
    lines.push('');
  }

  if (config.writingStyle) {
    lines.push('## Writing Style\n');
    lines.push(`**Tone**: ${config.writingStyle.tone}`);
    lines.push(`**Point of View**: ${config.writingStyle.pointOfView}`);
    if (config.writingStyle.avoidPhrases.length > 0) {
      lines.push(`**Avoid**: ${config.writingStyle.avoidPhrases.join(', ')}`);
    }
    lines.push('');
  }

  if (config.imageStyle) {
    lines.push('## Image Style\n');
    lines.push(`**Style**: ${config.imageStyle.style}`);
    lines.push(`**Colors**: ${config.imageStyle.colorPalette}`);
    lines.push(`**Background**: ${config.imageStyle.background}`);
    lines.push(`**Theme**: ${config.imageStyle.theme}`);
    lines.push('');
  }

  if (config.internalLinks && config.internalLinks.length > 0) {
    lines.push('## Internal Links (for backlinking)\n');
    config.internalLinks.slice(0, 20).forEach(link => {
      lines.push(`- [${link.title}](${link.url}) - Topics: ${link.topics.join(', ')}`);
    });
    lines.push('');
  }

  if (config.customInstructions) {
    lines.push('## Custom Instructions\n');
    lines.push(config.customInstructions);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export config as markdown for agent context
 */
export function exportConfigAsMarkdown(): string {
  const config = loadConfig();

  if (!config) {
    return '# No Configuration\n\nRun `/setup` to configure Leo for your blog.';
  }

  return generateSystemPromptFromConfig(config);
}
