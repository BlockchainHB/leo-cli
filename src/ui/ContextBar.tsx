/**
 * Context Bar Component
 *
 * Shows context/token usage with a visual progress bar and cost tracking
 * Inspired by Claude Code's status line
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme, claude } from './colors.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UsageData {
  inputTokens: number;
  outputTokens: number;
  contextWindow: number;
  totalCostUsd?: number;
  sessionCostUsd?: number;  // Accumulated session cost
  imageCount?: number;      // Number of images generated
  imageCostUsd?: number;    // Cost of image generation
}

interface ContextBarProps {
  usage: UsageData | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ContextBar({ usage }: ContextBarProps) {
  if (!usage) return null;

  const { inputTokens, outputTokens, contextWindow, sessionCostUsd, imageCount, imageCostUsd } = usage;
  const totalTokens = inputTokens + outputTokens;
  const percentage = Math.min((totalTokens / contextWindow) * 100, 100);

  // Progress bar characters
  const barWidth = 20;
  const filledCount = Math.round((percentage / 100) * barWidth);
  const emptyCount = barWidth - filledCount;

  // Color based on usage level
  const getBarColor = () => {
    if (percentage >= 80) return theme.error;      // Red when high
    if (percentage >= 60) return theme.warning;    // Yellow/orange when medium
    return claude.accent;                           // Orange accent when normal
  };

  // Format token count (e.g., 12.5k, 1.2M)
  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  // Format cost
  const formatCost = (n: number): string => {
    if (n < 0.01) return '<$0.01';
    if (n < 1) return `$${n.toFixed(2)}`;
    return `$${n.toFixed(2)}`;
  };

  // Calculate total cost (API + images)
  const totalCost = (sessionCostUsd || 0) + (imageCostUsd || 0);

  const barColor = getBarColor();

  return (
    <Box>
      {/* Bar */}
      <Text color={theme.textDim}>[</Text>
      <Text color={barColor}>{'█'.repeat(filledCount)}</Text>
      <Text color={theme.textDim}>{'░'.repeat(emptyCount)}</Text>
      <Text color={theme.textDim}>]</Text>

      {/* Percentage */}
      <Text color={theme.textMuted}> {percentage.toFixed(0)}%</Text>

      {/* Token count */}
      <Text color={theme.textDim}> · </Text>
      <Text color={theme.textMuted}>{formatTokens(totalTokens)}</Text>

      {/* Cost display */}
      {totalCost > 0 && (
        <>
          <Text color={theme.textDim}> · </Text>
          <Text color={theme.textMuted}>{formatCost(totalCost)}</Text>
        </>
      )}

      {/* Image count if any */}
      {imageCount != null && imageCount > 0 && (
        <>
          <Text color={theme.textDim}> · </Text>
          <Text color={theme.textMuted}>{imageCount} img</Text>
        </>
      )}
    </Box>
  );
}
