// Type definitions for Leo - AI Blog Agent

export interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  cluster?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: number;
}

export interface CompetitorAnalysis {
  url: string;
  title: string;
  headings: string[];
  wordCount: number;
  ctaCount: number;
  keyTakeaways: string[];
}

export interface ResearchResult {
  keyword: KeywordData;
  competitors: CompetitorAnalysis[];
  contentGaps: string[];
  suggestedOutline: string[];
}

export interface BlogDraft {
  keyword: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  headings: string[];
  images: ImageAsset[];
  seo: SEOMetadata;
}

export interface ImageAsset {
  prompt: string;
  alt: string;
  base64?: string;
  sanityId?: string;
  url?: string;
}

export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
}

export interface PhaseTimings {
  research_started?: string;
  research_completed?: string;
  scraping_started?: string;
  scraping_completed?: string;
  analysis_started?: string;
  analysis_completed?: string;
  writing_started?: string;
  writing_completed?: string;
  images_started?: string;
  images_completed?: string;
}

export interface BlogProgress {
  current_article?: {
    keyword: string;
    status: 'researching' | 'drafting' | 'generating_images' | 'ready_to_publish';
    started_at: string;
    research_complete: boolean;
    draft_path?: string;
    images_generated: number;
    phase_timings?: PhaseTimings;
  };
  session_log: SessionLogEntry[];
  completed_articles: CompletedArticle[];
}

export interface SessionLogEntry {
  timestamp: string;
  action: string;
}

export interface CompletedArticle {
  keyword: string;
  sanity_id: string;
  slug: string;
  published_at: string;
}

// MCP Tool Response types
export interface MCPToolResponse<T = unknown> {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  data?: T;
}

// Ahrefs types
export interface AhrefsKeywordResult {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  parent_topic?: string;
}

export interface AhrefsTopPage {
  url: string;
  traffic: number;
  keywords: number;
  top_keyword: string;
  position: number;
}

// Firecrawl types
export interface FirecrawlResult {
  url: string;
  title: string;
  content: string;
  markdown: string;
  headings: string[];
  links: string[];
}

// Sanity types
export interface SanityPost {
  _id: string;
  _type: 'post';
  title: string;
  slug: { current: string };
  excerpt: string;
  body: unknown[]; // Portable Text
  heroImage: {
    asset: { _ref: string };
    alt: string;
  };
  categories: Array<{ _ref: string }>;
  author: { _ref: string };
  seo: {
    title: string;
    description: string;
  };
  publishedAt: string;
}

export interface SanityAsset {
  _id: string;
  url: string;
}

