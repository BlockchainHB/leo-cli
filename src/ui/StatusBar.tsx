/**
 * StatusBar Component
 * 
 * Live metrics display at the bottom of the screen
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { theme, catppuccin, gradients, statusIcons } from './colors.js';

interface StatusBarProps {
  isProcessing: boolean;
  toolCount?: number;
  tokenCount?: number;
  elapsed?: number;
  currentPhase?: string;
}

export function StatusBar({ 
  isProcessing, 
  toolCount = 0,
  tokenCount = 0,
  elapsed = 0,
  currentPhase,
}: StatusBarProps) {
  const [dots, setDots] = useState(0);

  // Animate dots while processing
  useEffect(() => {
    if (!isProcessing) {
      setDots(0);
      return;
    }
    const timer = setInterval(() => {
      setDots(d => (d + 1) % 4);
    }, 500);
    return () => clearInterval(timer);
  }, [isProcessing]);

  return (
    <Box 
      borderStyle="single" 
      borderColor={theme.borderDim}
      paddingX={1}
      marginTop={1}
    >
      {isProcessing ? (
        <Box justifyContent="space-between" width="100%">
          {/* Left: Current phase */}
          <Box>
            <Gradient colors={gradients.primary}>
              <Text>●</Text>
            </Gradient>
            <Text color={theme.text}> {currentPhase || 'Processing'}</Text>
            <Text color={theme.textDim}>{'.'.repeat(dots).padEnd(3)}</Text>
          </Box>

          {/* Right: Stats */}
          <Box>
            {toolCount > 0 && (
              <>
                <Text color={catppuccin.green}>⚡ {toolCount}</Text>
                <Text color={theme.textDim}> tools • </Text>
              </>
            )}
            <Text color={catppuccin.sky}>⏱ {formatElapsed(elapsed)}</Text>
          </Box>
        </Box>
      ) : (
        <Box justifyContent="space-between" width="100%">
          <Box>
            <Text color={theme.success}>{statusIcons.success}</Text>
            <Text color={theme.textMuted}> Ready</Text>
          </Box>
          <Box>
            <Text color={theme.textDim}>
              <Text color={catppuccin.lavender}>ESC</Text> cancel • 
              <Text color={catppuccin.lavender}> Ctrl+C</Text> exit
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Phase indicator with progress
export function PhaseIndicator({ 
  phases, 
  currentPhase 
}: { 
  phases: string[];
  currentPhase: number;
}) {
  return (
    <Box marginY={1}>
      {phases.map((phase, i) => {
        const isComplete = i < currentPhase;
        const isCurrent = i === currentPhase;
        const isPending = i > currentPhase;

        let icon: string;
        let color: string;

        if (isComplete) {
          icon = statusIcons.success;
          color = theme.success;
        } else if (isCurrent) {
          icon = statusIcons.running;
          color = catppuccin.sapphire;
        } else {
          icon = statusIcons.pending;
          color = theme.textDim;
        }

        return (
          <Box key={i}>
            <Text color={color}>{icon} </Text>
            <Text color={color}>{phase}</Text>
            {i < phases.length - 1 && (
              <Text color={theme.textDim}> → </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// Session stats summary
export function SessionStats({
  duration,
  toolCalls,
  tokensUsed,
  articlesWritten,
}: {
  duration: number;
  toolCalls: number;
  tokensUsed?: number;
  articlesWritten?: number;
}) {
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={theme.borderDim}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Gradient colors={gradients.primary}>
        <Text bold>Session Summary</Text>
      </Gradient>
      
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={catppuccin.sky}>⏱ Duration:</Text>
          <Text color={theme.text}> {formatElapsed(duration)}</Text>
        </Box>
        <Box>
          <Text color={catppuccin.green}>⚡ Tool Calls:</Text>
          <Text color={theme.text}> {toolCalls}</Text>
        </Box>
        {tokensUsed !== undefined && (
          <Box>
            <Text color={catppuccin.peach}>📊 Tokens:</Text>
            <Text color={theme.text}> {tokensUsed.toLocaleString()}</Text>
          </Box>
        )}
        {articlesWritten !== undefined && articlesWritten > 0 && (
          <Box>
            <Text color={catppuccin.pink}>📝 Articles:</Text>
            <Text color={theme.text}> {articlesWritten}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Format elapsed time
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Live clock component
export function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color={theme.textDim}>
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </Text>
  );
}

