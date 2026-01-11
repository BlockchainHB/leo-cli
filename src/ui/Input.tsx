/**
 * Input Component with Command Autocomplete
 *
 * Clean, minimal text input for terminal with slash command suggestions
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme, claude } from './colors.js';

// ─────────────────────────────────────────────────────────────────────────────
// Command Definitions
// ─────────────────────────────────────────────────────────────────────────────

interface Command {
  name: string;
  description: string;
  args?: string; // Optional args hint like "[keyword]"
}

const COMMANDS: Command[] = [
  { name: '/write-blog', args: '[keyword]', description: 'Research and write article' },
  { name: '/write-blog', args: 'next', description: 'Write next from queue' },
  { name: '/queue-status', description: 'View keyword queue' },
  { name: '/publish', args: '[slug]', description: 'Publish draft to Sanity' },
  { name: '/schedule', args: '[slug] [date]', description: 'Schedule for future publish' },
  { name: '/research', args: '[keyword]', description: 'Research without writing' },
  { name: '/super-leo', args: '<count> [--publish]', description: 'Process multiple keywords automatically' },
  { name: '/cancel-super-leo', description: 'Cancel active Super-Leo loop' },
  { name: '/sessions', description: 'List recent sessions' },
  { name: '/resume', args: '[session-id]', description: 'Resume a previous session' },
  { name: '/rename', args: '<name>', description: 'Name the current session' },
  { name: '/cost', description: 'Show session cost breakdown' },
  { name: '/settings', description: 'Manage API keys' },
  { name: '/clear', description: 'Clear conversation & start fresh' },
  { name: '/compact', args: '[focus]', description: 'Summarize context' },
  { name: '/help', description: 'Show all commands' },
  { name: '/quit', description: 'Exit Leo' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Input Component
// ─────────────────────────────────────────────────────────────────────────────

interface InputProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  queuedMessage?: string | null;
}

export function Input({ onSubmit, disabled = false, placeholder = '', queuedMessage }: InputProps) {
  const [value, setValue] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on input
  const suggestions = useMemo(() => {
    if (!value.startsWith('/')) return [];

    const query = value.toLowerCase();
    return COMMANDS.filter(cmd => {
      const fullCmd = cmd.args ? `${cmd.name} ${cmd.args}` : cmd.name;
      return cmd.name.toLowerCase().startsWith(query) ||
             fullCmd.toLowerCase().includes(query);
    });
  }, [value]);

  const showSuggestions = value.startsWith('/') && suggestions.length > 0 && !disabled;

  // Scrollable window - show 5 items at a time
  const VISIBLE_COUNT = 5;
  const scrollOffset = useMemo(() => {
    // Keep selected item visible in the window
    if (selectedIndex < VISIBLE_COUNT) return 0;
    return Math.min(selectedIndex - VISIBLE_COUNT + 1, suggestions.length - VISIBLE_COUNT);
  }, [selectedIndex, suggestions.length]);

  const visibleSuggestions = suggestions.slice(scrollOffset, scrollOffset + VISIBLE_COUNT);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + VISIBLE_COUNT < suggestions.length;

  useInput((input, key) => {
    if (disabled) return;

    // Arrow navigation for suggestions
    if (showSuggestions) {
      if (key.upArrow) {
        setSelectedIndex(i => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex(i => Math.min(suggestions.length - 1, i + 1));
        return;
      }
      if (key.tab) {
        // Autocomplete with selected command (don't submit)
        const selected = suggestions[selectedIndex];
        if (selected) {
          setValue(selected.name + (selected.args ? ' ' : ''));
        }
        return;
      }
      // Enter with suggestions visible: autocomplete and submit if no args needed
      if (key.return) {
        const selected = suggestions[selectedIndex];
        if (selected) {
          // If command needs args, just fill it in
          if (selected.args) {
            setValue(selected.name + ' ');
          } else {
            // No args needed - submit immediately
            onSubmit(selected.name);
            setValue('');
            setSelectedIndex(0);
          }
        }
        return;
      }
    }

    if (key.return) {
      if (value.trim()) {
        onSubmit(value);
        setValue('');
        setSelectedIndex(0);
      }
    } else if (key.backspace || key.delete) {
      setValue(v => v.slice(0, -1));
      setSelectedIndex(0);
    } else if (key.escape) {
      // Clear input on escape
      if (value) {
        setValue('');
        setSelectedIndex(0);
      }
    } else if (input && !key.ctrl && !key.meta) {
      setValue(v => v + input);
      setSelectedIndex(0);
    }
  });

  // Get terminal width for the lines
  const termWidth = process.stdout.columns || 80;

  // Placeholder changes when there's a queued message
  const displayPlaceholder = queuedMessage
    ? 'Press up to edit queued message'
    : placeholder;

  return (
    <Box flexDirection="column">
      {/* Top line */}
      <Text color={theme.borderDim}>{'─'.repeat(termWidth)}</Text>

      {/* Input row - wrap text so cursor follows to new lines */}
      <Text wrap="wrap">
        <Text color={claude.accent}>{'> '}</Text>
        {value ? (
          <>
            <Text color={theme.text}>{value}</Text>
            {!disabled && <Text color={theme.textSecondary}>█</Text>}
          </>
        ) : (
          <>
            <Text color={theme.textMuted}>{displayPlaceholder}</Text>
            {!disabled && <Text color={theme.textSecondary}>█</Text>}
          </>
        )}
      </Text>

      {/* Bottom line */}
      <Text color={theme.borderDim}>{'─'.repeat(termWidth)}</Text>

      {/* Suggestions panel - below input */}
      {showSuggestions && (
        <Box flexDirection="column" marginTop={1}>
          {visibleSuggestions.map((cmd, i) => (
            <CommandSuggestion
              key={`${cmd.name}-${cmd.args || i}`}
              command={cmd}
              isSelected={scrollOffset + i === selectedIndex}
              query={value}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Suggestion Row
// ─────────────────────────────────────────────────────────────────────────────

interface CommandSuggestionProps {
  command: Command;
  isSelected: boolean;
  query: string;
}

function CommandSuggestion({ command, isSelected, query }: CommandSuggestionProps) {
  const { name, args, description } = command;

  // Highlight matching portion
  const matchIndex = name.toLowerCase().indexOf(query.toLowerCase());

  return (
    <Box>
      {/* Selection indicator */}
      <Text color={isSelected ? claude.accent : theme.textDim}>
        {isSelected ? '› ' : '  '}
      </Text>

      {/* Command name with highlight */}
      <Box width={28}>
        {matchIndex >= 0 ? (
          <>
            <Text color={theme.textMuted}>{name.slice(0, matchIndex)}</Text>
            <Text color={claude.accent} bold>{name.slice(matchIndex, matchIndex + query.length)}</Text>
            <Text color={theme.textMuted}>{name.slice(matchIndex + query.length)}</Text>
          </>
        ) : (
          <Text color={theme.textMuted}>{name}</Text>
        )}
        {args && <Text color={theme.textDim}> {args}</Text>}
      </Box>

      {/* Description */}
      <Text color={isSelected ? theme.text : theme.textDim}>{description}</Text>
    </Box>
  );
}
