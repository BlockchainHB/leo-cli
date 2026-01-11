/**
 * Audit Logger Hooks
 *
 * Logs file system changes for monitoring and debugging.
 * Used as a PostToolUse hook to track all file operations.
 *
 * Compatible with Claude Agent SDK hook system.
 */
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const AUDIT_LOG_DIR = 'logs';
const AUDIT_LOG_FILE = 'file-changes.log';

// SDK Hook types (simplified from @anthropic-ai/claude-agent-sdk)
// Use a generic object type to avoid SDK type import issues
interface HookJSONOutput {
  continue?: boolean;
}

// Type guard for PostToolUse hook events
function isPostToolUseEvent(input: Record<string, unknown>): boolean {
  return input.hook_event_name === 'PostToolUse';
}

export interface AuditEntry {
  timestamp: string;
  tool: string;
  action: 'create' | 'update' | 'read';
  path: string;
  success: boolean;
  error?: string;
  sessionId?: string;
}

/**
 * Ensure the logs directory exists.
 */
async function ensureLogDir(logCwd: string): Promise<void> {
  const logDir = join(logCwd, AUDIT_LOG_DIR);
  if (!existsSync(logDir)) {
    await mkdir(logDir, { recursive: true });
  }
}

/**
 * Log a file change to the audit log.
 */
export async function logFileChange(entry: AuditEntry, logCwd: string): Promise<void> {
  try {
    await ensureLogDir(logCwd);
    const logPath = join(logCwd, AUDIT_LOG_DIR, AUDIT_LOG_FILE);
    const line = JSON.stringify(entry) + '\n';
    await appendFile(logPath, line);
  } catch (err) {
    // Don't throw - audit logging should never break the main flow
    console.error('[audit] Failed to log:', err);
  }
}

/**
 * Create a PostToolUse hook function for audit logging.
 * This logs all file-related tool operations (Write, Edit, Read).
 *
 * Matches SDK signature: (input: HookInput, toolUseID, options) => Promise<HookJSONOutput>
 */
export function createAuditHook(logCwd: string, defaultSessionId?: string) {
  return async (
    input: Record<string, unknown>,
    _toolUseID: string | undefined,
    _options: { signal: AbortSignal }
  ): Promise<HookJSONOutput> => {
    // Only handle PostToolUse events
    if (!isPostToolUseEvent(input)) {
      return { continue: true };
    }

    const toolName = input.tool_name as string;
    const toolInput = input.tool_input as Record<string, unknown> | undefined;

    // Only audit file-related tools
    const fileTools = ['Write', 'Edit', 'Read'];
    if (!fileTools.includes(toolName)) {
      return { continue: true };
    }

    const path = (toolInput?.file_path || toolInput?.path) as string | undefined;
    if (!path) {
      return { continue: true };
    }

    const actionMap: Record<string, AuditEntry['action']> = {
      Write: 'create',
      Edit: 'update',
      Read: 'read'
    };

    await logFileChange(
      {
        timestamp: new Date().toISOString(),
        tool: toolName,
        action: actionMap[toolName] || 'read',
        path,
        success: true, // PostToolUse is only called on success
        sessionId: (input.session_id as string | undefined) || defaultSessionId
      },
      (input.cwd as string | undefined) || logCwd
    );

    return { continue: true };
  };
}

/**
 * Wrapper to create hooks compatible with Claude Agent SDK format.
 * Returns an array of hook matchers for PostToolUse.
 */
export function createPostToolUseHooks(logCwd: string, sessionId?: string) {
  const auditHook = createAuditHook(logCwd, sessionId);

  return [
    {
      matcher: 'Write|Edit|Read',
      hooks: [auditHook]
    }
  ];
}
