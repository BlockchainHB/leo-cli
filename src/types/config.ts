/**
 * Leo User Configuration Types
 *
 * Defines the schema for leo.config.json which stores user preferences
 * for blog generation, CMS integration, and queue management.
 */

export interface BlogConfig {
  /** Blog or website name */
  name: string;
  /** Primary niche/topic area */
  niche: string;
  /** Description of target audience */
  targetAudience: string;
  /** Brand voice/tone description */
  brandVoice: string;
  /** Base URL for the blog */
  baseUrl: string;
  /** Optional tagline */
  tagline?: string;
}

export interface SanityConfig {
  /** Sanity project ID */
  projectId: string;
  /** Sanity dataset (default: production) */
  dataset: string;
}

export interface SupabaseConfig {
  /** Supabase project ID */
  projectId: string;
}

export interface CMSConfig {
  /** CMS provider: 'sanity' or 'local' */
  provider: 'sanity' | 'local';
  /** Sanity-specific config (required if provider is 'sanity') */
  sanity?: SanityConfig;
}

export interface QueueConfig {
  /** Queue provider: 'local' or 'supabase' */
  provider: 'local' | 'supabase';
  /** Supabase-specific config (required if provider is 'supabase') */
  supabase?: SupabaseConfig;
}

export interface CategoryConfig {
  /** URL-safe slug */
  slug: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
}

export interface AuthorConfig {
  /** Author display name */
  name: string;
  /** Author ID (for CMS reference) */
  id?: string;
  /** Author email */
  email?: string;
  /** Author bio */
  bio?: string;
}

export interface ImageStyleConfig {
  /** Image style description */
  style: string;
  /** Color palette description */
  colorPalette: string;
  /** Background preference */
  background: 'light' | 'dark' | 'auto';
  /** Theme/mood */
  theme: string;
}

export interface WritingStyleConfig {
  /** Tone (e.g., 'professional', 'casual', 'technical') */
  tone: string;
  /** Point of view (e.g., 'first-person', 'third-person') */
  pointOfView: string;
  /** Formatting preferences */
  formatting: {
    /** Max paragraph length in sentences */
    maxParagraphSentences: number;
    /** Use bullet points */
    useBulletPoints: boolean;
    /** Include FAQs */
    includeFAQ: boolean;
    /** Include table of contents for long articles */
    includeTOC: boolean;
  };
  /** Words/phrases to avoid */
  avoidPhrases: string[];
  /** Preferred phrases/terms */
  preferredTerms: Record<string, string>;
}

export interface SEOConfig {
  /** Include year in titles */
  includeYearInTitles: boolean;
  /** Target word count ranges by article type */
  wordCountTargets: {
    guide: { min: number; max: number };
    howTo: { min: number; max: number };
    listicle: { min: number; max: number };
    comparison: { min: number; max: number };
  };
  /** Meta description length */
  metaDescriptionLength: { min: number; max: number };
}

export interface InternalLink {
  /** Page title */
  title: string;
  /** URL path */
  url: string;
  /** Topics this page covers */
  topics: string[];
  /** Short description */
  description?: string;
}

export interface LeoConfig {
  /** Version of config schema */
  version: '1.0';
  /** Blog configuration */
  blog: BlogConfig;
  /** CMS configuration */
  cms: CMSConfig;
  /** Keyword queue configuration */
  queue: QueueConfig;
  /** Blog categories */
  categories: CategoryConfig[];
  /** Default author */
  author: AuthorConfig;
  /** Image generation style */
  imageStyle?: ImageStyleConfig;
  /** Writing style preferences */
  writingStyle?: WritingStyleConfig;
  /** SEO preferences */
  seo?: SEOConfig;
  /** Internal links for backlinking */
  internalLinks?: InternalLink[];
  /** Custom prompts/instructions */
  customInstructions?: string;
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<LeoConfig> = {
  version: '1.0',
  cms: {
    provider: 'local'
  },
  queue: {
    provider: 'local'
  },
  imageStyle: {
    style: '3D isometric illustration',
    colorPalette: 'modern, vibrant colors',
    background: 'light',
    theme: 'professional and friendly'
  },
  writingStyle: {
    tone: 'professional yet approachable',
    pointOfView: 'second-person',
    formatting: {
      maxParagraphSentences: 3,
      useBulletPoints: true,
      includeFAQ: true,
      includeTOC: true
    },
    avoidPhrases: ['click here', 'read more', 'as you know'],
    preferredTerms: {}
  },
  seo: {
    includeYearInTitles: true,
    wordCountTargets: {
      guide: { min: 3000, max: 6000 },
      howTo: { min: 1500, max: 3000 },
      listicle: { min: 2000, max: 4000 },
      comparison: { min: 2000, max: 4000 }
    },
    metaDescriptionLength: { min: 150, max: 160 }
  },
  categories: [],
  internalLinks: []
};

/**
 * Validate a Leo configuration object
 */
export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be an object'] };
  }

  const cfg = config as Record<string, unknown>;

  // Required fields
  if (!cfg.blog || typeof cfg.blog !== 'object') {
    errors.push('blog configuration is required');
  } else {
    const blog = cfg.blog as Record<string, unknown>;
    if (!blog.name) errors.push('blog.name is required');
    if (!blog.niche) errors.push('blog.niche is required');
    if (!blog.targetAudience) errors.push('blog.targetAudience is required');
    if (!blog.brandVoice) errors.push('blog.brandVoice is required');
    if (!blog.baseUrl) errors.push('blog.baseUrl is required');
  }

  if (!cfg.author || typeof cfg.author !== 'object') {
    errors.push('author configuration is required');
  } else {
    const author = cfg.author as Record<string, unknown>;
    if (!author.name) errors.push('author.name is required');
  }

  // CMS validation
  if (cfg.cms && typeof cfg.cms === 'object') {
    const cms = cfg.cms as Record<string, unknown>;
    if (cms.provider === 'sanity') {
      if (!cms.sanity || typeof cms.sanity !== 'object') {
        errors.push('cms.sanity configuration is required when provider is sanity');
      } else {
        const sanity = cms.sanity as Record<string, unknown>;
        if (!sanity.projectId) errors.push('cms.sanity.projectId is required');
      }
    }
  }

  // Queue validation
  if (cfg.queue && typeof cfg.queue === 'object') {
    const queue = cfg.queue as Record<string, unknown>;
    if (queue.provider === 'supabase') {
      if (!queue.supabase || typeof queue.supabase !== 'object') {
        errors.push('queue.supabase configuration is required when provider is supabase');
      } else {
        const supabase = queue.supabase as Record<string, unknown>;
        if (!supabase.projectId) errors.push('queue.supabase.projectId is required');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Merge user config with defaults
 */
export function mergeWithDefaults(userConfig: Partial<LeoConfig>): LeoConfig {
  const now = new Date().toISOString();

  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    version: '1.0',
    imageStyle: {
      ...DEFAULT_CONFIG.imageStyle,
      ...userConfig.imageStyle
    },
    writingStyle: {
      ...DEFAULT_CONFIG.writingStyle,
      ...userConfig.writingStyle,
      formatting: {
        ...DEFAULT_CONFIG.writingStyle?.formatting,
        ...userConfig.writingStyle?.formatting
      }
    },
    seo: {
      ...DEFAULT_CONFIG.seo,
      ...userConfig.seo,
      wordCountTargets: {
        ...DEFAULT_CONFIG.seo?.wordCountTargets,
        ...userConfig.seo?.wordCountTargets
      }
    },
    createdAt: userConfig.createdAt || now,
    updatedAt: now
  } as LeoConfig;
}
