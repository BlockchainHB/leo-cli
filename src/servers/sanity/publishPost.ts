/**
 * Sanity: Publish Post
 * 
 * Publishes a draft post or schedules for future publication.
 * Uses the Sanity Scheduling API for true scheduling.
 */

import { createClient } from '@sanity/client';

interface PublishPostInput {
  /** Document ID to publish */
  documentId: string;
}

interface PublishPostResponse {
  /** Document ID */
  documentId: string;
  /** New revision */
  revision: string;
  /** Published timestamp */
  publishedAt: string;
  /** Public URL */
  url: string;
}

interface ScheduleResponse {
  /** Schedule ID from Sanity */
  scheduleId: string;
  /** Document ID */
  documentId: string;
  /** Scheduled execution time */
  executeAt: string;
  /** Schedule state */
  state: string;
}

// Get Sanity API token (supports both SANITY_API_TOKEN and SANITY_API_KEY)
function getSanityToken(): string | undefined {
  return process.env.SANITY_API_TOKEN || process.env.SANITY_API_KEY;
}

// Lazy-initialized Sanity client
let sanityClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!sanityClient) {
    const projectId = process.env.SANITY_PROJECT_ID;
    if (!projectId) {
      throw new Error('SANITY_PROJECT_ID environment variable is required');
    }
    sanityClient = createClient({
      projectId,
      dataset: process.env.SANITY_DATASET || 'production',
      apiVersion: '2025-01-01',
      token: getSanityToken(),
      useCdn: false
    });
  }
  return sanityClient;
}

function getProjectId(): string {
  const projectId = process.env.SANITY_PROJECT_ID;
  if (!projectId) {
    throw new Error('SANITY_PROJECT_ID environment variable is required');
  }
  return projectId;
}

const DATASET = process.env.SANITY_DATASET || 'production';

/**
 * Publish a draft post immediately.
 * 
 * @example
 * const result = await publishPost({ documentId: 'drafts.abc123' });
 * console.log(`Published at: ${result.url}`);
 */
export async function publishPost(
  input: PublishPostInput
): Promise<PublishPostResponse> {
  const client = getClient();
  
  if (!getSanityToken()) {
    console.warn('[Sanity] No API token found, returning mock response');
    return {
      documentId: input.documentId,
      revision: 'mock-rev',
      publishedAt: new Date().toISOString(),
      url: '/blog/mock-slug'
    };
  }

  try {
    // Get the document to find the slug
    const doc = await client.getDocument(input.documentId);
    if (!doc) {
      throw new Error(`Document not found: ${input.documentId}`);
    }

    // Update publishedAt timestamp
    const result = await client
      .patch(input.documentId)
      .set({ publishedAt: new Date().toISOString() })
      .commit();

    const slug = (doc.slug as { current: string })?.current || 'unknown';

    // Build URL from config or use relative path
    const baseUrl = process.env.BLOG_BASE_URL || '';
    return {
      documentId: result._id,
      revision: result._rev,
      publishedAt: result.publishedAt as string,
      url: `${baseUrl}/blog/${slug}`
    };
  } catch (error) {
    console.error('[Sanity] Publish failed:', error);
    throw error;
  }
}

/**
 * Schedule a post for future publication using Sanity Scheduling API.
 * 
 * @param documentId - The document ID to schedule (without 'drafts.' prefix for published doc)
 * @param publishAt - ISO date string for when to publish (e.g., "2025-12-08T14:00:00.000Z")
 * @param name - Optional name for the schedule
 * 
 * @example
 * // Schedule for Dec 8, 2025 at 9am EST
 * await schedulePost('abc123', '2025-12-08T14:00:00.000Z', 'Fulfillment Center Article');
 */
export async function schedulePost(
  documentId: string,
  publishAt: string,
  name?: string
): Promise<ScheduleResponse> {
  if (!getSanityToken()) {
    console.warn('[Sanity] No API token found, returning mock response');
    return {
      scheduleId: 'mock-schedule-id',
      documentId,
      executeAt: publishAt,
      state: 'scheduled'
    };
  }

  // Remove 'drafts.' prefix if present - Scheduling API needs the base document ID
  const baseDocId = documentId.replace(/^drafts\./, '');
  
  // Ensure UTC format with Z suffix
  const executeAt = publishAt.endsWith('Z') ? publishAt : `${publishAt}Z`;

  const scheduleName = name || `Scheduled publish: ${baseDocId}`;

  try {
    // POST to Sanity Scheduling API
    const response = await fetch(
      `https://${getProjectId()}.api.sanity.io/v2022-04-01/schedules/${getProjectId()}/${DATASET}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getSanityToken()}`
        },
        body: JSON.stringify({
          documents: [{ documentId: baseDocId }],
          name: scheduleName,
          executeAt,
          action: 'publish'
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scheduling API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as {
      id: string;
      executeAt: string;
      state: string;
    };

    return {
      scheduleId: result.id,
      documentId: baseDocId,
      executeAt: result.executeAt,
      state: result.state
    };
  } catch (error) {
    console.error('[Sanity] Schedule failed:', error);
    throw error;
  }
}

/**
 * List scheduled publishes for a document.
 */
export async function listSchedules(documentId?: string): Promise<Array<{
  id: string;
  name: string;
  documentId: string;
  executeAt: string;
  state: string;
}>> {
  if (!getSanityToken()) {
    return [];
  }

  try {
    let url = `https://${getProjectId()}.api.sanity.io/v2022-04-01/schedules/${getProjectId()}/${DATASET}`;
    if (documentId) {
      const baseDocId = documentId.replace(/^drafts\./, '');
      url += `?documentIds=${baseDocId}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.SANITY_API_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Scheduling API error: ${response.status}`);
    }

    const result = await response.json() as {
      schedules?: Array<{
        id: string;
        name: string;
        documents?: Array<{ documentId: string }>;
        executeAt: string;
        state: string;
      }>;
    };
    
    return (result.schedules || []).map((s) => ({
      id: s.id,
      name: s.name,
      documentId: s.documents?.[0]?.documentId || '',
      executeAt: s.executeAt,
      state: s.state
    }));
  } catch (error) {
    console.error('[Sanity] List schedules failed:', error);
    return [];
  }
}

/**
 * Cancel a scheduled publish.
 */
export async function cancelSchedule(scheduleId: string): Promise<boolean> {
  if (!process.env.SANITY_API_TOKEN) {
    return false;
  }

  try {
    const response = await fetch(
      `https://${getProjectId()}.api.sanity.io/v2022-04-01/schedules/${getProjectId()}/${DATASET}/${scheduleId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getSanityToken()}`
        },
        body: JSON.stringify({ state: 'cancelled' })
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[Sanity] Cancel schedule failed:', error);
    return false;
  }
}

/**
 * Query posts by status.
 */
export async function queryPosts(options: {
  status?: 'draft' | 'published' | 'scheduled';
  limit?: number;
}): Promise<Array<{
  _id: string;
  title: string;
  slug: string;
  publishedAt?: string;
}>> {
  const client = getClient();
  
  let filter = '*[_type == "post"';
  if (options.status === 'draft') {
    filter += ' && !defined(publishedAt)';
  } else if (options.status === 'published') {
    filter += ' && defined(publishedAt) && publishedAt <= now()';
  } else if (options.status === 'scheduled') {
    filter += ' && defined(publishedAt) && publishedAt > now()';
  }
  filter += ']';

  const projection = '{ _id, title, "slug": slug.current, publishedAt }';
  const order = ' | order(publishedAt desc)';
  const limit = options.limit ? `[0...${options.limit}]` : '';

  const query = `${filter}${projection}${order}${limit}`;
  
  try {
    return await client.fetch(query);
  } catch (error) {
    console.error('[Sanity] Query failed:', error);
    return [];
  }
}

/**
 * Delete a draft post.
 */
export async function deletePost(documentId: string): Promise<boolean> {
  const client = getClient();
  
  try {
    await client.delete(documentId);
    return true;
  } catch (error) {
    console.error('[Sanity] Delete failed:', error);
    return false;
  }
}

/**
 * Get scheduled posts (using GROQ - posts with future publishedAt).
 * Note: This shows posts marked for future dates, but true scheduled publishes
 * should use listSchedules() to check the Scheduling API.
 */
export async function getScheduledPosts(): Promise<Array<{
  _id: string;
  title: string;
  slug: string;
  publishedAt: string;
}>> {
  const client = getClient();
  
  const query = `*[_type == "post" && publishedAt > now()]{
    _id,
    title,
    "slug": slug.current,
    publishedAt
  } | order(publishedAt asc)`;
  
  try {
    return await client.fetch(query);
  } catch (error) {
    console.error('[Sanity] Query scheduled posts failed:', error);
    return [];
  }
}
