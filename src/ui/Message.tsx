/**
 * Message Component
 *
 * Clean markdown rendering for terminal output
 * Memoized to prevent re-parsing during streaming
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme, claude, statusIcons } from './colors.js';

interface MessageProps {
  content: string;
  type?: 'text' | 'error' | 'system' | 'success' | 'warning';
  prefix?: React.ReactNode; // Optional prefix to show inline with first line
}

export const Message = React.memo(function Message({ content, type = 'text', prefix }: MessageProps) {
  if (!content) return null;

  switch (type) {
    case 'error':
      return (
        <Box>
          <Text color={theme.error}>{statusIcons.error} </Text>
          <Text color={theme.error}>{content}</Text>
        </Box>
      );
    case 'system':
      return (
        <Box>
          <Text color={theme.textMuted}>{content}</Text>
        </Box>
      );
    case 'success':
      return (
        <Box>
          <Text color={theme.success}>{statusIcons.success} </Text>
          <Text color={claude.success}>{content}</Text>
        </Box>
      );
    case 'warning':
      return (
        <Box>
          <Text color={theme.warning}>{statusIcons.warning} </Text>
          <Text color={theme.warning}>{content}</Text>
        </Box>
      );
    default:
      return <FormattedText content={content} prefix={prefix} />;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Formatting - Memoized
// ─────────────────────────────────────────────────────────────────────────────

const FormattedText = React.memo(function FormattedText({ content, prefix }: { content: string; prefix?: React.ReactNode }) {
  // Memoize parsed lines to prevent re-parsing on every render
  const lines = useMemo(() => content.split('\n'), [content]);

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <FormattedLine key={i} line={line} prefix={i === 0 ? prefix : undefined} />
      ))}
    </Box>
  );
});

const FormattedLine = React.memo(function FormattedLine({ line, prefix }: { line: string; prefix?: React.ReactNode }) {
  // H1 Headers
  if (line.startsWith('# ')) {
    return (
      <Box marginTop={1}>
        {prefix}
        <Text color={theme.text} bold>{line.slice(2)}</Text>
      </Box>
    );
  }

  // H2 Headers
  if (line.startsWith('## ')) {
    return (
      <Box marginTop={1}>
        {prefix}
        <Text color={theme.text} bold>{line.slice(3)}</Text>
      </Box>
    );
  }

  // H3 Headers
  if (line.startsWith('### ')) {
    return (
      <Box>
        {prefix}
        <Text color={theme.textSecondary} bold>{line.slice(4)}</Text>
      </Box>
    );
  }

  // Bullet points
  if (/^\s*[-*]\s/.test(line)) {
    const match = line.match(/^(\s*)([-*])\s(.*)$/);
    if (match) {
      const [, indent, , text] = match;
      const level = Math.floor(indent.length / 2);
      const bullets = ['•', '◦', '▸'];
      const bullet = bullets[level % bullets.length];

      return (
        <Box marginLeft={level * 2}>
          {prefix}
          <Text color={theme.textMuted}>{bullet} </Text>
          <InlineText text={text} />
        </Box>
      );
    }
  }

  // Numbered lists
  if (/^\s*\d+\.\s/.test(line)) {
    const match = line.match(/^(\s*)(\d+)\.\s(.*)$/);
    if (match) {
      const [, indent, num, text] = match;
      const level = Math.floor(indent.length / 2);

      return (
        <Box marginLeft={level * 2}>
          {prefix}
          <Text color={theme.textMuted}>{num}. </Text>
          <InlineText text={text} />
        </Box>
      );
    }
  }

  // Blockquotes
  if (line.startsWith('> ')) {
    return (
      <Box marginLeft={1}>
        {prefix}
        <Text color={theme.textDim}>│</Text>
        <Text color={theme.textMuted} italic> {line.slice(2)}</Text>
      </Box>
    );
  }

  // Code fence markers
  if (line.startsWith('```')) {
    const lang = line.slice(3).trim();
    if (lang) {
      return (
        <Box marginTop={1}>
          {prefix}
          <Text color={theme.textDim}>┌─ </Text>
          <Text color={claude.success}>{lang}</Text>
        </Box>
      );
    }
    return <Text color={theme.textDim}>└───</Text>;
  }

  // Horizontal rule
  if (/^[-=_]{3,}$/.test(line.trim())) {
    return (
      <Box marginY={1}>
        {prefix}
        <Text color={theme.borderDim}>{'─'.repeat(30)}</Text>
      </Box>
    );
  }

  // Empty lines
  if (!line.trim()) {
    if (prefix) {
      return <Box>{prefix}</Box>;
    }
    return <Text> </Text>;
  }

  // Regular text (with or without prefix)
  const parts = parseInlineText(line);
  return (
    <Text wrap="wrap">
      {prefix}
      {parts}
    </Text>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Inline Text Formatting - Memoized
// ─────────────────────────────────────────────────────────────────────────────

const InlineText = React.memo(function InlineText({ text }: { text: string }) {
  // Memoize parsed parts
  const parts = useMemo(() => parseInlineText(text), [text]);
  return <Text wrap="wrap">{parts}</Text>;
});

function parseInlineText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<Text key={key++} color={theme.text}>{boldMatch[1]}</Text>);
      parts.push(<Text key={key++} color={theme.text} bold>{boldMatch[2]}</Text>);
      remaining = boldMatch[3];
      continue;
    }

    // Italic *text*
    const italicMatch = remaining.match(/^(.*?)\*([^*]+)\*(.*)/);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<Text key={key++} color={theme.text}>{italicMatch[1]}</Text>);
      parts.push(<Text key={key++} color={theme.textSecondary} italic>{italicMatch[2]}</Text>);
      remaining = italicMatch[3];
      continue;
    }

    // Inline code `code`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<Text key={key++} color={theme.text}>{codeMatch[1]}</Text>);
      parts.push(<Text key={key++} color={claude.success}>{codeMatch[2]}</Text>);
      remaining = codeMatch[3];
      continue;
    }

    // Links [text](url)
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/);
    if (linkMatch) {
      if (linkMatch[1]) parts.push(<Text key={key++} color={theme.text}>{linkMatch[1]}</Text>);
      parts.push(<Text key={key++} color={claude.link} underline>{linkMatch[2]}</Text>);
      remaining = linkMatch[4];
      continue;
    }

    // No more formatting
    parts.push(<Text key={key++} color={theme.text}>{remaining}</Text>);
    break;
  }

  return parts;
}
