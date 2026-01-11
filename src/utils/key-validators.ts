/**
 * API Key Validators
 *
 * Test API key validity for each service
 */

import type { ApiKeyConfig } from '../types/settings.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Test an API key's validity
 * Returns { valid: true } if valid, { valid: false, error: '...' } if invalid
 */
export async function testApiKey(
  config: ApiKeyConfig,
  value: string
): Promise<ValidationResult> {
  // Empty check
  if (!value.trim()) {
    return { valid: false, error: 'Key is empty' };
  }

  // Prefix check
  if (config.valuePrefix && !value.startsWith(config.valuePrefix)) {
    return {
      valid: false,
      error: `Should start with "${config.valuePrefix}"`
    };
  }

  // Service-specific validation
  try {
    switch (config.key) {
      case 'SUPABASE_ACCESS_TOKEN':
        return await testSupabase(value);

      case 'PERPLEXITY_API_KEY':
        return validatePrefix(value, 'pplx-');

      case 'FIRECRAWL_API_KEY':
        return validatePrefix(value, 'fc-');

      case 'OPENROUTER_API_KEY':
        return await testOpenRouter(value);

      case 'SANITY_API_KEY':
        return validatePrefix(value, 'sk');

      case 'DATAFORSEO_LOGIN':
        return validateEmail(value);

      case 'DATAFORSEO_PASSWORD':
        return { valid: value.length >= 1 };

      case 'AHREFS_API_KEY':
        return { valid: value.length > 10 };

      default:
        // Assume valid if no specific test
        return { valid: true };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    };
  }
}

/**
 * Test Supabase access token
 */
async function testSupabase(token: string): Promise<ValidationResult> {
  if (!token.startsWith('sbp_')) {
    return { valid: false, error: 'Should start with "sbp_"' };
  }

  try {
    const response = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (response.status === 401) {
      return { valid: false, error: 'Invalid or expired token' };
    }

    return { valid: response.ok || response.status === 403 };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { valid: false, error: 'Connection timeout' };
    }
    return { valid: false, error: 'Connection failed' };
  }
}

/**
 * Test OpenRouter API key
 */
async function testOpenRouter(key: string): Promise<ValidationResult> {
  if (!key.startsWith('sk-or-')) {
    return { valid: false, error: 'Should start with "sk-or-"' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: response.ok };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { valid: false, error: 'Connection timeout' };
    }
    return { valid: false, error: 'Connection failed' };
  }
}

/**
 * Validate prefix only (for services without easy test endpoints)
 */
function validatePrefix(value: string, prefix: string): ValidationResult {
  if (!value.startsWith(prefix)) {
    return { valid: false, error: `Should start with "${prefix}"` };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
function validateEmail(value: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

/**
 * Quick format validation (no network calls)
 * Used for real-time feedback while typing
 */
export function quickValidate(config: ApiKeyConfig, value: string): ValidationResult {
  if (!value.trim()) {
    return { valid: false, error: 'Empty' };
  }

  if (config.valuePrefix && !value.startsWith(config.valuePrefix)) {
    return { valid: false, error: `Should start with "${config.valuePrefix}"` };
  }

  if (config.key === 'DATAFORSEO_LOGIN') {
    return validateEmail(value);
  }

  // Minimum length check
  if (value.length < 5) {
    return { valid: false, error: 'Too short' };
  }

  return { valid: true };
}
