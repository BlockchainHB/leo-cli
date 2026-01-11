/**
 * KeyEditor Component
 *
 * Clean modal for editing a single API key value
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme, claude } from './colors.js';
import type { ApiKeyConfig } from '../types/settings.js';
import { quickValidate } from '../utils/key-validators.js';

interface KeyEditorProps {
  config: ApiKeyConfig;
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function KeyEditor({ config, initialValue, onSave, onCancel }: KeyEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [showValue, setShowValue] = useState(false);

  // Real-time validation feedback
  const validation = value ? quickValidate(config, value) : { valid: false, error: undefined };

  useInput((input, key) => {
    // Cancel on Escape
    if (key.escape) {
      onCancel();
      return;
    }

    // Save on Enter
    if (key.return) {
      onSave(value);
      return;
    }

    // Toggle visibility with Ctrl+V
    if (key.ctrl && input === 'v') {
      setShowValue(s => !s);
      return;
    }

    // Clear all with Ctrl+U
    if (key.ctrl && input === 'u') {
      setValue('');
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      setValue(v => v.slice(0, -1));
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      setValue(v => v + input);
    }
  });

  // Display value - masked or visible, truncated to fit
  const MAX_DISPLAY_LEN = 40;
  const rawDisplay = showValue ? value : '\u2022'.repeat(value.length);
  const displayValue = rawDisplay.length > MAX_DISPLAY_LEN
    ? rawDisplay.slice(0, MAX_DISPLAY_LEN - 3) + '...'
    : rawDisplay;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={claude.accent} paddingX={2} paddingY={1}>
      {/* Title */}
      <Box>
        <Text bold color={theme.text}>{config.label}</Text>
        {config.required && <Text color={theme.error}> *</Text>}
      </Box>

      {/* Description */}
      <Box marginBottom={1}>
        <Text color={theme.textDim}>{config.description}</Text>
      </Box>

      {/* Input field */}
      <Box marginBottom={1}>
        <Text color={theme.textSecondary}>Value: </Text>
        <Text color={theme.text}>{displayValue}</Text>
        <Text backgroundColor={claude.accent} color="#000">{' '}</Text>
      </Box>

      {/* Validation status */}
      <Box marginBottom={1}>
        {value && validation.valid ? (
          <Text color={theme.success}>{'\u2713'} Valid format</Text>
        ) : value && !validation.valid ? (
          <Text color={theme.error}>{'\u2717'} {validation.error}</Text>
        ) : (
          <Text color={theme.textDim}>
            {config.valuePrefix ? `Hint: Should start with ${config.valuePrefix}` : 'Enter your API key'}
          </Text>
        )}
      </Box>

      {/* Keyboard shortcuts */}
      <Text color={theme.textDim}>
        Enter Save  Esc Cancel  ^V {showValue ? 'Hide' : 'Show'}  ^U Clear
      </Text>
    </Box>
  );
}

export default KeyEditor;
