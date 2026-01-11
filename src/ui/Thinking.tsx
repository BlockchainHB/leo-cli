/**
 * Thinking Component
 * 
 * Beautiful animated display for AI reasoning with gradient effects
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { theme, catppuccin, gradients, boxChars } from './colors.js';

interface ThinkingProps {
  content: string;
  isActive: boolean;
}

export function Thinking({ content, isActive }: ThinkingProps) {
  const [phase, setPhase] = useState(0);
  const [previewOffset, setPreviewOffset] = useState(0);

  // Animate thinking indicator
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setPhase(p => (p + 1) % 4);
    }, 300);
    return () => clearInterval(timer);
  }, [isActive]);

  // Scroll preview for long thinking
  useEffect(() => {
    if (!isActive || content.length < 100) return;
    const timer = setInterval(() => {
      setPreviewOffset(o => (o + 10) % Math.max(1, content.length - 60));
    }, 500);
    return () => clearInterval(timer);
  }, [isActive, content.length]);

  if (!content) return null;

  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  
  // Get preview text with scrolling
  const previewStart = Math.min(previewOffset, Math.max(0, content.length - 60));
  const preview = content
    .slice(previewStart, previewStart + 60)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Thinking animation frames
  const thinkingFrames = ['💭', '💬', '💭', '💡'];
  const frame = thinkingFrames[phase];

    return (
    <Box flexDirection="column">
        <Box>
        <Gradient colors={gradients.aurora}>
          <Text>{frame} Thinking</Text>
        </Gradient>
          <Text color={theme.textDim}> ({wordCount} words)</Text>
        </Box>
      
      {isActive && (
        <Box marginLeft={2}>
          <Text color={theme.textDim}>│ </Text>
          <Text color={catppuccin.lavender} italic dimColor>
            "{preview}{content.length > 60 ? '...' : ''}"
          </Text>
        </Box>
      )}
    </Box>
  );
}

// Summary shown after thinking completes
export function ThinkingSummary({ wordCount }: { wordCount: number }) {
  return (
    <Box>
      <Gradient colors={['#b4befe', '#cba6f7']}>
        <Text>💭</Text>
      </Gradient>
      <Text color={theme.textMuted}> Thought for </Text>
      <Text color={catppuccin.lavender}>{wordCount}</Text>
      <Text color={theme.textMuted}> words</Text>
    </Box>
  );
}

// Expandable thinking panel
export function ThinkingPanel({ 
  content, 
  isExpanded,
  onToggle,
}: { 
  content: string;
  isExpanded: boolean;
  onToggle?: () => void;
}) {
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

  if (!isExpanded) {
    return (
      <Box>
        <Gradient colors={gradients.aurora}>
          <Text>💭 Reasoning</Text>
        </Gradient>
        <Text color={theme.textDim}> ({wordCount} words) </Text>
        <Text color={catppuccin.lavender} dimColor>[Ctrl+T to expand]</Text>
      </Box>
    );
  }

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={catppuccin.lavender}
      paddingX={1}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Gradient colors={gradients.aurora}>
          <Text bold>💭 Reasoning</Text>
        </Gradient>
        <Text color={theme.textDim}> ({wordCount} words)</Text>
      </Box>
      
      <Text color={theme.textMuted} italic wrap="wrap">
        {content}
      </Text>
    </Box>
  );
}

// Chain of thought display
export function ReasoningChain({ steps }: { steps: string[] }) {
  return (
    <Box flexDirection="column" marginY={1}>
      <Gradient colors={gradients.primary}>
        <Text bold>🧠 Reasoning Chain</Text>
      </Gradient>
      
      {steps.map((step, i) => (
        <Box key={i} marginTop={i === 0 ? 1 : 0}>
          <Text color={catppuccin.lavender}>
            {i < steps.length - 1 ? boxChars.leftT : boxChars.bottomLeft}
            {boxChars.horizontal}
          </Text>
          <Text color={theme.textMuted}> {step}</Text>
        </Box>
      ))}
    </Box>
  );
}
