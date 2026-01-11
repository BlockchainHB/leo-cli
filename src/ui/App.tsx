/**
 * Main App Component
 *
 * Leo - AI-powered blog writing agent
 * Clean, minimal UI inspired by Claude Code
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useApp, useInput, Static } from 'ink';
import { Banner } from './Banner.js';
import { Input } from './Input.js';
import { Message } from './Message.js';
import { ContextBar, type UsageData } from './ContextBar.js';
import { SettingsScreen } from './SettingsScreen.js';
import { OnboardingWizard } from './OnboardingWizard.js';
import {
  streamAgent,
  type StreamMessage,
  hasValidSession,
  startHeartbeat,
  clearSession,
  archiveSession,
  listSessions,
  renameSession,
  getTimeAgo,
  type SessionHistoryEntry
} from '../agent.js';
import { initProgress, hasInterruptedWork } from '../progress.js';
import { theme, claude, statusIcons, boxChars } from './colors.js';
import { configExists, loadConfig } from '../utils/config-manager.js';
import { LeoConfig } from '../types/config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Screen Types
// ─────────────────────────────────────────────────────────────────────────────

type Screen = 'main' | 'settings' | 'onboarding';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LogItem {
  id: string;
  type: 'banner' | 'user' | 'assistant' | 'tool' | 'tool_inline' | 'subagent' | 'subagent_group' | 'system' | 'error' | 'thinking' | 'summary';
  // tool_inline: Claude Code style immediate tool display
  // subagent_group: Claude Code style tree display for completed subagent batch
  content: string;
  status?: 'done' | 'error' | 'running';
  elapsed?: string;
  agent?: string;
  metadata?: Record<string, unknown>;
}

// Active subagent tracking for parallel display
interface ActiveSubagent {
  id: string;              // toolId from Task tool_use
  description: string;     // Short description from Task input
  agentType: string;       // Subagent type (e.g., 'web-researcher')
  status: 'initializing' | 'running' | 'complete' | 'error';
  startTime: number;
  batchId: string;         // Groups parallel subagents
}

// Completed subagent for log display
interface CompletedSubagent {
  description: string;
  agentType: string;
  status: 'complete' | 'error';
  elapsed: string;
}

interface Activity {
  type: 'thinking' | 'tool' | 'subagent' | 'streaming';
  label: string;
  startTime: number;
  agent?: string;
}

interface SessionStats {
  startTime: number;
  toolCalls: number;
  thinkingWords: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────

const DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function Spinner({ frame, color = claude.accent }: { frame: number; color?: string }) {
  return <Text color={color}>{DOTS[frame % DOTS.length]}</Text>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suppress EPIPE errors on abort (happens when cancelling streams)
// ─────────────────────────────────────────────────────────────────────────────

// Handle EPIPE on stdout/stderr
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return;
  throw err;
});

process.stderr.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return;
  throw err;
});

// Global handler for uncaught EPIPE from MCP subprocesses
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return; // Ignore broken pipe on cancel
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────

export function App() {
  const { exit } = useApp();

  // Check if onboarding is needed
  const needsOnboarding = !configExists();

  // Screen routing - start with onboarding if needed
  const [screen, setScreen] = useState<Screen>(needsOnboarding ? 'onboarding' : 'main');

  // Blog config for dynamic branding
  const [blogConfig, setBlogConfig] = useState<LeoConfig | null>(() => loadConfig());

  // Core state
  const [log, setLog] = useState<LogItem[]>([]);
  const [streamText, setStreamText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [interrupted, setInterrupted] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showInitialBanner, setShowInitialBanner] = useState(true);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);

  // Activity state - only ONE active at a time
  const [activity, setActivity] = useState<Activity | null>(null);

  // Active subagents for parallel display (Claude Code style)
  const [activeSubagents, setActiveSubagents] = useState<Map<string, ActiveSubagent>>(new Map());

  // Session state
  const [hasSession, setHasSession] = useState(false);
  const sessionStatsRef = useRef<SessionStats>({ startTime: 0, toolCalls: 0, thinkingWords: 0 });

  // Token usage state
  const [usage, setUsage] = useState<UsageData | null>(null);

  // Cost tracking state
  const [sessionCost, setSessionCost] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [imageCost, setImageCost] = useState(0);

  // Thinking word count accumulator
  const thinkingWordsRef = useRef(0);

  // Timer refs
  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const keepaliveRef = useRef<NodeJS.Timeout | null>(null);

  // Abort controller for cancelling streams
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize - add banner to log on first render
  useEffect(() => {
    const cwd = process.cwd();
    initProgress(cwd);

    const interruptedWork = hasInterruptedWork(cwd);
    if (interruptedWork) {
      setInterrupted('Interrupted work detected');
    }

    // Add banner as first log item so it stays in scroll history
    setLog([{
      id: 'banner',
      type: 'banner',
      content: interruptedWork ? 'Interrupted work detected' : '',
    }]);

    // Check for existing valid session (async)
    (async () => {
      if (await hasValidSession(cwd)) {
        setHasSession(true);
      }
    })();

    // Session heartbeat - keeps session alive and provides health monitoring
    const heartbeat = startHeartbeat(cwd);
    keepaliveRef.current = heartbeat as unknown as NodeJS.Timeout; // Store for cleanup reference

    return () => {
      if (keepaliveRef.current) {
        // Stop heartbeat on unmount
        (keepaliveRef.current as unknown as { stop?: () => void })?.stop?.();
      }
    };
  }, []);

  // Spinner animation
  useEffect(() => {
    if (isProcessing) {
      tickerRef.current = setInterval(() => setTick(t => t + 1), 80);
    } else {
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    }
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [isProcessing]);

  // Track previous processing state for auto-send
  const wasProcessingRef = useRef(false);
  const queuedMessageRef = useRef<string | null>(null);

  // Keep ref in sync with state for use in effect
  useEffect(() => {
    queuedMessageRef.current = queuedMessage;
  }, [queuedMessage]);

  // Add item to log
  const addLog = useCallback((item: Omit<LogItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLog(prev => [...prev, { ...item, id }]);
  }, []);

  // Keyboard handling
  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();
    if (key.escape && isProcessing) {
      // Abort the running stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsProcessing(false);
      setActivity(null);
      setStreamText('');
      setActiveSubagents(new Map());
      setQueuedMessage(null);  // Clear queued message on cancel
      thinkingWordsRef.current = 0;
      addLog({ type: 'system', content: 'Cancelled' });
    }
  });

  // Handle user input
  const handleSubmit = useCallback(async (input: string, fromQueue = false) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // If processing and not from queue, queue the message instead
    if (isProcessing && !fromQueue) {
      setQueuedMessage(trimmed);
      return;
    }

    // Clear queued message if we're processing it
    if (fromQueue) {
      setQueuedMessage(null);
    }

    // Hide initial banner display (it's already in log history)
    if (showInitialBanner) setShowInitialBanner(false);

    // Log user message
    addLog({ type: 'user', content: trimmed });

    // Handle local commands
    if (trimmed === '/help') {
      addLog({ type: 'system', content: HELP_TEXT });
      return;
    }
    if (trimmed === '/quit' || trimmed === 'exit') {
      exit();
      return;
    }
    if (trimmed === '/clear') {
      // Clear conversation log (keep banner) and reset session
      // Set both banner and confirmation message in one call to avoid race condition
      setLog([
        { id: 'banner', type: 'banner', content: '' },
        { id: `clear-${Date.now()}`, type: 'system', content: 'Conversation cleared. Starting fresh.' }
      ]);
      setHasSession(false);
      setShowInitialBanner(true); // Show the initial banner again
      clearSession(process.cwd()).catch(() => {});
      return;
    }
    if (trimmed === '/settings' || trimmed === '/config' || trimmed === '/keys') {
      setScreen('settings');
      return;
    }

    // Session management commands
    if (trimmed === '/sessions') {
      const sessions = await listSessions(process.cwd());
      if (sessions.length === 0) {
        addLog({ type: 'system', content: 'No previous sessions found.' });
      } else {
        const sessionList = sessions.slice(0, 10).map((s, i) => {
          const cost = s.estimatedCost ? ` · $${s.estimatedCost.toFixed(2)}` : '';
          return `  ${i + 1}. ${s.name} (${s.messageCount} msgs${cost}) - ${getTimeAgo(s.lastActive)}`;
        }).join('\n');
        addLog({
          type: 'system',
          content: `Recent sessions:\n${sessionList}\n\nUse /resume <session-id> to resume.`
        });
      }
      return;
    }

    if (trimmed.startsWith('/resume')) {
      const sessionId = trimmed.replace('/resume', '').trim();
      if (!sessionId) {
        addLog({ type: 'system', content: 'Usage: /resume <session-id>' });
        return;
      }
      // For now, just inform about session resume
      addLog({ type: 'system', content: `Session resume with ID "${sessionId}" - session context preserved automatically.` });
      return;
    }

    if (trimmed.startsWith('/rename')) {
      const newName = trimmed.replace('/rename', '').trim();
      if (!newName) {
        addLog({ type: 'system', content: 'Usage: /rename <session-name>' });
        return;
      }
      const success = await renameSession(process.cwd(), newName);
      if (success) {
        addLog({ type: 'system', content: `Session renamed to "${newName}"` });
      } else {
        addLog({ type: 'error', content: 'No active session to rename.' });
      }
      return;
    }

    if (trimmed === '/cost') {
      const totalCost = sessionCost + imageCost;
      const costBreakdown = [
        `Session Cost Breakdown:`,
        `  API calls: $${sessionCost.toFixed(4)}`,
        imageCount > 0 ? `  Images (${imageCount}): $${imageCost.toFixed(4)}` : null,
        `  ──────────────`,
        `  Total: $${totalCost.toFixed(4)}`,
      ].filter(Boolean).join('\n');
      addLog({ type: 'system', content: costBreakdown });
      return;
    }

    // Build the message to send (may be modified by /compact)
    let messageToSend = trimmed;

    if (trimmed === '/compact' || trimmed.startsWith('/compact ')) {
      // Compact command - provide info and trigger summarization request
      const focus = trimmed.replace('/compact', '').trim();
      const focusMsg = focus ? ` Focus: ${focus}` : '';
      addLog({
        type: 'system',
        content: `Requesting context compaction...${focusMsg}`
      });
      // The SDK handles compaction automatically at ~100k tokens
      // For manual compaction, we send a message that prompts the agent to summarize
      messageToSend = focus
        ? `Please provide a brief summary of our conversation focusing on: ${focus}. After summarizing, continue helping with the current task.`
        : `Please provide a brief summary of what we've accomplished so far and the current state of the work. Include any important file paths, decisions made, and next steps.`;
    }

    // Start processing
    setIsProcessing(true);
    setStreamText('');
    setActivity(null);
    thinkingWordsRef.current = 0;
    sessionStatsRef.current = { startTime: Date.now(), toolCalls: 0, thinkingWords: 0 };

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Track timing
    const toolStartRef = { current: Date.now() };
    const subagentStartRef = { current: Date.now() };
    let currentSubagent: string | null = null;

    try {
      for await (const msg of streamAgent(messageToSend, { resumeSession: hasSession, abortController })) {
        if (msg.type === 'init' && msg.metadata?.sessionId) {
          setHasSession(true);
        }

        handleStreamMessage(msg, {
          addLog,
          setActivity,
          setStreamText,
          setActiveSubagents,
          setUsage,
          thinkingWordsRef,
          toolStartRef,
          subagentStartRef,
          getCurrentSubagent: () => currentSubagent,
          setCurrentSubagent: (agent: string | null) => { currentSubagent = agent; },
          sessionStatsRef,
          addSessionCost: (cost: number) => setSessionCost(prev => prev + cost),
          sessionCost,
          imageCount,
          imageCost,
        });
      }

      // Flush remaining stream text
      flushStreamText(addLog, setStreamText);

      // Add session summary
      const elapsed = ((Date.now() - sessionStatsRef.current.startTime) / 1000).toFixed(1);
      if (sessionStatsRef.current.toolCalls > 0 || sessionStatsRef.current.thinkingWords > 0) {
        addLog({
          type: 'summary',
          content: `${elapsed}s`,
          metadata: {
            tools: sessionStatsRef.current.toolCalls,
            thinking: sessionStatsRef.current.thinkingWords,
          }
        });
      }

    } catch (err) {
      // Don't show error for aborted requests or EPIPE (broken pipe from cancel)
      if (err instanceof Error) {
        const isAbort = err.name === 'AbortError' ||
          err.message.toLowerCase().includes('aborted') ||
          err.message.toLowerCase().includes('cancelled') ||
          err.message.includes('EPIPE') ||
          (err as NodeJS.ErrnoException).code === 'EPIPE';
        if (!isAbort) {
          addLog({
            type: 'error',
            content: err.message
          });
        }
      }
    } finally {
      setIsProcessing(false);
      setActivity(null);
      thinkingWordsRef.current = 0;
      abortControllerRef.current = null;
    }
  }, [showInitialBanner, hasSession, addLog, exit, isProcessing]);

  // Auto-send queued message when processing completes
  useEffect(() => {
    // Detect transition from processing to not processing
    if (wasProcessingRef.current && !isProcessing && queuedMessageRef.current) {
      const msg = queuedMessageRef.current;
      // Small delay to let UI update before sending next
      const timer = setTimeout(() => {
        handleSubmit(msg, true);
      }, 100);
      return () => clearTimeout(timer);
    }
    wasProcessingRef.current = isProcessing;
  }, [isProcessing, handleSubmit]);

  // Calculate elapsed time for display
  const elapsed = activity ? ((Date.now() - activity.startTime) / 1000).toFixed(1) : '0.0';

  // Show onboarding wizard if needed
  if (screen === 'onboarding') {
    return (
      <OnboardingWizard
        onComplete={(config) => {
          setBlogConfig(config);
          setScreen('main');
        }}
        onCancel={() => exit()}
      />
    );
  }

  // Show settings screen if active
  if (screen === 'settings') {
    return <SettingsScreen onClose={() => setScreen('main')} />;
  }

  return (
    <Box flexDirection="column">
      {/* Initial banner - shown before first input */}
      {showInitialBanner && <Banner interrupted={interrupted} />}

      {/* Log history - banner stays here after first input */}
      <Static items={log}>
        {item => <LogItemView key={item.id} item={item} />}
      </Static>

      {/* Streaming text - simple, tools already shown in log */}
      {streamText && (
        <Text wrap="wrap">
          <Text color={theme.text}>● </Text>
          <Text color={theme.text}>{streamText}</Text>
          <Text color={claude.accent}>▌</Text>
        </Text>
      )}

      {/* Input area - status line + queued message + input */}
      <Box flexDirection="column" marginTop={1}>
        {/* Status line - above queued message when processing */}
        {isProcessing && (
          <Box marginBottom={1}>
            <StatusLine
              activity={activity}
              tick={tick}
              elapsed={elapsed}
              thinkingWords={thinkingWordsRef.current}
              activeSubagents={activeSubagents}
            />
          </Box>
        )}
        {/* Queued message - right above input */}
        {queuedMessage && (
          <Box marginBottom={1}>
            <Text backgroundColor="#3a3a3a">
              <Text color={theme.textMuted}> › </Text>
              <Text color={theme.text}>{queuedMessage} </Text>
            </Text>
          </Box>
        )}
        <Input
          onSubmit={handleSubmit}
          disabled={isProcessing && !!queuedMessage}
          placeholder={showInitialBanner ? "Ask Leo anything..." : ""}
          queuedMessage={queuedMessage}
        />

        {/* Context usage bar - show when we have usage data */}
        {usage && (
          <Box marginTop={1}>
            <ContextBar usage={usage} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Flush stream text to log
// ─────────────────────────────────────────────────────────────────────────────

function flushStreamText(
  addLog: (item: Omit<LogItem, 'id'>) => void,
  setStreamText: React.Dispatch<React.SetStateAction<string>>
) {
  setStreamText(prev => {
    if (prev) {
      addLog({ type: 'assistant', content: prev });
    }
    return '';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Message Handler
// ─────────────────────────────────────────────────────────────────────────────

interface HandlerContext {
  addLog: (item: Omit<LogItem, 'id'>) => void;
  setActivity: (activity: Activity | null) => void;
  setStreamText: React.Dispatch<React.SetStateAction<string>>;
  setActiveSubagents: React.Dispatch<React.SetStateAction<Map<string, ActiveSubagent>>>;
  setUsage: React.Dispatch<React.SetStateAction<UsageData | null>>;
  thinkingWordsRef: React.MutableRefObject<number>;
  toolStartRef: React.MutableRefObject<number>;
  subagentStartRef: React.MutableRefObject<number>;
  getCurrentSubagent: () => string | null;
  setCurrentSubagent: (agent: string | null) => void;
  sessionStatsRef: React.MutableRefObject<SessionStats>;
  // Cost tracking
  addSessionCost: (cost: number) => void;
  sessionCost: number;
  imageCount: number;
  imageCost: number;
}

function handleStreamMessage(msg: StreamMessage, ctx: HandlerContext) {
  const {
    addLog, setActivity, setStreamText, setActiveSubagents, setUsage,
    thinkingWordsRef, toolStartRef, subagentStartRef, getCurrentSubagent,
    setCurrentSubagent, sessionStatsRef, addSessionCost, sessionCost, imageCount, imageCost
  } = ctx;

  switch (msg.type) {
    // ─── Thinking ─────────────────────────────────────────────────
    case 'thinking_stream':
      thinkingWordsRef.current += msg.content.split(/\s+/).filter(Boolean).length;
      setActivity({
        type: 'thinking',
        label: `${thinkingWordsRef.current} words`,
        startTime: Date.now()
      });
      break;

    case 'thinking':
      thinkingWordsRef.current += msg.content.split(/\s+/).filter(Boolean).length;
      break;

    case 'thinking_end':
      if (thinkingWordsRef.current > 0) {
        sessionStatsRef.current.thinkingWords += thinkingWordsRef.current;
        addLog({ type: 'thinking', content: `${thinkingWordsRef.current} words` });
      }
      setActivity(null);
      thinkingWordsRef.current = 0;
      break;

    // ─── Streaming Text ───────────────────────────────────────────
    case 'stream':
      setActivity({ type: 'streaming', label: 'writing', startTime: Date.now() });
      setStreamText(prev => prev + msg.content);
      break;

    case 'text':
      // Flush stream buffer
      flushStreamText(addLog, setStreamText);
      addLog({ type: 'assistant', content: msg.content });
      setActivity(null);
      break;

    // ─── Subagent Lifecycle ───────────────────────────────────────
    case 'subagent_start': {
      const toolId = msg.metadata?.toolId as string || `subagent-${Date.now()}`;
      const description = msg.metadata?.description as string || msg.content;
      const agentType = msg.metadata?.agentType as string || msg.metadata?.agent as string || 'subagent';
      const batchId = msg.metadata?.batchId as string || `batch-${Date.now()}`;

      subagentStartRef.current = Date.now();
      setCurrentSubagent(agentType);

      // Add to active subagents map
      setActiveSubagents(prev => {
        const next = new Map(prev);
        next.set(toolId, {
          id: toolId,
          description,
          agentType,
          status: 'initializing',
          startTime: Date.now(),
          batchId
        });
        return next;
      });

      // Set activity for status line (will be replaced by tree display)
      setActivity({
        type: 'subagent',
        label: description,
        startTime: subagentStartRef.current,
        agent: agentType
      });
      break;
    }

    case 'subagent_end': {
      const toolId = msg.metadata?.toolId as string;
      const isError = msg.metadata?.isError as boolean;

      // Update subagent status to complete (keep in map for connected tree display)
      setActiveSubagents(prev => {
        const next = new Map(prev);
        const subagent = next.get(toolId);
        if (subagent) {
          next.set(toolId, { ...subagent, status: isError ? 'error' : 'complete' });
        }

        // Check if ALL active subagents are complete (not just this batch)
        // This keeps the tree connected until everything finishes
        const allSubagents = Array.from(next.values());
        const allComplete = allSubagents.every(s => s.status === 'complete' || s.status === 'error');

        if (allComplete && allSubagents.length > 0) {
          // Log ALL completed subagents as one group
          const completedGroup: CompletedSubagent[] = allSubagents.map(s => ({
            description: s.description,
            agentType: s.agentType,
            status: s.status as 'complete' | 'error',
            elapsed: ((Date.now() - s.startTime) / 1000).toFixed(1)
          }));

          addLog({
            type: 'subagent_group',
            content: `${allSubagents.length} subagents`,
            status: allSubagents.some(s => s.status === 'error') ? 'error' : 'done',
            metadata: { subagents: completedGroup }
          });

          // Clear ALL subagents from active map
          next.clear();

          // Clear activity since all done
          setCurrentSubagent(null);
          setActivity(null);
        }

        return next;
      });
      break;
    }

    // ─── Tool Lifecycle ───────────────────────────────────────────
    case 'tool_start': {
      toolStartRef.current = Date.now();
      setActivity({
        type: 'tool',
        label: msg.content,
        startTime: toolStartRef.current
      });
      break;
    }

    case 'tool_result':
    case 'tool_error': {
      const elapsed = ((Date.now() - toolStartRef.current) / 1000).toFixed(1);
      sessionStatsRef.current.toolCalls++;

      // Generate result summary from metadata
      const resultText = msg.metadata?.resultText as string | undefined;
      const input = msg.metadata?.input as Record<string, unknown> | undefined;
      const toolName = msg.metadata?.tool as string | undefined;
      const summary = generateResultSummary(toolName, resultText, input);

      // Show tool immediately in log (Claude Code style)
      addLog({
        type: 'tool_inline',
        content: msg.content,
        status: msg.type === 'tool_error' ? 'error' : 'done',
        elapsed,
        metadata: { summary, input }
      });

      setActivity(null);
      break;
    }

    // ─── System Messages ──────────────────────────────────────────
    case 'error': {
      // Filter out abort-related messages from SDK
      const isAbortMsg = msg.content.toLowerCase().includes('aborted') ||
        msg.content.toLowerCase().includes('cancelled');
      if (!isAbortMsg) {
        addLog({ type: 'error', content: msg.content });
      }
      break;
    }

    case 'success':
      break;

    case 'system':
      addLog({ type: 'system', content: msg.content });
      break;

    case 'init':
      break;

    case 'usage': {
      // Update token usage state and accumulate cost
      const meta = msg.metadata;
      if (meta) {
        // Add incremental cost if provided
        if (meta.totalCostUsd && meta.totalCostUsd > 0) {
          addSessionCost(meta.totalCostUsd);
        }

        setUsage({
          inputTokens: meta.inputTokens || 0,
          outputTokens: meta.outputTokens || 0,
          contextWindow: meta.contextWindow || 200000,
          totalCostUsd: meta.totalCostUsd,
          sessionCostUsd: sessionCost + (meta.totalCostUsd || 0),
          imageCount: imageCount,
          imageCostUsd: imageCost
        });
      }
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result Summary Generator - Creates human-readable summaries like Claude Code
// ─────────────────────────────────────────────────────────────────────────────

function generateResultSummary(
  toolName: string | undefined,
  resultText: string | undefined,
  input: Record<string, unknown> | undefined
): string | undefined {
  if (!resultText) return undefined;

  // Count lines in result
  const lines = resultText.split('\n').filter(l => l.trim()).length;

  switch (toolName) {
    case 'Read':
      return `Read ${lines} lines`;
    case 'Grep':
      if (lines === 0) return 'No matches found';
      return `Found ${lines} matches`;
    case 'Glob':
      if (lines === 0) return 'Found 0 files';
      return `Found ${lines} files`;
    case 'Bash':
      if (!resultText.trim()) return '(No output)';
      return lines > 1 ? `${lines} lines` : resultText.trim().slice(0, 50);
    case 'Edit':
      return 'Updated file';
    case 'Write':
      return 'Wrote file';
    default:
      if (toolName?.startsWith('mcp__supabase__')) {
        if (lines === 0) return 'No results';
        return `${lines} rows`;
      }
      return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Call Display - Claude Code style: ● ToolName(argument) with summary
// ─────────────────────────────────────────────────────────────────────────────

interface ToolCallDisplayProps {
  label: string;
  status: 'done' | 'error';
  summary?: string;
}

function ToolCallDisplay({ label, status, summary }: ToolCallDisplayProps) {
  // Parse "ToolName(argument)" format
  const match = label.match(/^([^(]+)(?:\((.+)\))?$/);
  const toolName = match?.[1] || label;
  const argument = match?.[2];

  const bulletColor = status === 'error' ? theme.error : theme.success;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={bulletColor}>● </Text>
        <Text color={theme.text} bold>{toolName}</Text>
        {argument && (
          <>
            <Text color={theme.textDim}>(</Text>
            <Text color={claude.link} underline>{argument}</Text>
            <Text color={theme.textDim}>)</Text>
          </>
        )}
      </Box>
      {summary && (
        <Box marginLeft={2}>
          <Text color={theme.textDim}>└ </Text>
          <Text color={theme.textMuted}>{summary}</Text>
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subagent Tree Display - Claude Code style tree for parallel subagents
// ─────────────────────────────────────────────────────────────────────────────

interface SubagentTreeProps {
  subagents: ActiveSubagent[];
  tick: number;
  isActive: boolean;  // true = live with spinners, false = completed in log
}

function SubagentTree({ subagents, tick, isActive }: SubagentTreeProps) {
  if (subagents.length === 0) return null;

  return (
    <Box flexDirection="column">
      {subagents.map((agent, i) => {
        const isLast = i === subagents.length - 1;
        const connector = isLast ? '└─' : '├─';
        const verticalLine = isLast ? '  ' : '│ ';

        // Status display based on state
        const isComplete = agent.status === 'complete';
        const isError = agent.status === 'error';
        const isWorking = agent.status === 'initializing' || agent.status === 'running';

        // Show live timer while working, tool count on completion
        const elapsed = ((Date.now() - agent.startTime) / 1000).toFixed(1);

        return (
          <Box key={agent.id} flexDirection="column">
            {/* Main line: ├─ Description · timer/tools */}
            <Box>
              <Text color={theme.textDim}>{connector} </Text>
              <Text color={theme.text}>{agent.description}</Text>
              {isWorking && <Text color={theme.textDim}> · {elapsed}s</Text>}
              {(isComplete || isError) && <Text color={theme.textDim}> · 0 tool uses</Text>}
            </Box>
            {/* Status line: │  └ Status */}
            <Box>
              <Text color={theme.textDim}>{verticalLine}</Text>
              <Text color={theme.textDim}>└ </Text>
              {isWorking && isActive ? (
                <>
                  <Spinner frame={tick} color={claude.accent} />
                  <Text color={theme.textMuted}> Working...</Text>
                </>
              ) : isComplete ? (
                <>
                  <Text color={theme.success}>● </Text>
                  <Text color={theme.textMuted}>Complete</Text>
                </>
              ) : isError ? (
                <>
                  <Text color={theme.error}>● </Text>
                  <Text color={theme.textMuted}>Error</Text>
                </>
              ) : (
                <Text color={theme.textMuted}>Initializing...</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// Completed subagent tree for log display
interface CompletedSubagentTreeProps {
  subagents: CompletedSubagent[];
}

function CompletedSubagentTree({ subagents }: CompletedSubagentTreeProps) {
  if (subagents.length === 0) return null;

  return (
    <Box flexDirection="column">
      {subagents.map((agent, i) => {
        const isLast = i === subagents.length - 1;
        const connector = isLast ? '└─' : '├─';
        const verticalLine = isLast ? '  ' : '│ ';

        const isError = agent.status === 'error';

        return (
          <Box key={`${agent.agentType}-${i}`} flexDirection="column">
            {/* Main line: ├─ Description · elapsed */}
            <Box>
              <Text color={theme.textDim}>{connector} </Text>
              <Text color={theme.text}>{agent.description}</Text>
              <Text color={theme.textDim}> · {agent.elapsed}s</Text>
            </Box>
            {/* Status line: │  └ ✓ Complete */}
            <Box>
              <Text color={theme.textDim}>{verticalLine}</Text>
              <Text color={theme.textDim}>└ </Text>
              {isError ? (
                <>
                  <Text color={theme.error}>● </Text>
                  <Text color={theme.textMuted}>Error</Text>
                </>
              ) : (
                <>
                  <Text color={theme.success}>● </Text>
                  <Text color={theme.textMuted}>Complete</Text>
                </>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Line Component - Shows above input when processing
// ─────────────────────────────────────────────────────────────────────────────

function StatusLine({
  activity,
  tick,
  elapsed,
  thinkingWords,
  activeSubagents
}: {
  activity: Activity | null;
  tick: number;
  elapsed: string;
  thinkingWords: number;
  activeSubagents: Map<string, ActiveSubagent>;
}) {
  // Subagent - Claude Code style tree display
  if (activity?.type === 'subagent' && activeSubagents.size > 0) {
    const subagentList = Array.from(activeSubagents.values());
    const count = subagentList.length;
    // Get common agent type or use generic "Task"
    const agentTypes = [...new Set(subagentList.map(s => s.agentType))];
    const typeLabel = agentTypes.length === 1 ? agentTypes[0] : 'Task';

    return (
      <Box flexDirection="column">
        {/* Header line: ● Running 2 Task agents... */}
        <Box marginBottom={1}>
          <Text color={theme.success}>● </Text>
          <Text color={theme.text}>Running </Text>
          <Text color={theme.text} bold>{count}</Text>
          <Text color={theme.text}> {typeLabel} agent{count > 1 ? 's' : ''}...</Text>
        </Box>
        {/* Tree display */}
        <Box marginLeft={2}>
          <SubagentTree subagents={subagentList} tick={tick} isActive={true} />
        </Box>
        <Box marginTop={1}>
          <Text color={theme.textDim}>(ESC to cancel)</Text>
        </Box>
      </Box>
    );
  }

  // Thinking
  if (activity?.type === 'thinking') {
    return (
      <Box>
        <Spinner frame={tick} color={claude.accent} />
        <Text color={theme.textMuted}> thinking</Text>
        <Text color={theme.textDim}> · {thinkingWords} words</Text>
        <Text color={theme.textDim}> (ESC to cancel)</Text>
      </Box>
    );
  }

  // Tool running
  if (activity?.type === 'tool') {
    return (
      <Box>
        <Spinner frame={tick} color={claude.accent} />
        <Text color={theme.textMuted}> {activity.label}</Text>
        <Text color={theme.textDim}> · {elapsed}s</Text>
        <Text color={theme.textDim}> (ESC to cancel)</Text>
      </Box>
    );
  }

  // Streaming - don't show status (cursor in text is enough)
  if (activity?.type === 'streaming') {
    return null;
  }

  // Default - generic "Leo is working" when no specific activity
  return (
    <Box>
      <Spinner frame={tick} color={claude.accent} />
      <Text color={theme.textMuted}> Leo is working...</Text>
      <Text color={theme.textDim}> (ESC to cancel)</Text>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Log Item View Component
// ─────────────────────────────────────────────────────────────────────────────

const LogItemView = React.memo(function LogItemView({ item }: { item: LogItem }) {
  switch (item.type) {
    case 'banner':
      // Render compact banner in history
      return (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={theme.textDim}>╭─</Text>
            <Text color={claude.accent}> Leo </Text>
            <Text color={theme.textDim}>─ AI Blog Writing Agent ─╮</Text>
          </Box>
          <Box>
            <Text color={theme.textDim}>╰─ </Text>
            <Text color={theme.textMuted}>/write-blog</Text>
            <Text color={theme.textDim}> · </Text>
            <Text color={theme.textMuted}>/queue-status</Text>
            <Text color={theme.textDim}> · </Text>
            <Text color={theme.textMuted}>/help</Text>
            <Text color={theme.textDim}> ─╯</Text>
          </Box>
          {item.content && (
            <Box marginTop={1}>
              <Text color={theme.warning}>{statusIcons.warning} </Text>
              <Text color={theme.textMuted}>{item.content}</Text>
            </Box>
          )}
        </Box>
      );

    case 'user':
      return (
        <Box marginY={1}>
          <Text color={theme.textDim}>❯ </Text>
          <Text color={theme.text} bold>{item.content}</Text>
        </Box>
      );

    case 'assistant':
      // Simple message with bullet prefix (Claude Code style)
      // Tools are shown separately as tool_inline items
      if (!item.content) return null;
      return (
        <Message
          content={item.content}
          prefix={<Text color={theme.text}>● </Text>}
        />
      );

    case 'tool':
      return (
        <Box marginBottom={1}>
          <Text color={item.status === 'error' ? theme.error : theme.success}>
            {item.status === 'error' ? statusIcons.error : statusIcons.success}
          </Text>
          <Text color={theme.textMuted}> {item.content}</Text>
          {item.elapsed && <Text color={theme.textDim}> · {item.elapsed}s</Text>}
        </Box>
      );

    case 'tool_inline': {
      // Claude Code style - show immediately as tool completes with summary
      const summary = item.metadata?.summary as string | undefined;
      return (
        <ToolCallDisplay
          label={item.content}
          status={item.status as 'done' | 'error'}
          summary={summary}
        />
      );
    }

    case 'subagent':
      // Legacy single subagent display (fallback)
      return (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={theme.textDim}>└─ </Text>
            <Text color={theme.text}>{item.agent || item.content}</Text>
            {item.elapsed && <Text color={theme.textDim}> · {item.elapsed}s</Text>}
          </Box>
          <Box>
            <Text color={theme.textDim}>   └ </Text>
            <Text color={item.status === 'error' ? theme.error : theme.success}>
              {item.status === 'error' ? '✗ Error' : '✓ Complete'}
            </Text>
          </Box>
        </Box>
      );

    case 'subagent_group': {
      // Claude Code style tree display for completed subagent batch
      const subagents = item.metadata?.subagents as CompletedSubagent[] | undefined;
      if (!subagents || subagents.length === 0) return null;

      const count = subagents.length;
      const hasError = subagents.some(s => s.status === 'error');
      const agentTypes = [...new Set(subagents.map(s => s.agentType))];
      const typeLabel = agentTypes.length === 1 ? agentTypes[0] : 'Task';

      return (
        <Box flexDirection="column" marginBottom={1}>
          {/* Header line: ● Completed 2 Task agents */}
          <Box marginBottom={1}>
            <Text color={hasError ? theme.error : theme.success}>● </Text>
            <Text color={theme.text}>{hasError ? 'Completed with errors' : 'Completed'} </Text>
            <Text color={theme.text} bold>{count}</Text>
            <Text color={theme.text}> {typeLabel} agent{count > 1 ? 's' : ''}</Text>
          </Box>
          {/* Tree display */}
          <Box marginLeft={2}>
            <CompletedSubagentTree subagents={subagents} />
          </Box>
        </Box>
      );
    }

    case 'thinking':
      return (
        <Box marginBottom={1}>
          <Text color={claude.accent}>◆</Text>
          <Text color={theme.textDim}> thought · {item.content}</Text>
        </Box>
      );

    case 'system':
      return (
        <Box marginBottom={1}>
          <Text color={theme.info}>{statusIcons.info}</Text>
          <Text color={theme.textMuted}> {item.content}</Text>
        </Box>
      );

    case 'error':
      return (
        <Box marginBottom={1}>
          <Text color={theme.error}>{statusIcons.error}</Text>
          <Text color={theme.error}> {item.content}</Text>
        </Box>
      );

    case 'summary': {
      const tools = item.metadata?.tools as number || 0;
      const thinking = item.metadata?.thinking as number || 0;
      return (
        <Box marginTop={1}>
          <Text color={theme.textDim}>{'─'.repeat(40)}</Text>
          <Text color={theme.textDim}> {item.content}</Text>
          {tools > 0 && <Text color={theme.textDim}> · {tools} tools</Text>}
          {thinking > 0 && <Text color={theme.textDim}> · {thinking} words thought</Text>}
        </Box>
      );
    }

    default:
      return null;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Help Text
// ─────────────────────────────────────────────────────────────────────────────

const HELP_TEXT = `Commands:

  /write-blog [keyword]  Research and write article
  /write-blog next       Write next from queue
  /queue-status          View keyword queue
  /publish [slug]        Publish draft to CMS
  /super-leo <N>         Process N keywords automatically
  /cancel-super-leo      Cancel active Super-Leo loop
  /sessions              List recent sessions
  /resume [id]           Resume a previous session
  /rename <name>         Name the current session
  /cost                  Show session cost breakdown
  /settings              Manage API keys
  /clear                 Clear conversation & start fresh
  /compact [focus]       Summarize context (optional focus)
  /help                  Show this help
  /quit                  Exit

Shortcuts: ESC cancel · Ctrl+C exit`;
