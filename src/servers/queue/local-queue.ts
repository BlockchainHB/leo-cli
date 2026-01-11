/**
 * Local Keyword Queue
 *
 * JSON-based keyword queue that works without external dependencies.
 * Stores keywords in keywords.json with full status tracking.
 */

import * as fs from 'fs';
import * as path from 'path';

export type KeywordStatus = 'pending' | 'in_progress' | 'drafted' | 'scheduled' | 'published' | 'failed';

export interface Keyword {
  id: number;
  keyword: string;
  slug: string;
  status: KeywordStatus;
  priority: number;
  topicCluster?: string;
  searchVolume?: number;
  difficulty?: number;
  notes?: string;
  sanityId?: string;
  publishedAt?: string;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordQueue {
  version: '1.0';
  lastId: number;
  keywords: Keyword[];
}

const QUEUE_FILE = 'keywords.json';

/**
 * Get queue file path
 */
function getQueuePath(): string {
  return path.join(process.cwd(), QUEUE_FILE);
}

/**
 * Initialize empty queue
 */
function initQueue(): KeywordQueue {
  return {
    version: '1.0',
    lastId: 0,
    keywords: []
  };
}

/**
 * Load the queue from file
 */
export function loadQueue(): KeywordQueue {
  const queuePath = getQueuePath();

  if (!fs.existsSync(queuePath)) {
    const queue = initQueue();
    saveQueue(queue);
    return queue;
  }

  try {
    const content = fs.readFileSync(queuePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[Queue] Failed to load queue, initializing new one:', error);
    const queue = initQueue();
    saveQueue(queue);
    return queue;
  }
}

/**
 * Save the queue to file
 */
export function saveQueue(queue: KeywordQueue): void {
  const queuePath = getQueuePath();
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
}

/**
 * Generate a URL-safe slug from keyword
 */
export function keywordToSlug(keyword: string): string {
  return keyword
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

/**
 * Add a keyword to the queue
 */
export function addKeyword(
  keyword: string,
  options?: {
    priority?: number;
    topicCluster?: string;
    searchVolume?: number;
    difficulty?: number;
    notes?: string;
  }
): Keyword {
  const queue = loadQueue();
  const now = new Date().toISOString();

  // Check for duplicates
  const existing = queue.keywords.find(
    k => k.keyword.toLowerCase() === keyword.toLowerCase() && k.status !== 'published'
  );

  if (existing) {
    console.log(`[Queue] Keyword "${keyword}" already exists with status: ${existing.status}`);
    return existing;
  }

  const newKeyword: Keyword = {
    id: ++queue.lastId,
    keyword,
    slug: keywordToSlug(keyword),
    status: 'pending',
    priority: options?.priority ?? 5,
    topicCluster: options?.topicCluster,
    searchVolume: options?.searchVolume,
    difficulty: options?.difficulty,
    notes: options?.notes,
    createdAt: now,
    updatedAt: now
  };

  queue.keywords.push(newKeyword);
  saveQueue(queue);

  console.log(`[Queue] Added keyword: "${keyword}" (ID: ${newKeyword.id})`);
  return newKeyword;
}

/**
 * Add multiple keywords at once
 */
export function addKeywords(keywords: string[], topicCluster?: string): Keyword[] {
  return keywords.map((kw, index) =>
    addKeyword(kw, {
      topicCluster,
      priority: 5 - Math.min(index, 4) // First keywords get higher priority
    })
  );
}

/**
 * Get the next pending keyword
 */
export function getNextKeyword(): Keyword | null {
  const queue = loadQueue();

  // Find highest priority pending keyword
  const pending = queue.keywords
    .filter(k => k.status === 'pending')
    .sort((a, b) => b.priority - a.priority);

  return pending[0] || null;
}

/**
 * Get keyword by ID
 */
export function getKeywordById(id: number): Keyword | null {
  const queue = loadQueue();
  return queue.keywords.find(k => k.id === id) || null;
}

/**
 * Get keyword by slug
 */
export function getKeywordBySlug(slug: string): Keyword | null {
  const queue = loadQueue();
  return queue.keywords.find(k => k.slug === slug) || null;
}

/**
 * Update keyword status
 */
export function updateKeywordStatus(
  id: number,
  status: KeywordStatus,
  updates?: Partial<Keyword>
): Keyword | null {
  const queue = loadQueue();
  const keyword = queue.keywords.find(k => k.id === id);

  if (!keyword) {
    console.error(`[Queue] Keyword not found: ${id}`);
    return null;
  }

  keyword.status = status;
  keyword.updatedAt = new Date().toISOString();

  if (updates) {
    Object.assign(keyword, updates);
  }

  // Set timestamps based on status
  if (status === 'published' && !keyword.publishedAt) {
    keyword.publishedAt = keyword.updatedAt;
  }

  saveQueue(queue);
  console.log(`[Queue] Updated keyword ${id} status to: ${status}`);

  return keyword;
}

/**
 * Mark keyword as in progress
 */
export function markInProgress(id: number): Keyword | null {
  return updateKeywordStatus(id, 'in_progress');
}

/**
 * Mark keyword as drafted
 */
export function markDrafted(id: number, sanityId?: string): Keyword | null {
  return updateKeywordStatus(id, 'drafted', { sanityId });
}

/**
 * Mark keyword as scheduled
 */
export function markScheduled(id: number, scheduledAt: string): Keyword | null {
  return updateKeywordStatus(id, 'scheduled', { scheduledAt });
}

/**
 * Mark keyword as published
 */
export function markPublished(id: number): Keyword | null {
  return updateKeywordStatus(id, 'published');
}

/**
 * Mark keyword as failed
 */
export function markFailed(id: number, notes?: string): Keyword | null {
  return updateKeywordStatus(id, 'failed', { notes });
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  total: number;
  pending: number;
  inProgress: number;
  drafted: number;
  scheduled: number;
  published: number;
  failed: number;
} {
  const queue = loadQueue();

  return {
    total: queue.keywords.length,
    pending: queue.keywords.filter(k => k.status === 'pending').length,
    inProgress: queue.keywords.filter(k => k.status === 'in_progress').length,
    drafted: queue.keywords.filter(k => k.status === 'drafted').length,
    scheduled: queue.keywords.filter(k => k.status === 'scheduled').length,
    published: queue.keywords.filter(k => k.status === 'published').length,
    failed: queue.keywords.filter(k => k.status === 'failed').length
  };
}

/**
 * Get keywords by status
 */
export function getKeywordsByStatus(status: KeywordStatus, limit?: number): Keyword[] {
  const queue = loadQueue();
  const filtered = queue.keywords.filter(k => k.status === status);

  if (limit) {
    return filtered.slice(0, limit);
  }

  return filtered;
}

/**
 * Delete a keyword
 */
export function deleteKeyword(id: number): boolean {
  const queue = loadQueue();
  const index = queue.keywords.findIndex(k => k.id === id);

  if (index === -1) {
    return false;
  }

  queue.keywords.splice(index, 1);
  saveQueue(queue);

  console.log(`[Queue] Deleted keyword: ${id}`);
  return true;
}

/**
 * Reset a failed keyword to pending
 */
export function resetKeyword(id: number): Keyword | null {
  return updateKeywordStatus(id, 'pending', { notes: undefined });
}

/**
 * Import keywords from a text file (one per line)
 */
export function importFromFile(filePath: string, topicCluster?: string): Keyword[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const keywords = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));

  return addKeywords(keywords, topicCluster);
}

/**
 * Export queue to CSV
 */
export function exportToCSV(outputPath?: string): string {
  const queue = loadQueue();
  const headers = ['id', 'keyword', 'slug', 'status', 'priority', 'topicCluster', 'searchVolume', 'difficulty', 'createdAt', 'publishedAt'];

  const rows = queue.keywords.map(k =>
    headers.map(h => {
      const value = k[h as keyof Keyword];
      if (value === undefined || value === null) return '';
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return String(value);
    }).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');

  if (outputPath) {
    fs.writeFileSync(outputPath, csv);
    console.log(`[Queue] Exported to: ${outputPath}`);
  }

  return csv;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'add':
      if (!arg) {
        console.error('Usage: queue.ts add "keyword"');
        process.exit(1);
      }
      const added = addKeyword(arg);
      console.log(JSON.stringify(added, null, 2));
      break;

    case 'next':
      const next = getNextKeyword();
      if (next) {
        console.log(JSON.stringify(next, null, 2));
      } else {
        console.log('No pending keywords');
      }
      break;

    case 'status':
      const stats = getQueueStats();
      console.log(JSON.stringify(stats, null, 2));
      break;

    case 'list':
      const status = arg as KeywordStatus || 'pending';
      const keywords = getKeywordsByStatus(status, 20);
      console.log(JSON.stringify(keywords, null, 2));
      break;

    case 'export':
      const csv = exportToCSV(arg);
      if (!arg) console.log(csv);
      break;

    default:
      console.log(`
Local Keyword Queue CLI

Commands:
  add "keyword"     Add a keyword to the queue
  next              Get the next pending keyword
  status            Show queue statistics
  list [status]     List keywords by status (default: pending)
  export [file]     Export queue to CSV

Example:
  npx tsx src/servers/queue/local-queue.ts add "how to start a blog"
  npx tsx src/servers/queue/local-queue.ts next
  npx tsx src/servers/queue/local-queue.ts status
`);
  }
}
