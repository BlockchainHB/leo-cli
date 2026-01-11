/**
 * DataForSEO API Client
 *
 * Provides SERP data and keyword metrics at a fraction of Ahrefs cost.
 *
 * API Docs: https://docs.dataforseo.com/
 */

import { config } from 'dotenv';
config();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ContentType = 'article' | 'video' | 'tool' | 'forum' | 'ecommerce' | 'official' | 'unknown';

export interface SerpResult {
  position: number;
  url: string;
  title: string;
  description: string;
  domain: string;
  contentType: ContentType;
  timestamp?: string; // ISO date string if available
  breadcrumb?: string;
  isVideo?: boolean;
  isFeaturedSnippet?: boolean;
  websiteName?: string;
}

export interface SerpMetadata {
  queriedAt: string;
  location: string;
  language: string;
  positionsReturned: number;
  positionGaps: number[]; // Missing positions in the range
  itemTypes: Record<string, number>; // Count of each item type (organic, ads, etc.)
}

export interface SerpResponse {
  keyword: string;
  location: string;
  results: SerpResult[];
  totalResults: number;
  metadata: SerpMetadata;
}

export interface KeywordMetrics {
  keyword: string;
  searchVolume: number;
  competition: number; // 0-1 scale
  cpc: number;
  difficulty: number; // Estimated 0-100
}

// ─────────────────────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dataforseo.com/v3';

function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new Error('DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD must be set in .env');
  }

  const credentials = Buffer.from(`${login}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

async function apiRequest<T>(endpoint: string, data: unknown[]): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERP API - Get top ranking URLs for a keyword
// ─────────────────────────────────────────────────────────────────────────────

interface DataForSeoSerpItem {
  type: string;
  rank_absolute: number;
  url: string;
  title: string;
  description: string;
  domain: string;
  timestamp?: string;
  breadcrumb?: string;
  is_video?: boolean;
  is_featured_snippet?: boolean;
  website_name?: string;
}

interface DataForSeoSerpResponse {
  tasks: Array<{
    result: Array<{
      keyword: string;
      se_results_count: number;
      datetime: string;
      items: DataForSeoSerpItem[];
    }>;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Type Detection
// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_DOMAINS = ['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com', 'dailymotion.com'];
const FORUM_DOMAINS = ['reddit.com', 'quora.com', 'stackexchange.com', 'stackoverflow.com'];
const ECOMMERCE_DOMAINS = ['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com', 'shopify.com', 'alibaba.com'];
const TOOL_PATTERNS = [/calculator/i, /tool/i, /generator/i, /checker/i, /analyzer/i, /estimator/i, /converter/i];
// Official domains can be configured per niche - default to common platforms
const OFFICIAL_DOMAINS: string[] = [];

function detectContentType(item: DataForSeoSerpItem): ContentType {
  const { domain, url, title, is_video, breadcrumb } = item;
  const lowerDomain = domain.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const lowerTitle = (title || '').toLowerCase();
  const lowerBreadcrumb = (breadcrumb || '').toLowerCase();

  // Video detection
  if (is_video || VIDEO_DOMAINS.some(d => lowerDomain.includes(d))) {
    return 'video';
  }

  // Forum detection
  if (FORUM_DOMAINS.some(d => lowerDomain.includes(d))) {
    return 'forum';
  }

  // Official platform pages (configurable per niche)
  if (OFFICIAL_DOMAINS.some(d => lowerDomain.includes(d)) && !lowerUrl.includes('/blog')) {
    return 'official';
  }

  // Ecommerce detection
  if (ECOMMERCE_DOMAINS.some(d => lowerDomain.includes(d)) && !lowerDomain.includes('sellercentral')) {
    return 'ecommerce';
  }

  // Tool/calculator detection (check URL, title, and breadcrumb)
  const combined = `${lowerUrl} ${lowerTitle} ${lowerBreadcrumb}`;
  if (TOOL_PATTERNS.some(p => p.test(combined))) {
    return 'tool';
  }

  // Default to article for blog-like content
  return 'article';
}

export async function getSerpResults(options: {
  keyword: string;
  location?: string; // Default: "United States"
  language?: string; // Default: "English" (full name)
  depth?: number; // Number of results (default: 10)
}): Promise<SerpResponse> {
  const { keyword, location = 'United States', language = 'English', depth = 10 } = options;

  const requestData = [{
    keyword,
    location_name: location,
    language_name: language,
    depth,
  }];

  const response = await apiRequest<DataForSeoSerpResponse>(
    '/serp/google/organic/live/advanced',
    requestData
  );

  const task = response.tasks?.[0];
  const result = task?.result?.[0];

  if (!result) {
    return {
      keyword,
      location,
      results: [],
      totalResults: 0,
      metadata: {
        queriedAt: new Date().toISOString(),
        location,
        language,
        positionsReturned: 0,
        positionGaps: [],
        itemTypes: {},
      },
    };
  }

  const allItems = result.items || [];

  // Count all item types for metadata
  const itemTypes: Record<string, number> = {};
  for (const item of allItems) {
    itemTypes[item.type] = (itemTypes[item.type] || 0) + 1;
  }

  // Filter to only organic results
  const organicItems = allItems.filter(item => item.type === 'organic');
  const organicResults: SerpResult[] = organicItems
    .slice(0, depth)
    .map(item => ({
      position: item.rank_absolute,
      url: item.url,
      title: item.title || '',
      description: item.description || '',
      domain: item.domain,
      contentType: detectContentType(item),
      timestamp: item.timestamp,
      breadcrumb: item.breadcrumb,
      isVideo: item.is_video,
      isFeaturedSnippet: item.is_featured_snippet,
      websiteName: item.website_name,
    }));

  // Calculate position gaps (which positions are missing from organic results)
  const positions = organicResults.map(r => r.position);
  const maxPosition = Math.max(...positions, 0);
  const positionGaps: number[] = [];
  for (let i = 1; i <= maxPosition; i++) {
    if (!positions.includes(i)) {
      positionGaps.push(i);
    }
  }

  return {
    keyword,
    location,
    results: organicResults,
    totalResults: result.se_results_count || 0,
    metadata: {
      queriedAt: result.datetime || new Date().toISOString(),
      location,
      language,
      positionsReturned: organicResults.length,
      positionGaps,
      itemTypes,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Keywords Data API - Get search volume and metrics
// ─────────────────────────────────────────────────────────────────────────────

interface DataForSeoKeywordsResponse {
  tasks: Array<{
    result: Array<{
      keyword: string;
      search_volume: number;
      competition: number;
      cpc: number;
      keyword_info?: {
        search_volume: number;
      };
    }>;
  }>;
}

export async function getKeywordMetrics(options: {
  keyword: string;
  location?: string;
  language?: string;
}): Promise<KeywordMetrics> {
  const { keyword, location = 'United States', language = 'English' } = options;

  const requestData = [{
    keywords: [keyword],
    location_name: location,
    language_name: language,
  }];

  const response = await apiRequest<DataForSeoKeywordsResponse>(
    '/keywords_data/google_ads/search_volume/live',
    requestData
  );

  const task = response.tasks?.[0];
  const result = task?.result?.[0];

  if (!result) {
    return {
      keyword,
      searchVolume: 0,
      competition: 0,
      cpc: 0,
      difficulty: 0,
    };
  }

  // Estimate difficulty from competition (0-1 scale to 0-100)
  const difficulty = Math.round((result.competition || 0) * 100);

  return {
    keyword,
    searchVolume: result.search_volume || 0,
    competition: result.competition || 0,
    cpc: result.cpc || 0,
    difficulty,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined function - Get both SERP and metrics in one call
// ─────────────────────────────────────────────────────────────────────────────

export interface FullKeywordData {
  keyword: string;
  metrics: KeywordMetrics;
  serp: SerpResponse;
}

export async function getFullKeywordData(options: {
  keyword: string;
  location?: string;
  language?: string;
  serpDepth?: number;
}): Promise<FullKeywordData> {
  const { keyword, location, language, serpDepth } = options;

  // Run both requests in parallel
  const [metrics, serp] = await Promise.all([
    getKeywordMetrics({ keyword, location, language }),
    getSerpResults({ keyword, location, language, depth: serpDepth }),
  ]);

  return {
    keyword,
    metrics,
    serp,
  };
}
