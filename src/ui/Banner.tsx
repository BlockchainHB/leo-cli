/**
 * Banner Component
 *
 * Clean, centered banner design
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import Gradient from 'ink-gradient';
import { theme, claude } from './colors.js';

// Clean ASCII "LEO" text
const LEO_ASCII = [
  '██╗     ███████╗ ██████╗ ',
  '██║     ██╔════╝██╔═══██╗',
  '██║     █████╗  ██║   ██║',
  '██║     ██╔══╝  ██║   ██║',
  '███████╗███████╗╚██████╔╝',
  '╚══════╝╚══════╝ ╚═════╝ ',
];

const LEO_WIDTH = 25; // Width of the ASCII art

// Inspirational quotes for content creators
const QUOTES = [
  { text: "Content is king, but distribution is queen.", author: "Gary Vaynerchuk" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Create content that teaches.", author: "Neil Patel" },
  { text: "Quality over quantity.", author: "Unknown" },
  { text: "Write drunk, edit sober.", author: "Ernest Hemingway" },
  { text: "Start before you're ready.", author: "Steven Pressfield" },
  { text: "Ship it.", author: "Seth Godin" },
  { text: "Ideas are worthless without execution.", author: "Derek Sivers" },
];

// Commands list
const COMMANDS = [
  { cmd: '/write-blog', desc: 'write article' },
  { cmd: '/queue-status', desc: 'view queue' },
  { cmd: '/publish', desc: 'to CMS' },
  { cmd: '/clear', desc: 'start fresh' },
  { cmd: '/help', desc: 'all commands' },
];

interface BannerProps {
  interrupted?: string | null;
  version?: string;
}

// Helper to wrap text to a max width
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Helper to center text
function centerPad(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

export function Banner({ interrupted, version = '1.0.0' }: BannerProps) {
  const { stdout } = useStdout();
  const [colorShift, setColorShift] = useState(0);

  // Pick a random quote on mount
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  useEffect(() => {
    const timer = setInterval(() => {
      setColorShift(i => (i + 1) % 4);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  // Subtle gradient colors - orange accent theme
  const logoColors = [
    ['#f97316', '#fb923c', '#fdba74'],
    ['#fb923c', '#fdba74', '#f97316'],
    ['#fdba74', '#f97316', '#fb923c'],
    ['#f97316', '#fdba74', '#fb923c'],
  ][colorShift];

  // Terminal width
  const termWidth = stdout?.columns || 80;
  const contentWidth = Math.min(termWidth - 4, 70); // Max content width
  const quoteMaxWidth = contentWidth - 4; // Leave room for quotes

  // Wrap the quote text
  const wrappedQuote = wrapText(`"${quote.text}"`, quoteMaxWidth);

  return (
    <Box flexDirection="column" alignItems="center">
      {/* Top border */}
      <Box>
        <Text color={theme.border}>╭─</Text>
        <Text color={claude.accent}> Leo v{version} </Text>
        <Text color={theme.border}>{'─'.repeat(Math.max(0, contentWidth - 12 - version.length))}╮</Text>
      </Box>

      {/* Centered LEO ASCII */}
      <Box flexDirection="column" alignItems="center" width={contentWidth}>
        <Text> </Text>
        {LEO_ASCII.map((line, i) => (
          <Box key={i} justifyContent="center" width={contentWidth}>
            <Text color={theme.border}>│</Text>
            <Box flexGrow={1} justifyContent="center">
              <Gradient colors={logoColors}>
                <Text>{line}</Text>
              </Gradient>
            </Box>
            <Text color={theme.border}>│</Text>
          </Box>
        ))}
      </Box>

      {/* Quote - centered and wrapped */}
      <Box flexDirection="column" alignItems="center" width={contentWidth}>
        <Box width={contentWidth}>
          <Text color={theme.border}>│</Text>
          <Box flexGrow={1} />
          <Text color={theme.border}>│</Text>
        </Box>
        {wrappedQuote.map((line, i) => (
          <Box key={i} width={contentWidth}>
            <Text color={theme.border}>│</Text>
            <Box flexGrow={1} justifyContent="center">
              <Text color={theme.textMuted} italic>{line}</Text>
            </Box>
            <Text color={theme.border}>│</Text>
          </Box>
        ))}
        <Box width={contentWidth}>
          <Text color={theme.border}>│</Text>
          <Box flexGrow={1} justifyContent="center">
            <Text color={theme.textDim}>— {quote.author}</Text>
          </Box>
          <Text color={theme.border}>│</Text>
        </Box>
      </Box>

      {/* Commands list - centered */}
      <Box flexDirection="column" alignItems="center" width={contentWidth}>
        <Box width={contentWidth}>
          <Text color={theme.border}>│</Text>
          <Box flexGrow={1} />
          <Text color={theme.border}>│</Text>
        </Box>
        {COMMANDS.map((c, i) => (
          <Box key={i} width={contentWidth}>
            <Text color={theme.border}>│</Text>
            <Box flexGrow={1} justifyContent="center">
              <Text color={theme.textSecondary}>{c.cmd}</Text>
              <Text color={theme.textDim}>  {c.desc}</Text>
            </Box>
            <Text color={theme.border}>│</Text>
          </Box>
        ))}
        <Box width={contentWidth}>
          <Text color={theme.border}>│</Text>
          <Box flexGrow={1} />
          <Text color={theme.border}>│</Text>
        </Box>
      </Box>

      {/* Interrupted warning if any */}
      {interrupted && (
        <Box width={contentWidth}>
          <Text color={theme.border}>│</Text>
          <Box flexGrow={1} justifyContent="center">
            <Text color={theme.warning}>⚠ {interrupted}</Text>
          </Box>
          <Text color={theme.border}>│</Text>
        </Box>
      )}

      {/* Bottom border */}
      <Box>
        <Text color={theme.border}>╰{'─'.repeat(contentWidth - 2)}╯</Text>
      </Box>

      {/* Hints */}
      <Box justifyContent="center" marginTop={1}>
        <Text color={theme.textDim}>
          <Text color={theme.textSecondary}>ESC</Text>
          <Text> cancel</Text>
          <Text color={theme.textDim}> · </Text>
          <Text color={theme.textSecondary}>Ctrl+C</Text>
          <Text> exit</Text>
        </Text>
      </Box>
    </Box>
  );
}
