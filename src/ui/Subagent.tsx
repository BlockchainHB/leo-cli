/**
 * Subagent Component
 * 
 * Beautiful animated display for subagent execution with nested tool calls
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Spinner, GradientWave } from './Spinner.js';
import { theme, catppuccin, gradients, boxChars, statusIcons } from './colors.js';

interface SubagentProps {
  name: string;
  task?: string;
  status: 'running' | 'complete' | 'error';
  startTime: number;
  nestedTools?: Array<{
    name: string;
    status: 'running' | 'complete' | 'error';
    elapsed?: string;
  }>;
}

export function Subagent({ name, task, status, startTime, nestedTools = [] }: SubagentProps) {
  const [elapsed, setElapsed] = useState('0.0');

  // Update elapsed time
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => {
      setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, [status, startTime]);

  const isRunning = status === 'running';
  const isError = status === 'error';
  const borderColor = isRunning ? catppuccin.sapphire : theme.borderDim;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      <Box>
        <Text color={borderColor}>{boxChars.topLeft}{boxChars.horizontal} </Text>
        {isRunning ? (
          <Gradient colors={gradients.info}>
            <Text bold>🤖 {name}</Text>
          </Gradient>
        ) : (
          <Text color={isError ? theme.error : theme.textMuted} bold>🤖 {name}</Text>
        )}
      </Box>
      
      {/* Task description */}
      {task && (
        <Box>
          <Text color={borderColor}>{boxChars.vertical}</Text>
          <Text color={theme.textDim}> Task: {truncate(task, 55)}</Text>
        </Box>
      )}

      {/* Nested tool calls */}
      {nestedTools.length > 0 && (
        <Box flexDirection="column">
          {nestedTools.map((tool, i) => (
            <Box key={i}>
              <Text color={borderColor}>{boxChars.vertical}</Text>
              <Text color={theme.textDim}>  </Text>
              {tool.status === 'running' ? (
                <>
                  <Spinner type="dots" color={catppuccin.lavender} />
                  <Text color={catppuccin.lavender}> {tool.name}</Text>
                </>
              ) : tool.status === 'complete' ? (
                <>
                  <Text color={theme.success}>{statusIcons.success}</Text>
                  <Text color={theme.textMuted}> {tool.name}</Text>
                  {tool.elapsed && <Text color={theme.textDim}> ({tool.elapsed}s)</Text>}
                </>
              ) : (
                <>
                  <Text color={theme.error}>{statusIcons.error}</Text>
                  <Text color={theme.error}> {tool.name}</Text>
                </>
              )}
            </Box>
          ))}
        </Box>
      )}
      
      {/* Status line */}
      <Box>
        <Text color={borderColor}>{boxChars.vertical}</Text>
        {isRunning ? (
          <Box marginLeft={1}>
            <GradientWave colors={gradients.info} text="●●●" />
            <Text color={theme.textMuted}> Working... ({elapsed}s)</Text>
          </Box>
        ) : isError ? (
          <Text color={theme.error}> {statusIcons.error} Failed ({elapsed}s)</Text>
        ) : (
          <Text color={theme.success}> {statusIcons.success} Completed ({elapsed}s)</Text>
        )}
      </Box>
      
      {/* Footer */}
      <Box>
        <Text color={borderColor}>
          {boxChars.bottomLeft}
          {boxChars.horizontal.repeat(40)}
        </Text>
      </Box>
    </Box>
  );
}

// Compact subagent summary for completed subagents
export function SubagentSummary({ 
  name, 
  elapsed, 
  toolCount,
  status = 'complete'
}: { 
  name: string; 
  elapsed: string;
  toolCount?: number;
  status?: 'complete' | 'error';
}) {
  const isError = status === 'error';
  
  return (
    <Box>
      <Text color={isError ? theme.error : theme.success}>
        {isError ? statusIcons.error : statusIcons.success}
      </Text>
      <Text color={theme.textMuted}> 🤖 {name}</Text>
      {toolCount != null && toolCount > 0 && (
        <Text color={theme.textDim}> ({toolCount} tools)</Text>
      )}
      <Text color={theme.textDim}> • {elapsed}s</Text>
    </Box>
  );
}

// Helper
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
