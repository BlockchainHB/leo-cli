/**
 * Enhanced Spinner Component
 * 
 * Multiple animation styles with gradient colors
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { spinnerFrames, gradients, theme, catppuccin } from './colors.js';

type SpinnerType = keyof typeof spinnerFrames;

interface SpinnerProps {
  type?: SpinnerType;
  label?: string;
  color?: string;
  gradient?: boolean;
  gradientColors?: string[];
  speed?: number;
}

export function Spinner({ 
  type = 'dots', 
  label, 
  color,
  gradient = false,
  gradientColors = gradients.primary,
  speed = 80,
}: SpinnerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = spinnerFrames[type] || spinnerFrames.dots;
  const spinnerColor = color || theme.primary;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % frames.length);
    }, speed);
    return () => clearInterval(timer);
  }, [frames.length, speed]);

  const spinnerChar = frames[frameIndex];

  return (
    <Box>
      {gradient ? (
        <Gradient colors={gradientColors}>
          <Text>{spinnerChar}</Text>
        </Gradient>
      ) : (
        <Text color={spinnerColor}>{spinnerChar}</Text>
      )}
      {label && <Text color={theme.text}> {label}</Text>}
    </Box>
  );
}

// Pulsing dot spinner for tool calls
export function PulseSpinner({ color = catppuccin.lavender }: { color?: string }) {
  const [intensity, setIntensity] = useState(0);
  const pulseChars = ['⠁', '⠃', '⠇', '⠏', '⠟', '⠿', '⠟', '⠏', '⠇', '⠃'];

  useEffect(() => {
    const timer = setInterval(() => {
      setIntensity(prev => (prev + 1) % pulseChars.length);
    }, 100);
    return () => clearInterval(timer);
  }, [pulseChars.length]);

  return <Text color={color}>{pulseChars[intensity]}</Text>;
}

// Loading bar that fills up
export function LoadingBar({ 
  progress = 0, 
  width = 20,
  showPercentage = true,
  gradientColors = gradients.success,
}: { 
  progress?: number;
  width?: number;
  showPercentage?: boolean;
  gradientColors?: string[];
}) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  
  const filledBar = '█'.repeat(filled);
  const emptyBar = '░'.repeat(empty);

  return (
    <Box>
      <Text color={theme.textDim}>[</Text>
      <Gradient colors={gradientColors}>
        <Text>{filledBar}</Text>
      </Gradient>
      <Text color={theme.textDim}>{emptyBar}</Text>
      <Text color={theme.textDim}>]</Text>
      {showPercentage && (
        <Text color={theme.textMuted}> {progress}%</Text>
      )}
    </Box>
  );
}

// Bouncing dots for waiting states
export function BouncingDots({ color = catppuccin.lavender }: { color?: string }) {
  const [frame, setFrame] = useState(0);
  const frames = ['   ', '.  ', '.. ', '...', ' ..', '  .'];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 200);
    return () => clearInterval(timer);
  }, [frames.length]);

  return <Text color={color}>{frames[frame]}</Text>;
}

// Animated ellipsis
export function AnimatedEllipsis({ color = theme.textMuted }: { color?: string }) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return <Text color={color}>{'.'.repeat(dots).padEnd(3)}</Text>;
}

// Gradient wave animation
export function GradientWave({ 
  text = '●●●●●',
  colors = gradients.primary,
}: {
  text?: string;
  colors?: string[];
}) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setOffset(prev => (prev + 1) % colors.length);
    }, 150);
    return () => clearInterval(timer);
  }, [colors.length]);

  // Shift colors for wave effect
  const shiftedColors = [
    ...colors.slice(offset),
    ...colors.slice(0, offset),
  ];

  return (
    <Gradient colors={shiftedColors}>
      <Text>{text}</Text>
    </Gradient>
  );
}
