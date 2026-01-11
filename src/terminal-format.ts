/**
 * Terminal Markdown Formatter
 * 
 * Converts markdown-style formatting to ANSI terminal colors and styles.
 * Makes CLI output look clean and readable like Claude Code.
 */

import chalk from 'chalk';

/**
 * Format markdown text for terminal display.
 * Converts markdown syntax to ANSI escape codes.
 */
export function formatMarkdown(text: string): string {
  if (!text) return '';
  
  let formatted = text;
  
  // Headers - make them bold and cyan
  formatted = formatted.replace(/^### (.+)$/gm, (_, content) => 
    chalk.bold.cyan(`   ${content}`)
  );
  formatted = formatted.replace(/^## (.+)$/gm, (_, content) => 
    chalk.bold.cyan(`\n  ${content}\n`)
  );
  formatted = formatted.replace(/^# (.+)$/gm, (_, content) => 
    chalk.bold.cyanBright(`\n ${content}\n`)
  );
  
  // Bold text **text** or __text__
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, (_, content) => 
    chalk.bold(content)
  );
  formatted = formatted.replace(/__(.+?)__/g, (_, content) => 
    chalk.bold(content)
  );
  
  // Italic text *text* or _text_ (but not inside words)
  formatted = formatted.replace(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g, (_, content) => 
    chalk.italic(content)
  );
  formatted = formatted.replace(/(?<![_\w])_([^_\n]+?)_(?![_\w])/g, (_, content) => 
    chalk.italic(content)
  );
  
  // Inline code `code`
  formatted = formatted.replace(/`([^`\n]+?)`/g, (_, content) => 
    chalk.yellow(content)
  );
  
  // Links [text](url) - show text in blue, url in dim
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => 
    chalk.blue(linkText) + chalk.dim(` (${url})`)
  );
  
  // Bullet points - add colored bullets
  formatted = formatted.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, content) => 
    `${indent}${chalk.cyan('•')} ${content}`
  );
  
  // Numbered lists - colorize numbers
  formatted = formatted.replace(/^(\s*)(\d+)\. (.+)$/gm, (_, indent, num, content) => 
    `${indent}${chalk.cyan(num + '.')} ${content}`
  );
  
  // Blockquotes > text
  formatted = formatted.replace(/^> (.+)$/gm, (_, content) => 
    chalk.dim.italic(`  │ ${content}`)
  );
  
  // Horizontal rules --- or ***
  formatted = formatted.replace(/^[-*]{3,}$/gm, () => 
    chalk.dim('─'.repeat(50))
  );
  
  // Tables - basic styling for | separators
  formatted = formatted.replace(/\|/g, chalk.dim('│'));
  
  return formatted;
}

/**
 * Format a table for terminal display.
 * Input: array of objects or 2D array
 */
export function formatTable(data: Record<string, unknown>[] | string[][]): string {
  if (!data || data.length === 0) return '';
  
  // Convert objects to 2D array if needed
  let rows: string[][];
  let headers: string[];
  
  if (Array.isArray(data[0]) && typeof data[0][0] === 'string') {
    // Already a 2D array, first row is headers
    rows = data as string[][];
    headers = rows[0];
    rows = rows.slice(1);
  } else {
    // Array of objects
    const objects = data as Record<string, unknown>[];
    headers = Object.keys(objects[0]);
    rows = objects.map(obj => headers.map(h => String(obj[h] ?? '')));
  }
  
  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxDataWidth = Math.max(...rows.map(r => String(r[i] || '').length));
    return Math.max(h.length, maxDataWidth);
  });
  
  // Build table
  const lines: string[] = [];
  
  // Header row
  const headerRow = headers.map((h, i) => chalk.bold(h.padEnd(colWidths[i]))).join(chalk.dim(' │ '));
  lines.push(headerRow);
  
  // Separator
  const separator = colWidths.map(w => '─'.repeat(w)).join(chalk.dim('─┼─'));
  lines.push(chalk.dim(separator));
  
  // Data rows
  for (const row of rows) {
    const dataRow = row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(chalk.dim(' │ '));
    lines.push(dataRow);
  }
  
  return lines.join('\n');
}

/**
 * Create a styled box around text.
 */
export function formatBox(title: string, content: string): string {
  const lines = content.split('\n');
  const maxWidth = Math.max(title.length, ...lines.map(l => l.length)) + 4;
  
  const top = chalk.cyan('╭' + '─'.repeat(maxWidth) + '╮');
  const titleLine = chalk.cyan('│ ') + chalk.bold(title.padEnd(maxWidth - 2)) + chalk.cyan(' │');
  const separator = chalk.cyan('├' + '─'.repeat(maxWidth) + '┤');
  const contentLines = lines.map(l => chalk.cyan('│ ') + l.padEnd(maxWidth - 2) + chalk.cyan(' │'));
  const bottom = chalk.cyan('╰' + '─'.repeat(maxWidth) + '╯');
  
  return [top, titleLine, separator, ...contentLines, bottom].join('\n');
}

/**
 * Format a status message with icon.
 */
export function formatStatus(status: 'success' | 'error' | 'warning' | 'info' | 'pending', message: string): string {
  const icons = {
    success: chalk.green('✓'),
    error: chalk.red('✗'),
    warning: chalk.yellow('⚠'),
    info: chalk.blue('ℹ'),
    pending: chalk.cyan('◐')
  };
  
  const colors = {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue,
    pending: chalk.cyan
  };
  
  return `${icons[status]} ${colors[status](message)}`;
}

/**
 * Format a progress indicator.
 */
export function formatProgress(label: string, current: number, total: number): string {
  const percentage = Math.round((current / total) * 100);
  const barWidth = 20;
  const filled = Math.round((current / total) * barWidth);
  const empty = barWidth - filled;
  
  const bar = chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  return `${label} ${bar} ${chalk.bold(`${percentage}%`)} (${current}/${total})`;
}

export { chalk };

