/**
 * Supabase MCP Server Tools
 * 
 * Database operations for keyword queue management and article tracking.
 * Uses the Supabase MCP server for SQL execution.
 */

export { getNextKeyword, getQueuedKeywords } from './getNextKeyword.js';
export type { QueuedKeyword } from './getNextKeyword.js';
export { 
  markComplete, 
  markInProgress, 
  markDrafted,
  getQueueStats,
  getRecentlyPublished 
} from './markComplete.js';
