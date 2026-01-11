/**
 * API Key Settings Types
 *
 * Configuration schema for managing external service API keys.
 * Open-source version: Only Anthropic API key is truly required.
 */

export interface ApiKeyConfig {
  key: string;           // ENV var name (e.g., 'ANTHROPIC_API_KEY')
  label: string;         // Display name (e.g., 'Anthropic API Key')
  required: boolean;     // Is it required for Leo to function?
  description: string;   // Help text
  category: 'core' | 'research' | 'publishing';
  valuePrefix?: string;  // Expected prefix (e.g., 'sk-ant-')
  helpUrl?: string;      // URL to get the key
}

export type KeyStatus = 'valid' | 'invalid' | 'untested' | 'testing';

export interface ApiKeyState {
  config: ApiKeyConfig;
  value: string;
  status: KeyStatus;
  error?: string;
}

/**
 * API Keys Configuration
 *
 * Defines all external service API keys that Leo can use.
 * Only ANTHROPIC_API_KEY is required - all others are optional.
 */
export const API_KEYS: ApiKeyConfig[] = [
  // Core (Required)
  {
    key: 'ANTHROPIC_API_KEY',
    label: 'Anthropic API Key',
    required: true,
    description: 'Required for Claude AI. Get yours at console.anthropic.com',
    category: 'core',
    valuePrefix: 'sk-ant-',
    helpUrl: 'https://console.anthropic.com/settings/keys'
  },

  // Research (Optional - enhance content quality)
  {
    key: 'DATAFORSEO_LOGIN',
    label: 'DataForSEO Login',
    required: false,
    description: 'Email for SERP data. Enables competitor analysis.',
    category: 'research',
    helpUrl: 'https://dataforseo.com/'
  },
  {
    key: 'DATAFORSEO_PASSWORD',
    label: 'DataForSEO Password',
    required: false,
    description: 'Password for SERP data API',
    category: 'research'
  },
  {
    key: 'PERPLEXITY_API_KEY',
    label: 'Perplexity API',
    required: false,
    description: 'Enables web research via Sonar model',
    category: 'research',
    valuePrefix: 'pplx-',
    helpUrl: 'https://www.perplexity.ai/settings/api'
  },
  {
    key: 'FIRECRAWL_API_KEY',
    label: 'Firecrawl API',
    required: false,
    description: 'Enables competitor page scraping',
    category: 'research',
    valuePrefix: 'fc-',
    helpUrl: 'https://firecrawl.dev/'
  },

  // Publishing (Optional - for CMS and images)
  {
    key: 'OPENROUTER_API_KEY',
    label: 'OpenRouter API',
    required: false,
    description: 'Enables AI image generation',
    category: 'publishing',
    valuePrefix: 'sk-or-',
    helpUrl: 'https://openrouter.ai/keys'
  },
  {
    key: 'SANITY_API_KEY',
    label: 'Sanity Token',
    required: false,
    description: 'For publishing to Sanity CMS',
    category: 'publishing',
    valuePrefix: 'sk',
    helpUrl: 'https://www.sanity.io/manage'
  },
  {
    key: 'SANITY_PROJECT_ID',
    label: 'Sanity Project ID',
    required: false,
    description: 'Your Sanity project identifier',
    category: 'publishing'
  },
  {
    key: 'SANITY_DATASET',
    label: 'Sanity Dataset',
    required: false,
    description: 'Usually "production" or "development"',
    category: 'publishing'
  },
  {
    key: 'SUPABASE_ACCESS_TOKEN',
    label: 'Supabase Token',
    required: false,
    description: 'For cloud keyword queue (optional)',
    category: 'publishing',
    valuePrefix: 'sbp_',
    helpUrl: 'https://supabase.com/dashboard/account/tokens'
  },
];

/**
 * Category display order and labels
 */
export const CATEGORY_ORDER: Array<{ id: ApiKeyConfig['category']; label: string; description: string }> = [
  {
    id: 'core',
    label: 'CORE (Required)',
    description: 'Essential for Leo to function'
  },
  {
    id: 'research',
    label: 'RESEARCH (Recommended)',
    description: 'Enhance content with SEO and competitor data'
  },
  {
    id: 'publishing',
    label: 'PUBLISHING (Optional)',
    description: 'For CMS integration and image generation'
  },
];

/**
 * Get keys by category
 */
export function getKeysByCategory(category: ApiKeyConfig['category']): ApiKeyConfig[] {
  return API_KEYS.filter(k => k.category === category);
}

/**
 * Get required keys
 */
export function getRequiredKeys(): ApiKeyConfig[] {
  return API_KEYS.filter(k => k.required);
}

/**
 * Check if all required keys are set
 */
export function hasRequiredKeys(): boolean {
  return getRequiredKeys().every(k => {
    const value = process.env[k.key];
    return value && value.trim().length > 0;
  });
}

/**
 * Get missing required keys
 */
export function getMissingRequiredKeys(): ApiKeyConfig[] {
  return getRequiredKeys().filter(k => {
    const value = process.env[k.key];
    return !value || value.trim().length === 0;
  });
}

/**
 * Quick validate a key value based on prefix
 */
export function quickValidateKey(config: ApiKeyConfig, value: string): { valid: boolean; error?: string } {
  if (!value || value.trim().length === 0) {
    if (config.required) {
      return { valid: false, error: 'Required' };
    }
    return { valid: true };
  }

  if (config.valuePrefix && !value.startsWith(config.valuePrefix)) {
    return {
      valid: false,
      error: `Should start with "${config.valuePrefix}"`
    };
  }

  // Email validation for DataForSEO login
  if (config.key === 'DATAFORSEO_LOGIN') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Must be a valid email' };
    }
  }

  return { valid: true };
}
