/**
 * ToolCall Component
 * 
 * Beautiful animated display for tool executions with progress tracking
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Spinner, GradientWave } from './Spinner.js';
import { theme, catppuccin, gradients, toolIcons, boxChars, statusIcons } from './colors.js';

export interface ToolCallProps {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  startTime: number;
  endTime?: number;
  input?: Record<string, unknown>;
  result?: string;
  isSubagentTool?: boolean;
}

// Get friendly label for tool
function getToolLabel(name: string, input?: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    'Read': input?.file_path ? `reading ${truncatePath(input.file_path as string)}` : 'reading file',
    'Write': input?.file_path ? `writing ${truncatePath(input.file_path as string)}` : 'writing file',
    'Edit': input?.file_path ? `editing ${truncatePath(input.file_path as string)}` : 'editing file',
    'Bash': input?.command ? `$ ${truncate(input.command as string, 40)}` : 'running command',
    'Grep': 'searching files',
    'Glob': 'finding files',
    'Task': input?.agent ? `delegating to ${input.agent}` : 'delegating task',
    'Skill': 'loading skill',
  };

  if (labels[name]) return labels[name];

  // Handle MCP tools
  if (name.startsWith('mcp__')) {
    const parts = name.split('__');
    const server = parts[1] || 'mcp';
    const tool = parts[2] || 'tool';
    
    if (server === 'ahrefs') {
      if (tool === 'serp-overview-serp-overview') return 'fetching SERP data';
      return `ahrefs: ${tool}`;
    }
    if (server === 'supabase') {
      if (tool === 'execute_sql') return 'querying database';
      return `supabase: ${tool}`;
    }
    return `${server}: ${tool}`;
  }

  return name.toLowerCase();
}

// Get icon and color for tool
function getToolStyle(name: string): { icon: string; color: string; gradient: string[] } {
  // Check for exact match
  if (toolIcons[name]) {
    return { 
      ...toolIcons[name], 
      gradient: gradients.primary 
    };
  }

  // Check for MCP prefix
  for (const key of Object.keys(toolIcons)) {
    if (name.startsWith(key)) {
      return { 
        ...toolIcons[key], 
        gradient: key.includes('ahrefs') ? gradients.info : gradients.success 
      };
    }
  }

  return { 
    ...toolIcons.default, 
    gradient: gradients.primary 
  };
}

export function ToolCall({ 
  name, 
  status, 
  startTime, 
  endTime,
  input,
  result,
  isSubagentTool = false,
}: ToolCallProps) {
  const [elapsed, setElapsed] = useState('0.0');
  const style = useMemo(() => getToolStyle(name), [name]);
  const label = useMemo(() => getToolLabel(name, input), [name, input]);

  // Update elapsed time while running
  useEffect(() => {
    if (status !== 'running') {
      if (endTime) {
        setElapsed(((endTime - startTime) / 1000).toFixed(1));
      }
      return;
    }

    const timer = setInterval(() => {
      setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, [status, startTime, endTime]);

  const indent = isSubagentTool ? 2 : 0;

  if (status === 'running') {
    return (
      <Box marginLeft={indent}>
        <Spinner type="dots" color={style.color} />
        <Text color={style.color}> {style.icon} </Text>
        <Text color={catppuccin.text}>{label}</Text>
        <Text color={theme.textDim}> ({elapsed}s)</Text>
      </Box>
    );
  }

  // Completed or error
  const isError = status === 'error';
  const statusIcon = isError ? statusIcons.error : statusIcons.success;
  const statusColor = isError ? theme.error : theme.success;

  return (
    <Box marginLeft={indent}>
      <Text color={statusColor}>{statusIcon}</Text>
      <Text color={theme.textMuted}> {style.icon} </Text>
      <Text color={theme.textMuted}>{label}</Text>
      <Text color={theme.textDim}> ({elapsed}s)</Text>
    </Box>
  );
}

// Subagent container with visual nesting
export function SubagentCall({
  name,
  task,
  status,
  startTime,
  tools = [],
}: {
  name: string;
  task?: string;
  status: 'running' | 'complete' | 'error';
  startTime: number;
  tools?: ToolCallProps[];
}) {
  const [elapsed, setElapsed] = useState('0.0');

  useEffect(() => {
    if (status !== 'running') return;
    
    const timer = setInterval(() => {
      setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, [status, startTime]);

  const isRunning = status === 'running';
  const borderColor = isRunning ? catppuccin.sapphire : theme.borderDim;
  const headerColor = isRunning ? catppuccin.sapphire : theme.textMuted;

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
          <Text color={headerColor} bold>🤖 {name}</Text>
        )}
      </Box>

      {/* Task description */}
      {task && (
        <Box>
          <Text color={borderColor}>{boxChars.vertical}</Text>
          <Text color={theme.textDim}> Task: {truncate(task, 50)}</Text>
        </Box>
      )}

      {/* Nested tools */}
      {tools.length > 0 && (
        <Box flexDirection="column">
          {tools.map(tool => (
            <Box key={tool.id}>
              <Text color={borderColor}>{boxChars.vertical}</Text>
              <Box marginLeft={1}>
                <ToolCall {...tool} isSubagentTool />
              </Box>
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
        ) : status === 'complete' ? (
          <Text color={theme.success}> {statusIcons.success} Completed ({elapsed}s)</Text>
        ) : (
          <Text color={theme.error}> {statusIcons.error} Failed ({elapsed}s)</Text>
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

// Compact tool list for completed tools
export function ToolList({ tools }: { tools: ToolCallProps[] }) {
  if (tools.length === 0) return null;

  const successful = tools.filter(t => t.status === 'complete').length;
  const failed = tools.filter(t => t.status === 'error').length;
  const totalTime = tools.reduce((sum, t) => {
    const end = t.endTime || Date.now();
    return sum + (end - t.startTime);
  }, 0);

  return (
    <Box>
      <Text color={theme.textDim}>
        <Text color={theme.success}>{successful}</Text>
        {failed > 0 && (
          <>
            <Text color={theme.textDim}>/</Text>
            <Text color={theme.error}>{failed}</Text>
          </>
        )}
        <Text color={theme.textDim}> tools</Text>
        <Text color={theme.textDim}> • </Text>
        <Text>{(totalTime / 1000).toFixed(1)}s</Text>
      </Text>
    </Box>
  );
}

// Helper functions
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function truncatePath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join('/')}`;
}

