/**
 * Progress Tracking
 * 
 * Manages session state for long-running blog workflows.
 * Following Anthropic's guide for multi-context-window agents.
 */

import * as fs from 'fs';
import { readFile, writeFile, access } from 'fs/promises';
import * as path from 'path';
import type { BlogProgress, SessionLogEntry, CompletedArticle, PhaseTimings } from './types/index.js';

const PROGRESS_FILE = 'blog-progress.json';

/**
 * Get the path to the progress file.
 */
function getProgressPath(cwd?: string): string {
  return path.join(cwd || process.cwd(), PROGRESS_FILE);
}

/**
 * Initialize an empty progress file if it doesn't exist.
 */
export function initProgress(cwd?: string): BlogProgress {
  const progressPath = getProgressPath(cwd);
  
  const initial: BlogProgress = {
    current_article: undefined,
    session_log: [],
    completed_articles: []
  };

  if (!fs.existsSync(progressPath)) {
    fs.writeFileSync(progressPath, JSON.stringify(initial, null, 2));
  }

  return initial;
}

/**
 * Load the current progress state.
 */
export function loadProgress(cwd?: string): BlogProgress {
  const progressPath = getProgressPath(cwd);
  
  if (!fs.existsSync(progressPath)) {
    return initProgress(cwd);
  }

  try {
    const content = fs.readFileSync(progressPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load progress, initializing fresh:', error);
    return initProgress(cwd);
  }
}

/**
 * Save the progress state.
 */
export function saveProgress(progress: BlogProgress, cwd?: string): void {
  const progressPath = getProgressPath(cwd);
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * Log an action to the session log.
 */
export function logAction(action: string, cwd?: string): void {
  const progress = loadProgress(cwd);
  
  const entry: SessionLogEntry = {
    timestamp: new Date().toISOString(),
    action
  };
  
  progress.session_log.push(entry);
  
  // Keep only last 100 entries
  if (progress.session_log.length > 100) {
    progress.session_log = progress.session_log.slice(-100);
  }
  
  saveProgress(progress, cwd);
}

/**
 * Start working on a new article.
 */
export function startArticle(keyword: string, cwd?: string): void {
  const progress = loadProgress(cwd);
  
  progress.current_article = {
    keyword,
    status: 'researching',
    started_at: new Date().toISOString(),
    research_complete: false,
    images_generated: 0
  };
  
  logAction(`Started working on "${keyword}"`);
  saveProgress(progress, cwd);
}

/**
 * Update the current article's status.
 */
export function updateArticleStatus(
  updates: Partial<NonNullable<BlogProgress['current_article']>>,
  cwd?: string
): void {
  const progress = loadProgress(cwd);
  
  if (!progress.current_article) {
    console.warn('No current article to update');
    return;
  }
  
  progress.current_article = {
    ...progress.current_article,
    ...updates
  };
  
  saveProgress(progress, cwd);
}

/**
 * Mark the current article as complete and published.
 */
export function completeArticle(
  sanityId: string,
  slug: string,
  cwd?: string
): void {
  const progress = loadProgress(cwd);
  
  if (!progress.current_article) {
    console.warn('No current article to complete');
    return;
  }
  
  const completed: CompletedArticle = {
    keyword: progress.current_article.keyword,
    sanity_id: sanityId,
    slug,
    published_at: new Date().toISOString()
  };
  
  progress.completed_articles.push(completed);
  progress.current_article = undefined;
  
  logAction(`Published "${completed.keyword}" as ${slug}`);
  saveProgress(progress, cwd);
}

/**
 * Get summary of current progress for display.
 */
export function getProgressSummary(cwd?: string): string {
  const progress = loadProgress(cwd);
  
  let summary = '## Blog Progress\n\n';
  
  if (progress.current_article) {
    summary += '### Current Work\n';
    summary += `- Keyword: ${progress.current_article.keyword}\n`;
    summary += `- Status: ${progress.current_article.status}\n`;
    summary += `- Started: ${progress.current_article.started_at}\n`;
    if (progress.current_article.draft_path) {
      summary += `- Draft: ${progress.current_article.draft_path}\n`;
    }
    summary += '\n';
  } else {
    summary += 'No article in progress.\n\n';
  }
  
  summary += `### Completed: ${progress.completed_articles.length} articles\n`;
  
  if (progress.completed_articles.length > 0) {
    const recent = progress.completed_articles.slice(-5);
    recent.forEach(article => {
      summary += `- ${article.keyword} → /${article.slug}\n`;
    });
  }
  
  summary += '\n### Recent Activity\n';
  const recentLogs = progress.session_log.slice(-5);
  recentLogs.forEach(log => {
    const time = new Date(log.timestamp).toLocaleTimeString();
    summary += `- [${time}] ${log.action}\n`;
  });
  
  return summary;
}

/**
 * Check if there's an interrupted article that needs resuming.
 */
export function hasInterruptedWork(cwd?: string): boolean {
  const progress = loadProgress(cwd);
  // Check for both undefined and null (JSON parses null, not undefined)
  return progress.current_article != null && progress.current_article.keyword != null;
}

/**
 * Get the interrupted article details for resumption.
 */
export function getInterruptedArticle(cwd?: string): BlogProgress['current_article'] {
  const progress = loadProgress(cwd);
  return progress.current_article;
}

// ─────────────────────────────────────────────────────────────────────────────
// Async Progress Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load progress state (async version).
 */
export async function loadProgressAsync(cwd?: string): Promise<BlogProgress> {
  const progressPath = getProgressPath(cwd);

  try {
    await access(progressPath);
    const content = await readFile(progressPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return initProgress(cwd);
  }
}

/**
 * Save progress state (async version).
 */
export async function saveProgressAsync(progress: BlogProgress, cwd?: string): Promise<void> {
  const progressPath = getProgressPath(cwd);
  await writeFile(progressPath, JSON.stringify(progress, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase Tracking
// ─────────────────────────────────────────────────────────────────────────────

export type Phase = 'research' | 'scraping' | 'analysis' | 'writing' | 'images';

/**
 * Mark the start of a workflow phase.
 */
export async function startPhase(phase: Phase, cwd?: string): Promise<void> {
  const progress = await loadProgressAsync(cwd);
  if (!progress.current_article) return;

  if (!progress.current_article.phase_timings) {
    progress.current_article.phase_timings = {};
  }

  const startKey = `${phase}_started` as keyof PhaseTimings;
  progress.current_article.phase_timings[startKey] = new Date().toISOString();

  await saveProgressAsync(progress, cwd);
  logAction(`Phase started: ${phase}`, cwd);
}

/**
 * Mark the completion of a workflow phase.
 * Returns duration in milliseconds if start time was recorded.
 */
export async function completePhase(
  phase: Phase,
  cwd?: string
): Promise<{ durationMs: number } | null> {
  const progress = await loadProgressAsync(cwd);
  if (!progress.current_article?.phase_timings) return null;

  const startKey = `${phase}_started` as keyof PhaseTimings;
  const endKey = `${phase}_completed` as keyof PhaseTimings;

  const startTime = progress.current_article.phase_timings[startKey];
  if (!startTime) return null;

  const endTime = new Date().toISOString();
  progress.current_article.phase_timings[endKey] = endTime;
  await saveProgressAsync(progress, cwd);

  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  logAction(`Phase completed: ${phase} (${Math.round(durationMs / 1000)}s)`, cwd);

  return { durationMs };
}

/**
 * Get duration of each completed phase in milliseconds.
 */
export function getPhaseDurations(progress: BlogProgress): Record<Phase, number | null> {
  const timings = progress.current_article?.phase_timings;
  const phases: Phase[] = ['research', 'scraping', 'analysis', 'writing', 'images'];

  const durations: Record<Phase, number | null> = {
    research: null,
    scraping: null,
    analysis: null,
    writing: null,
    images: null
  };

  if (!timings) return durations;

  for (const phase of phases) {
    const started = timings[`${phase}_started` as keyof PhaseTimings];
    const completed = timings[`${phase}_completed` as keyof PhaseTimings];
    if (started && completed) {
      durations[phase] = new Date(completed).getTime() - new Date(started).getTime();
    }
  }

  return durations;
}

/**
 * Get a formatted summary of phase durations.
 */
export function getPhaseDurationSummary(progress: BlogProgress): string {
  const durations = getPhaseDurations(progress);
  const lines: string[] = [];

  for (const [phase, ms] of Object.entries(durations)) {
    if (ms !== null) {
      const seconds = Math.round(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      const formatted = minutes > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${seconds}s`;
      lines.push(`  ${phase}: ${formatted}`);
    }
  }

  return lines.length > 0
    ? 'Phase Durations:\n' + lines.join('\n')
    : 'No phase timings recorded.';
}

