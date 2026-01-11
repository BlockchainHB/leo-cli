/**
 * Perplexity: Web Search
 * 
 * Search the web for current information using Perplexity Sonar.
 */

interface SearchWebInput {
  /** The search query */
  query: string;
  /** Recency filter: day, week, month, year */
  recency?: 'day' | 'week' | 'month' | 'year';
}

interface SearchWebResponse {
  query: string;
  answer: string;
  sources: string[];
}

/**
 * Search the web using Perplexity Sonar API.
 * 
 * @example
 * const result = await searchWeb({ query: "content marketing best practices 2025" });
 * console.log(result.answer);
 * console.log(result.sources);
 */
export async function searchWeb(input: SearchWebInput): Promise<SearchWebResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not set');
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: input.query
          }
        ],
        search_recency_filter: input.recency || 'month'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      citations?: string[];
    };

    const answer = data.choices?.[0]?.message?.content || '';
    const sources = data.citations || [];

    return {
      query: input.query,
      answer,
      sources
    };
  } catch (error) {
    console.error('[Perplexity] Search failed:', error);
    throw error;
  }
}

