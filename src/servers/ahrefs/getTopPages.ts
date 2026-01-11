/**
 * Ahrefs: Get Top Pages
 * 
 * Retrieves the top ranking pages for a keyword from SERP data.
 */

import { callMCPTool } from '../../client.js';
import type { AhrefsTopPage, MCPToolResponse } from '../../types/index.js';

interface GetTopPagesInput {
  /** The keyword to get top pages for */
  keyword: string;
  /** Country code (default: 'us') */
  country?: string;
  /** Number of results to return (default: 10) */
  limit?: number;
}

interface TopPageResult {
  position: number;
  url: string;
  title: string;
  traffic: number;
  keywords: number;
  domain_rating: number;
}

interface GetTopPagesResponse {
  keyword: string;
  pages: TopPageResult[];
}

/**
 * Get top ranking pages for a keyword.
 * 
 * @example
 * const { pages } = await getTopPages({ keyword: 'email marketing', limit: 5 });
 * const topUrls = pages.map(p => p.url);
 */
export async function getTopPages(
  input: GetTopPagesInput
): Promise<GetTopPagesResponse> {
  const response = await callMCPTool<GetTopPagesResponse>(
    'ahrefs__serp-overview-serp-overview',
    {
      keyword: input.keyword,
      country: input.country || 'us',
      select: 'position,url,title,domain_rating,traffic,backlinks,keywords',
      top_positions: input.limit || 10
    }
  );

  if (response.data) {
    return response.data;
  }

  try {
    const text = response.content[0]?.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch {
    // Return placeholder
  }

  return {
    keyword: input.keyword,
    pages: []
  };
}

