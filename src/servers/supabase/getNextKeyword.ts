/**
 * Supabase: Get Next Keyword
 * 
 * Retrieves the next pending keyword from the queue based on ROI score.
 * Matches the existing keyword_queue table schema.
 */

import { callMCPTool } from '../../client.js';

interface QueuedKeyword {
  id: number;
  topic_cluster: string;
  primary_keyword: string;
  volume: number;
  kd: number; // keyword difficulty
  bv: number; // business value
  roi: number;
  status: 'pending' | 'in_progress' | 'drafted' | 'published';
  source: string;
  file_hint: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GetNextKeywordInput {
  /** Filter by topic cluster (optional) */
  cluster?: string;
  /** Limit number of results (default: 1) */
  limit?: number;
}

/**
 * Get the next pending keyword from the queue.
 * Returns keywords ordered by ROI (highest first) then by created_at.
 * 
 * @example
 * const keyword = await getNextKeyword();
 * console.log(`Next up: "${keyword.primary_keyword}" (Vol: ${keyword.volume})`);
 */
export async function getNextKeyword(
  input: GetNextKeywordInput = {}
): Promise<QueuedKeyword | null> {
  const limit = input.limit || 1;
  
  let query = `
    SELECT * FROM keyword_queue 
    WHERE status = 'pending'
  `;
  
  if (input.cluster) {
    query += ` AND topic_cluster = '${input.cluster}'`;
  }
  
  query += ` ORDER BY roi DESC, created_at ASC LIMIT ${limit}`;

  const response = await callMCPTool<{ rows: QueuedKeyword[] }>(
    'supabase__execute_sql',
    { query }
  );

  if (response.data?.rows?.[0]) {
    return response.data.rows[0];
  }

  try {
    const text = response.content[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.rows?.[0]) {
        return parsed.rows[0];
      }
    }
  } catch {
    // No results
  }

  return null;
}

/**
 * Get multiple pending keywords from the queue.
 * 
 * @example
 * const keywords = await getQueuedKeywords({ limit: 5 });
 * keywords.forEach(k => console.log(`${k.primary_keyword}: ${k.volume}`));
 */
export async function getQueuedKeywords(
  input: GetNextKeywordInput = {}
): Promise<QueuedKeyword[]> {
  const limit = input.limit || 10;
  
  let query = `
    SELECT * FROM keyword_queue 
    WHERE status = 'pending'
  `;
  
  if (input.cluster) {
    query += ` AND topic_cluster = '${input.cluster}'`;
  }
  
  query += ` ORDER BY roi DESC, created_at ASC LIMIT ${limit}`;

  const response = await callMCPTool<{ rows: QueuedKeyword[] }>(
    'supabase__execute_sql',
    { query }
  );

  if (response.data?.rows) {
    return response.data.rows;
  }

  try {
    const text = response.content[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      return parsed.rows || [];
    }
  } catch {
    // Return empty array
  }

  return [];
}

export type { QueuedKeyword };
