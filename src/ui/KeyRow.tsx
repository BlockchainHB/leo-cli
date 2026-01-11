/**
 * KeyRow Component
 *
 * Displays a single API key row with status indicator and masked value
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme, claude } from './colors.js';
import type { ApiKeyConfig, KeyStatus } from '../types/settings.js';

interface KeyRowProps {
  config: ApiKeyConfig;
  value: string;
  status: KeyStatus;
  isSelected: boolean;
  error?: string;
}

/**
 * Status icon and color mappings
 */
const STATUS_DISPLAY: Record<KeyStatus, { icon: string; color: string }> = {
  valid: { icon: '\u2713', color: theme.success },      // ✓
  invalid: { icon: '\u2717', color: theme.error },      // ✗
  untested: { icon: '\u2022\u2022', color: theme.warning },  // ••
  testing: { icon: '\u25cb', color: claude.accent },    // ○
};

/**
 * Mask an API key value for display
 * Shows first 4 and last 4 characters with dots in between
 */
function maskValue(value: string): string {
  if (!value) {
    return '(not set)';
  }

  if (value.length <= 12) {
    // Short values: show first 3 chars + dots
    return value.slice(0, 3) + '\u2022'.repeat(Math.max(0, value.length - 3));
  }

  // Show first 4 and last 4 with dots
  const dots = '\u2022'.repeat(Math.min(value.length - 8, 16));
  return value.slice(0, 4) + dots + value.slice(-4);
}

export function KeyRow({ config, value, status, isSelected, error }: KeyRowProps) {
  const statusDisplay = STATUS_DISPLAY[status];
  const maskedValue = maskValue(value);
  const hasValue = !!value.trim();

  return (
    <Box flexDirection="column">
      <Box>
        {/* Selection indicator */}
        <Text color={isSelected ? claude.accent : theme.textDim}>
          {isSelected ? '\u203a ' : '  '}
        </Text>

        {/* Status icon */}
        <Text color={statusDisplay.color}>{statusDisplay.icon} </Text>

        {/* Key label - bold if required */}
        <Box width={20}>
          <Text
            color={isSelected ? theme.text : theme.textSecondary}
            bold={config.required}
          >
            {config.label}
          </Text>
        </Box>

        {/* Masked value */}
        <Text color={hasValue ? theme.textMuted : theme.error}>
          {maskedValue}
        </Text>

        {/* Required indicator */}
        {config.required && !hasValue && (
          <Text color={theme.error}> (required)</Text>
        )}
      </Box>

      {/* Error message on second line when selected */}
      {isSelected && error && (
        <Box marginLeft={4}>
          <Text color={theme.error}>{error}</Text>
        </Box>
      )}

      {/* Description on second line when selected */}
      {isSelected && !error && (
        <Box marginLeft={4}>
          <Text color={theme.textDim}>{config.description}</Text>
        </Box>
      )}
    </Box>
  );
}

export default KeyRow;
