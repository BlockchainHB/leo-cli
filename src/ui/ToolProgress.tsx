/**
 * Tool Progress Component
 * 
 * Shows tool execution progress with spinner and timing.
 * Enhanced with gradients and better visual hierarchy.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Spinner } from './Spinner.js';
import { theme, catppuccin, gradients, statusIcons, toolIcons } from './colors.js';

export interface ToolState {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  startTime: number;
  endTime?: number;
  details?: string;
  subSteps?: Array<{ label: string; done: boolean }>;
}

interface ToolProgressProps {
  tools: ToolState[];
}

export function ToolProgress({ tools }: ToolProgressProps) {
  const [, forceUpdate] = useState(0);

  // Force re-render for elapsed time on running tools
  useEffect(() => {
    const hasRunning = tools.some(t => t.status === 'running');
    if (!hasRunning) return;
    
    const timer = setInterval(() => forceUpdate(n => n + 1), 100);
    return () => clearInterval(timer);
  }, [tools]);

  if (tools.length === 0) return null;

  return (
    <Box flexDirection="column" marginY={1}>
      {tools.map(tool => (
        <ToolItem key={tool.id} tool={tool} />
      ))}
    </Box>
  );
}

function ToolItem({ tool }: { tool: ToolState }) {
  const elapsed = tool.endTime 
    ? ((tool.endTime - tool.startTime) / 1000).toFixed(1)
    : ((Date.now() - tool.startTime) / 1000).toFixed(1);

  const isComplete = tool.status !== 'running';
  const toolStyle = getToolStyle(tool.name);

  // Completed tools show as collapsed single line
  if (isComplete) {
    const isError = tool.status === 'error';
    
    return (
      <Box>
        <Text color={isError ? theme.error : theme.success}>
          {isError ? statusIcons.error : statusIcons.success}
        </Text>
        <Text color={theme.textMuted}> {toolStyle.icon} </Text>
        <Text color={isError ? theme.error : theme.textMuted}>{tool.name}</Text>
        <Text color={theme.textDim}> ({elapsed}s)</Text>
      </Box>
    );
  }

  // Running tools show expanded with details
  return (
    <Box flexDirection="column">
      <Box>
        <Spinner type="dots" color={toolStyle.color} />
        <Text color={toolStyle.color}> {toolStyle.icon} </Text>
        <Text color={catppuccin.text}>{tool.name}</Text>
        <Text color={theme.textDim}> ({elapsed}s)</Text>
      </Box>
      
      {/* Sub-steps */}
      {tool.subSteps?.map((step, i) => (
        <Box key={i} marginLeft={2}>
          <Text color={step.done ? theme.success : theme.textDim}>
            {step.done ? statusIcons.success : statusIcons.pending}
          </Text>
          <Text color={theme.textMuted}> {step.label}</Text>
        </Box>
      ))}
      
      {/* Details */}
      {tool.details && (
        <Box marginLeft={2}>
          <Text color={theme.textDim}>→ {truncate(tool.details, 60)}</Text>
        </Box>
      )}
    </Box>
  );
}

// Get icon and color for tool
function getToolStyle(name: string): { icon: string; color: string } {
  if (toolIcons[name]) {
    return toolIcons[name];
  }
  
  for (const key of Object.keys(toolIcons)) {
    if (name.startsWith(key)) {
      return toolIcons[key];
    }
  }
  
  return toolIcons.default;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Tool execution timeline for showing multiple tools at once
export function ToolTimeline({ 
  tools,
  maxVisible = 5
}: { 
  tools: ToolState[];
  maxVisible?: number;
}) {
  const visible = tools.slice(-maxVisible);
  const hidden = tools.length - maxVisible;

  return (
    <Box flexDirection="column">
      {hidden > 0 && (
        <Box marginBottom={1}>
          <Text color={theme.textDim}>... and {hidden} more tools</Text>
        </Box>
      )}
      
      {visible.map((tool, i) => (
        <Box key={tool.id} marginLeft={i * 2}>
          <ToolItem tool={tool} />
        </Box>
      ))}
    </Box>
  );
}

// Summary stats for a batch of tools
export function ToolStats({ tools }: { tools: ToolState[] }) {
  const completed = tools.filter(t => t.status === 'complete').length;
  const failed = tools.filter(t => t.status === 'error').length;
  const running = tools.filter(t => t.status === 'running').length;
  
  const totalTime = tools.reduce((sum, t) => {
    const end = t.endTime || Date.now();
    return sum + (end - t.startTime);
  }, 0);

  return (
    <Box>
      <Gradient colors={gradients.primary}>
        <Text bold>Tools</Text>
      </Gradient>
      <Text color={theme.textDim}>: </Text>
      
      {completed > 0 && (
        <>
          <Text color={theme.success}>{completed} {statusIcons.success}</Text>
          <Text color={theme.textDim}> </Text>
        </>
      )}
      
      {failed > 0 && (
        <>
          <Text color={theme.error}>{failed} {statusIcons.error}</Text>
          <Text color={theme.textDim}> </Text>
        </>
      )}
      
      {running > 0 && (
        <>
          <Text color={catppuccin.sapphire}>{running} running</Text>
          <Text color={theme.textDim}> </Text>
        </>
      )}
      
      <Text color={theme.textDim}>• {(totalTime / 1000).toFixed(1)}s total</Text>
    </Box>
  );
}
