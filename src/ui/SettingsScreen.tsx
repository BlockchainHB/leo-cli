/**
 * SettingsScreen Component
 *
 * Terminal UI for managing API keys with hot reload support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { theme, claude, statusIcons } from './colors.js';
import { KeyRow } from './KeyRow.js';
import { KeyEditor } from './KeyEditor.js';
import { API_KEYS, CATEGORY_ORDER, type ApiKeyConfig, type KeyStatus } from '../types/settings.js';
import { readEnvFile, writeEnvFile, reloadEnv, envFileExists, createEnvTemplate } from '../utils/env-manager.js';
import { testApiKey, quickValidate } from '../utils/key-validators.js';

interface SettingsScreenProps {
  onClose: () => void;
}

interface KeyState {
  value: string;
  status: KeyStatus;
  error?: string;
}

export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { exit } = useApp();

  // State
  const [keyStates, setKeyStates] = useState<Map<string, KeyState>>(new Map());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  // Load current values on mount
  useEffect(() => {
    if (!envFileExists()) {
      createEnvTemplate();
    }

    const envMap = readEnvFile();
    const states = new Map<string, KeyState>();

    for (const config of API_KEYS) {
      const value = envMap.get(config.key) || '';
      const hasValue = !!value.trim();

      states.set(config.key, {
        value,
        status: hasValue ? 'untested' : 'invalid',
        error: hasValue ? undefined : (config.required ? 'Required' : undefined)
      });
    }

    setKeyStates(states);
  }, []);

  // Get selected config
  const selectedConfig = API_KEYS[selectedIndex];

  // Clear message after delay
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Handle keyboard input
  useInput((input, key) => {
    if (editingKey) return;

    if (key.escape) {
      onClose();
      return;
    }

    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(i => Math.min(API_KEYS.length - 1, i + 1));
      return;
    }

    if (key.return || input === 'e') {
      setEditingKey(selectedConfig.key);
      return;
    }

    if (input === 't') {
      handleTest(selectedConfig);
      return;
    }

    if (input === 'T') {
      handleTestAll();
      return;
    }

    if (key.ctrl && input === 's') {
      handleSave();
      return;
    }

    if (input === 'r') {
      handleReload();
      return;
    }
  });

  const handleTest = useCallback(async (config: ApiKeyConfig) => {
    const state = keyStates.get(config.key);
    if (!state?.value) {
      setMessage({ text: 'No value to test', type: 'error' });
      return;
    }

    setTestingKey(config.key);
    setKeyStates(prev => {
      const next = new Map(prev);
      next.set(config.key, { ...state, status: 'testing' });
      return next;
    });

    const result = await testApiKey(config, state.value);

    setKeyStates(prev => {
      const next = new Map(prev);
      next.set(config.key, {
        ...state,
        status: result.valid ? 'valid' : 'invalid',
        error: result.error
      });
      return next;
    });

    setTestingKey(null);
    setMessage({
      text: result.valid ? `${config.label}: Valid` : `${config.label}: ${result.error}`,
      type: result.valid ? 'success' : 'error'
    });
  }, [keyStates]);

  const handleTestAll = useCallback(async () => {
    setMessage({ text: 'Testing all keys...', type: 'info' });

    for (const config of API_KEYS) {
      const state = keyStates.get(config.key);
      if (state?.value) {
        await handleTest(config);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setMessage({ text: 'All tests complete', type: 'success' });
  }, [keyStates, handleTest]);

  const handleSave = useCallback(() => {
    const envMap = new Map<string, string>();

    for (const [key, state] of keyStates) {
      if (state.value) {
        envMap.set(key, state.value);
      }
    }

    try {
      writeEnvFile(envMap);
      reloadEnv();
      setHasChanges(false);
      setMessage({ text: 'Saved and reloaded!', type: 'success' });
    } catch (error) {
      setMessage({
        text: `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    }
  }, [keyStates]);

  const handleReload = useCallback(() => {
    const envMap = readEnvFile();
    const states = new Map<string, KeyState>();

    for (const config of API_KEYS) {
      const value = envMap.get(config.key) || '';
      const hasValue = !!value.trim();

      states.set(config.key, {
        value,
        status: hasValue ? 'untested' : 'invalid',
        error: hasValue ? undefined : (config.required ? 'Required' : undefined)
      });
    }

    setKeyStates(states);
    setHasChanges(false);
    setMessage({ text: 'Reloaded from .env', type: 'info' });
  }, []);

  const handleEditorSave = useCallback((value: string) => {
    if (!editingKey) return;

    const config = API_KEYS.find(k => k.key === editingKey);
    if (!config) return;

    const validation = quickValidate(config, value);

    setKeyStates(prev => {
      const next = new Map(prev);
      next.set(editingKey, {
        value,
        status: value ? 'untested' : 'invalid',
        error: validation.valid ? undefined : validation.error
      });
      return next;
    });

    setHasChanges(true);
    setEditingKey(null);
  }, [editingKey]);

  // Show editor overlay if editing
  if (editingKey) {
    const config = API_KEYS.find(k => k.key === editingKey)!;
    const state = keyStates.get(editingKey)!;

    return (
      <Box flexDirection="column" padding={1}>
        <KeyEditor
          config={config}
          initialValue={state.value}
          onSave={handleEditorSave}
          onCancel={() => setEditingKey(null)}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={claude.accent}>{'\u2699'} API Key Settings</Text>
        {hasChanges && <Text color={theme.warning}> {'\u2022'} unsaved</Text>}
      </Box>

      {/* Key list by category */}
      {CATEGORY_ORDER.map(category => {
        const categoryKeys = API_KEYS.filter(k => k.category === category.id);

        return (
          <Box key={category.id} flexDirection="column" marginBottom={1}>
            <Box marginBottom={0}>
              <Text bold color={theme.textMuted}>{category.label}</Text>
            </Box>

            {categoryKeys.map(config => {
              const globalIndex = API_KEYS.findIndex(k => k.key === config.key);
              const isSelected = globalIndex === selectedIndex;
              const state = keyStates.get(config.key) || { value: '', status: 'invalid' as KeyStatus };

              return (
                <KeyRow
                  key={config.key}
                  config={config}
                  value={state.value}
                  status={testingKey === config.key ? 'testing' : state.status}
                  isSelected={isSelected}
                  error={state.error}
                />
              );
            })}
          </Box>
        );
      })}

      {/* Message display */}
      {message && (
        <Box marginY={1}>
          <Text color={
            message.type === 'success' ? theme.success :
            message.type === 'error' ? theme.error : theme.info
          }>
            {message.type === 'success' ? statusIcons.success :
             message.type === 'error' ? statusIcons.error : statusIcons.info} {message.text}
          </Text>
        </Box>
      )}

      {/* Help footer */}
      <Box marginTop={1}>
        <Text color={theme.textDim}>
          {'\u2191\u2193'} Navigate  Enter Edit  t Test  ^S Save  r Reload  Esc Close
        </Text>
      </Box>
    </Box>
  );
}

export default SettingsScreen;
