/**
 * Supabase: Mark Keyword Complete
 * 
 * Updates keyword status and records the published article.
 * Matches the existing keyword_queue table schema.
 */

import { callMCPTool } from '../../client.js';

interface MarkCompleteInput {
  /** Keyword ID to mark as complete */
  keywordId: number;
  /** Sanity document ID of the published article */
  sanityId: string;
  /** URL slug of the published article */
  slug: string;
  /** Title of the published article */
  title: string;
  /** Word count (optional) */
  wordCount?: number;
  /** Number of images (optional) */
  imageCount?: number;
}

interface MarkCompleteResponse {
  success: boolean;
  keywordId: number;
  articleId: string;
}

/**
 * Mark a keyword as completed and record the published article.
 * 
 * @example
 * await markComplete({
 *   keywordId: 123,
 *   sanityId: 'sanity-doc-id',
 *   slug: 'my-blog-post',
 *   title: 'Complete Guide to Your Topic'
 * });
 */
export async function markComplete(
  input: MarkCompleteInput
): Promise<MarkCompleteResponse> {
  // Update keyword status to published
  const updateQuery = `
    UPDATE keyword_queue 
    SET status = 'published', published_at = CURRENT_DATE, updated_at = NOW()
    WHERE id = ${input.keywordId}
    RETURNING id
  `;

  await callMCPTool('supabase__execute_sql', { query: updateQuery });

  // Insert published article record
  const insertQuery = `
    INSERT INTO published_articles (keyword_id, sanity_id, slug, title, word_count, image_count, published_at)
    VALUES (${input.keywordId}, '${input.sanityId}', '${input.slug}', '${input.title.replace(/'/g, "''")}', ${input.wordCount || 'NULL'}, ${input.imageCount || 0}, NOW())
    RETURNING id
  `;

  const response = await callMCPTool<{ rows: Array<{ id: string }> }>(
    'supabase__execute_sql',
    { query: insertQuery }
  );

  let articleId = '';
  if (response.data?.rows?.[0]) {
    articleId = response.data.rows[0].id;
  }

  return {
    success: true,
    keywordId: input.keywordId,
    articleId
  };
}

/**
 * Update keyword status to in_progress.
 * Call this when starting work on a keyword.
 */
export async function markInProgress(keywordId: number): Promise<void> {
  const query = `
    UPDATE keyword_queue 
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = ${keywordId}
  `;

  await callMCPTool('supabase__execute_sql', { query });
}

/**
 * Update keyword status to drafted.
 * Call this when draft is complete but not yet published.
 */
export async function markDrafted(keywordId: number): Promise<void> {
  const query = `
    UPDATE keyword_queue 
    SET status = 'drafted', updated_at = NOW()
    WHERE id = ${keywordId}
  `;

  await callMCPTool('supabase__execute_sql', { query });
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  in_progress: number;
  drafted: number;
  published: number;
}> {
  const query = `
    SELECT 
      status,
      COUNT(*)::int as count
    FROM keyword_queue
    GROUP BY status
  `;

  const response = await callMCPTool<{ rows: Array<{ status: string; count: number }> }>(
    'supabase__execute_sql',
    { query }
  );

  const stats = {
    pending: 0,
    in_progress: 0,
    drafted: 0,
    published: 0
  };

  const rows = response.data?.rows || [];
  for (const row of rows) {
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = row.count;
    }
  }

  return stats;
}

/**
 * Get recently published articles.
 */
export async function getRecentlyPublished(limit: number = 5): Promise<Array<{
  id: string;
  slug: string;
  title: string;
  published_at: string;
}>> {
  const query = `
    SELECT id, slug, title, published_at
    FROM published_articles
    ORDER BY published_at DESC
    LIMIT ${limit}
  `;

  const response = await callMCPTool<{ rows: Array<{
    id: string;
    slug: string;
    title: string;
    published_at: string;
  }> }>(
    'supabase__execute_sql',
    { query }
  );

  return response.data?.rows || [];
}
