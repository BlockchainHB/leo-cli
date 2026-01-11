/**
 * Ahrefs: Get Keyword Volume
 * 
 * Retrieves search volume, keyword difficulty, and related metrics
 * for a given keyword using the Ahrefs MCP server.
 */

import { callMCPTool } from '../../client.js';
import type { AhrefsKeywordResult, MCPToolResponse } from '../../types/index.js';

interface GetKeywordVolumeInput {
  /** The keyword to research */
  keyword: string;
  /** Country code (default: 'us') */
  country?: string;
}

interface GetKeywordVolumeResponse {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  clicks: number;
  global_volume: number;
  parent_topic?: string;
}

/**
 * Get search volume and difficulty for a keyword.
 * 
 * @example
 * const data = await getKeywordVolume({ keyword: 'content marketing strategy' });
 * console.log(`Volume: ${data.volume}, KD: ${data.difficulty}`);
 */
export async function getKeywordVolume(
  input: GetKeywordVolumeInput
): Promise<GetKeywordVolumeResponse> {
  const response = await callMCPTool<GetKeywordVolumeResponse>(
    'ahrefs__keywords_explorer_volume',
    {
      keyword: input.keyword,
      country: input.country || 'us'
    }
  );

  // Parse the response text if needed
  if (response.data) {
    return response.data;
  }

  // Fallback: parse from text content
  try {
    const text = response.content[0]?.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch {
    // Return placeholder for development
  }

  return {
    keyword: input.keyword,
    volume: 0,
    difficulty: 0,
    cpc: 0,
    clicks: 0,
    global_volume: 0
  };
}

