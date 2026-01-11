/**
 * Session Management for Leo
 *
 * Handles session persistence to prevent disconnection issues.
 * Sessions are stored locally and can be resumed across restarts.
 *
 * Uses async I/O to avoid blocking the event loop.
 */

import { readFile, writeFile, access, readdir } from 'fs/promises';
import { join, basename } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionState {
  sessionId: string | null;
  lastActive: string;
  messageCount: number;
  currentTask: string | null;
  heartbeatCount?: number;
  createdAt?: string;
  name?: string;           // User-defined session name
  summary?: string;        // Brief description of session
  toolCalls?: number;      // Total tool calls in session
  estimatedCost?: number;  // Estimated cost in USD
}

export interface SessionHistoryEntry {
  sessionId: string;
  name: string;
  createdAt: string;
  lastActive: string;
  messageCount: number;
  summary?: string;
  estimatedCost?: number;
}

export interface SessionHealth {
  isHealthy: boolean;
  heartbeatCount: number;
  lastHeartbeat: string;
  sessionId: string | null;
  age: number; // ms since last activity
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_FILE = 'leo-session.json';
const SESSION_HISTORY_DIR = '.leo-sessions';
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_SESSIONS = 20; // Keep last 20 sessions

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getSessionPath(cwd: string): string {
  return join(cwd, SESSION_FILE);
}

/**
 * Check if a file exists (async)
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Persistence (Async)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load session state from disk
 */
export async function loadSession(cwd: string): Promise<SessionState | null> {
  const path = getSessionPath(cwd);

  if (!(await fileExists(path))) {
    return null;
  }

  try {
    const data = await readFile(path, 'utf-8');
    const state = JSON.parse(data) as SessionState;

    // Check if session is expired
    const lastActive = new Date(state.lastActive).getTime();
    const now = Date.now();

    if (now - lastActive > SESSION_EXPIRY_MS) {
      // Session expired, clear it
      await clearSession(cwd);
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Save session state to disk
 */
export async function saveSession(cwd: string, state: Partial<SessionState>): Promise<void> {
  const path = getSessionPath(cwd);
  const existing = await loadSession(cwd);

  const newState: SessionState = {
    sessionId: state.sessionId ?? existing?.sessionId ?? null,
    lastActive: new Date().toISOString(),
    messageCount: state.messageCount ?? (existing?.messageCount ?? 0) + 1,
    currentTask: state.currentTask ?? existing?.currentTask ?? null,
  };

  try {
    await writeFile(path, JSON.stringify(newState, null, 2));
  } catch (err) {
    console.error('[session] Failed to save:', err);
  }
}

/**
 * Clear session state (on explicit reset or error)
 */
export async function clearSession(cwd: string): Promise<void> {
  const path = getSessionPath(cwd);

  try {
    if (await fileExists(path)) {
      await writeFile(path, JSON.stringify({
        sessionId: null,
        lastActive: new Date().toISOString(),
        messageCount: 0,
        currentTask: null,
      }, null, 2));
    }
  } catch {
    // Ignore errors when clearing
  }
}

/**
 * Get current session ID if valid
 */
export async function getSessionId(cwd: string): Promise<string | null> {
  const state = await loadSession(cwd);
  return state?.sessionId ?? null;
}

/**
 * Update session activity timestamp (call this periodically to keep session alive)
 */
export async function touchSession(cwd: string): Promise<void> {
  const state = await loadSession(cwd);
  if (state?.sessionId) {
    await saveSession(cwd, { lastActive: new Date().toISOString() } as Partial<SessionState>);
  }
}

/**
 * Check if we have a valid resumable session
 */
export async function hasValidSession(cwd: string): Promise<boolean> {
  const state = await loadSession(cwd);
  return state?.sessionId !== null && state?.sessionId !== undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Heartbeat
// ─────────────────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute
const HEALTH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get current session health status without modifying state.
 */
export async function getSessionHealth(cwd: string): Promise<SessionHealth> {
  const state = await loadSession(cwd);

  if (!state) {
    return {
      isHealthy: false,
      heartbeatCount: 0,
      lastHeartbeat: new Date().toISOString(),
      sessionId: null,
      age: 0
    };
  }

  const lastActive = new Date(state.lastActive).getTime();
  const age = Date.now() - lastActive;

  return {
    isHealthy: age < HEALTH_THRESHOLD_MS,
    heartbeatCount: state.heartbeatCount ?? 0,
    lastHeartbeat: state.lastActive,
    sessionId: state.sessionId,
    age
  };
}

/**
 * Extend session expiry by updating lastActive and incrementing heartbeat count.
 */
export async function extendSession(cwd: string): Promise<void> {
  const path = getSessionPath(cwd);
  const state = await loadSession(cwd);

  if (!state?.sessionId) return;

  const updatedState: SessionState = {
    ...state,
    lastActive: new Date().toISOString(),
    heartbeatCount: (state.heartbeatCount ?? 0) + 1
  };

  try {
    await writeFile(path, JSON.stringify(updatedState, null, 2));
  } catch (err) {
    console.error('[session] Failed to extend:', err);
  }
}

/**
 * Start a heartbeat interval that keeps the session alive.
 * Returns an object with:
 * - stop(): Function to stop the heartbeat
 * - getHealth(): Function to check current health
 */
export function startHeartbeat(cwd: string): {
  stop: () => void;
  getHealth: () => Promise<SessionHealth>;
} {
  const intervalId = setInterval(async () => {
    try {
      await extendSession(cwd);
    } catch (err) {
      console.error('[session] Heartbeat failed:', err);
    }
  }, HEARTBEAT_INTERVAL_MS);

  return {
    stop: () => clearInterval(intervalId),
    getHealth: () => getSessionHealth(cwd)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Session History Management
// ─────────────────────────────────────────────────────────────────────────────

function getHistoryDir(cwd: string): string {
  return join(cwd, SESSION_HISTORY_DIR);
}

function getHistoryFilePath(cwd: string, sessionId: string): string {
  return join(getHistoryDir(cwd), `${sessionId}.json`);
}

/**
 * Ensure history directory exists
 */
async function ensureHistoryDir(cwd: string): Promise<void> {
  const dir = getHistoryDir(cwd);
  try {
    await access(dir);
  } catch {
    const { mkdir } = await import('fs/promises');
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Save current session to history
 */
export async function archiveSession(cwd: string): Promise<void> {
  const state = await loadSession(cwd);
  if (!state?.sessionId) return;

  await ensureHistoryDir(cwd);

  const historyPath = getHistoryFilePath(cwd, state.sessionId);
  const historyEntry: SessionHistoryEntry = {
    sessionId: state.sessionId,
    name: state.name || generateSessionName(state.createdAt || state.lastActive),
    createdAt: state.createdAt || state.lastActive,
    lastActive: state.lastActive,
    messageCount: state.messageCount,
    summary: state.summary,
    estimatedCost: state.estimatedCost,
  };

  try {
    await writeFile(historyPath, JSON.stringify(historyEntry, null, 2));
    await pruneOldSessions(cwd);
  } catch (err) {
    console.error('[session] Failed to archive:', err);
  }
}

/**
 * Generate a default session name based on timestamp
 */
function generateSessionName(timestamp: string): string {
  const date = new Date(timestamp);
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${month} ${day}, ${time}`;
}

/**
 * List all sessions in history
 */
export async function listSessions(cwd: string): Promise<SessionHistoryEntry[]> {
  const dir = getHistoryDir(cwd);

  try {
    await access(dir);
  } catch {
    return []; // No history directory yet
  }

  try {
    const files = await readdir(dir);
    const sessions: SessionHistoryEntry[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await readFile(join(dir, file), 'utf-8');
        const entry = JSON.parse(content) as SessionHistoryEntry;
        sessions.push(entry);
      } catch {
        // Skip invalid files
      }
    }

    // Sort by lastActive, most recent first
    sessions.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

    return sessions;
  } catch {
    return [];
  }
}

/**
 * Get a specific session from history
 */
export async function getSessionFromHistory(cwd: string, sessionId: string): Promise<SessionHistoryEntry | null> {
  const filePath = getHistoryFilePath(cwd, sessionId);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as SessionHistoryEntry;
  } catch {
    return null;
  }
}

/**
 * Rename current session
 */
export async function renameSession(cwd: string, newName: string): Promise<boolean> {
  const path = getSessionPath(cwd);
  const state = await loadSession(cwd);

  if (!state?.sessionId) return false;

  const updatedState: SessionState = {
    ...state,
    name: newName,
    lastActive: new Date().toISOString()
  };

  try {
    await writeFile(path, JSON.stringify(updatedState, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Update session summary and cost
 */
export async function updateSessionStats(
  cwd: string,
  stats: { summary?: string; estimatedCost?: number; toolCalls?: number }
): Promise<void> {
  const path = getSessionPath(cwd);
  const state = await loadSession(cwd);

  if (!state) return;

  const updatedState: SessionState = {
    ...state,
    ...stats,
    lastActive: new Date().toISOString()
  };

  try {
    await writeFile(path, JSON.stringify(updatedState, null, 2));
  } catch (err) {
    console.error('[session] Failed to update stats:', err);
  }
}

/**
 * Remove old sessions beyond MAX_HISTORY_SESSIONS
 */
async function pruneOldSessions(cwd: string): Promise<void> {
  const sessions = await listSessions(cwd);

  if (sessions.length <= MAX_HISTORY_SESSIONS) return;

  const { unlink } = await import('fs/promises');
  const toRemove = sessions.slice(MAX_HISTORY_SESSIONS);

  for (const session of toRemove) {
    const filePath = getHistoryFilePath(cwd, session.sessionId);
    try {
      await unlink(filePath);
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Get formatted time ago string
 */
export function getTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
