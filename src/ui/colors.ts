/**
 * Enhanced Color Palette
 * 
 * Combines Catppuccin Mocha with vibrant gradients for a stunning CLI experience
 */

// Catppuccin Mocha base palette
export const catppuccin = {
  // Accent colors
  rosewater: '#f5e0dc',
  flamingo: '#f2cdcd',
  pink: '#f5c2e7',
  mauve: '#cba6f7',
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
  
  // Text colors
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  
  // Overlay colors
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',
  
  // Surface colors
  surface2: '#585b70',
  surface1: '#45475a',
  surface0: '#313244',
  
  // Base colors
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
};

// Claude Code inspired colors - cleaner, less blue tint
export const claude = {
  // Text colors - pure whites and grays, no blue tint
  text: '#e5e5e5',           // Main text - soft white
  textSecondary: '#a3a3a3',  // Secondary text - medium gray
  textMuted: '#737373',      // Muted text - darker gray
  textDim: '#525252',        // Very dim text

  // Accent colors - Claude Code uses orange
  accent: '#f97316',         // Orange - Claude Code's signature color
  accentDim: '#ea580c',      // Darker orange
  link: '#60a5fa',           // Blue for links
  success: '#4ade80',        // Green for success
  warning: '#fbbf24',        // Yellow for warnings
  error: '#f87171',          // Red for errors

  // UI colors
  border: '#404040',         // Neutral border
  borderDim: '#303030',      // Dimmer border
  surface: '#262626',        // Surface background
};

// Semantic color aliases - updated for Claude Code style
export const theme = {
  primary: claude.accent,
  secondary: '#a1a1aa',      // Neutral secondary
  accent: claude.accent,
  success: claude.success,
  warning: claude.warning,
  error: claude.error,
  info: claude.link,

  text: claude.text,
  textMuted: claude.textMuted,
  textDim: claude.textDim,
  textSecondary: claude.textSecondary,

  border: claude.border,
  borderDim: claude.borderDim,
};

// Gradient presets for different contexts
export const gradients = {
  primary: ['#cba6f7', '#89b4fa', '#94e2d5'],      // mauve → blue → teal
  success: ['#a6e3a1', '#94e2d5', '#89dceb'],      // green → teal → sky
  warning: ['#f9e2af', '#fab387', '#f38ba8'],      // yellow → peach → red
  info: ['#89dceb', '#74c7ec', '#89b4fa'],         // sky → sapphire → blue
  rainbow: ['#f5c2e7', '#cba6f7', '#89b4fa', '#94e2d5', '#a6e3a1', '#f9e2af', '#fab387'],
  sunset: ['#f38ba8', '#fab387', '#f9e2af'],       // red → peach → yellow
  ocean: ['#89b4fa', '#74c7ec', '#94e2d5'],        // blue → sapphire → teal
  fire: ['#f38ba8', '#fab387', '#f9e2af'],         // red → peach → yellow
  aurora: ['#b4befe', '#cba6f7', '#f5c2e7', '#fab387'], // lavender → mauve → pink → peach
};

// Spinner character sets for different styles
export const spinnerFrames = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  dots2: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  dots3: ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
  line: ['-', '\\', '|', '/'],
  star: ['✶', '✸', '✹', '✺', '✹', '✷'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  circle: ['◐', '◓', '◑', '◒'],
  square: ['◰', '◳', '◲', '◱'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  moon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
  earth: ['🌍', '🌎', '🌏'],
  clock: ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  pulse: ['█', '▓', '▒', '░', '▒', '▓'],
  grow: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],
};

// Tool-specific icons with colors
export const toolIcons: Record<string, { icon: string; color: string }> = {
  'Read': { icon: '📄', color: catppuccin.sky },
  'Write': { icon: '✏️', color: catppuccin.peach },
  'Edit': { icon: '🔧', color: catppuccin.yellow },
  'Bash': { icon: '⚡', color: catppuccin.green },
  'Grep': { icon: '🔍', color: catppuccin.lavender },
  'Glob': { icon: '📁', color: catppuccin.blue },
  'Task': { icon: '🤖', color: catppuccin.pink },
  'Skill': { icon: '🎯', color: catppuccin.mauve },
  'mcp__ahrefs': { icon: '📊', color: catppuccin.teal },
  'mcp__supabase': { icon: '🗄️', color: catppuccin.green },
  'default': { icon: '⚙️', color: catppuccin.lavender },
};

// Status icons
export const statusIcons = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  pending: '○',
  running: '●',
  cancelled: '⊘',
};

// Box drawing characters for beautiful borders
export const boxChars = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
};

// Progress bar styles
export const progressStyles = {
  smooth: { filled: '█', empty: '░', start: '', end: '' },
  rounded: { filled: '●', empty: '○', start: '', end: '' },
  blocks: { filled: '▓', empty: '░', start: '[', end: ']' },
  arrows: { filled: '▶', empty: '▷', start: '', end: '' },
};
