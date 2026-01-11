/**
 * CMS Adapter
 *
 * Unified interface for CMS operations.
 * Supports multiple backends: Sanity CMS or local markdown files.
 */

import { loadConfig } from '../../utils/config-manager.js';
import * as localCMS from './local/index.js';

export interface BlogPost {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  heroImage?: string;
  heroImageAlt?: string;
  category: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  heroImage?: string;
  heroImageAlt?: string;
  category: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  publish?: boolean;
}

export interface CMSAdapter {
  createPost(input: CreatePostInput): Promise<{ path: string; status: 'draft' | 'published'; slug: string }>;
  getPost(slug: string): Promise<BlogPost | null>;
  publishPost(slug: string): Promise<{ path: string; status: 'published'; publishedAt: string }>;
  updatePost(slug: string, updates: Partial<CreatePostInput>): Promise<{ path: string; updatedAt: string }>;
  listPosts(options?: { status?: 'draft' | 'published'; limit?: number }): Promise<Array<{
    title: string;
    slug: string;
    status: 'draft' | 'published';
    updatedAt: string;
  }>>;
  deletePost(slug: string): Promise<boolean>;
}

/**
 * Get the CMS adapter based on configuration
 */
export function getCMSAdapter(): CMSAdapter {
  const config = loadConfig();
  const provider = config?.cms?.provider || 'local';

  switch (provider) {
    case 'sanity':
      return createSanityAdapter(config?.cms?.sanity);

    case 'local':
    default:
      return createLocalAdapter();
  }
}

/**
 * Create local markdown CMS adapter
 */
function createLocalAdapter(): CMSAdapter {
  return {
    async createPost(input) {
      return localCMS.createPost(input);
    },

    async getPost(slug) {
      const post = await localCMS.getPost(slug);
      if (!post) return null;
      return post as BlogPost;
    },

    async publishPost(slug) {
      return localCMS.publishPost(slug);
    },

    async updatePost(slug, updates) {
      return localCMS.updatePost(slug, updates);
    },

    async listPosts(options) {
      const posts = await localCMS.listPosts(options);
      return posts.map(p => ({
        title: p.title,
        slug: p.slug,
        status: p.status,
        updatedAt: p.updatedAt
      }));
    },

    async deletePost(slug) {
      return localCMS.deletePost(slug);
    }
  };
}

/**
 * Create Sanity CMS adapter
 */
function createSanityAdapter(config?: { projectId?: string; dataset?: string }): CMSAdapter {
  const projectId = config?.projectId || process.env.SANITY_PROJECT_ID;
  const dataset = config?.dataset || process.env.SANITY_DATASET || 'production';

  if (!projectId) {
    console.warn('[CMS] Sanity project ID not configured, falling back to local');
    return createLocalAdapter();
  }

  // Lazy load Sanity functions when needed
  const getSanityFns = async () => {
    try {
      const sanity = await import('../sanity/index.js');
      return sanity;
    } catch (err) {
      console.warn('[CMS] Sanity module not available, falling back to local');
      return null;
    }
  };

  // For Sanity, we use a hybrid approach:
  // - createPost and publishPost use Sanity functions
  // - getPost, updatePost, listPosts fall back to local (or use queryPosts for list)
  const localAdapter = createLocalAdapter();

  return {
    async createPost(input) {
      const sanity = await getSanityFns();
      if (!sanity) return localAdapter.createPost(input);

      // Sanity createPost has a different signature - fall back to local for simplicity
      // The Sanity workflow uses publishDraftToSanity instead
      return localAdapter.createPost(input);
    },

    async getPost(slug) {
      // Sanity module doesn't export getPost - use local
      return localAdapter.getPost(slug);
    },

    async publishPost(slug) {
      const sanity = await getSanityFns();
      if (!sanity) return localAdapter.publishPost(slug);

      // Sanity publishPost takes { documentId: string }
      if (typeof sanity.publishPost === 'function') {
        try {
          const result = await sanity.publishPost({ documentId: slug });
          return {
            path: result.documentId || slug,
            status: 'published' as const,
            publishedAt: result.publishedAt || new Date().toISOString()
          };
        } catch (err) {
          console.warn('[CMS] Sanity publish failed, falling back to local:', err);
          return localAdapter.publishPost(slug);
        }
      }

      return localAdapter.publishPost(slug);
    },

    async updatePost(slug, updates) {
      // Sanity module doesn't export updatePost - use local
      return localAdapter.updatePost(slug, updates);
    },

    async listPosts(options) {
      const sanity = await getSanityFns();
      if (!sanity) return localAdapter.listPosts(options);

      // Sanity uses queryPosts instead of listPosts
      if (typeof sanity.queryPosts === 'function') {
        try {
          const posts = await sanity.queryPosts({
            status: options?.status,
            limit: options?.limit
          });
          return posts.map((p: Record<string, unknown>) => {
            const slug = p.slug;
            const slugStr = typeof slug === 'string'
              ? slug
              : (slug && typeof slug === 'object' && 'current' in slug)
                ? (slug as { current: string }).current
                : '';
            return {
              title: String(p.title || ''),
              slug: slugStr,
              status: p.publishedAt ? 'published' as const : 'draft' as const,
              updatedAt: String(p.publishedAt || new Date().toISOString())
            };
          });
        } catch (err) {
          console.warn('[CMS] Sanity query failed, falling back to local:', err);
          return localAdapter.listPosts(options);
        }
      }

      return localAdapter.listPosts(options);
    },

    async deletePost(slug) {
      const sanity = await getSanityFns();
      if (!sanity) return localAdapter.deletePost(slug);

      if (typeof sanity.deletePost === 'function') {
        try {
          await sanity.deletePost(slug);
          return true;
        } catch (err) {
          console.warn('[CMS] Sanity delete failed, falling back to local:', err);
          return localAdapter.deletePost(slug);
        }
      }

      return localAdapter.deletePost(slug);
    }
  };
}

/**
 * Get the current CMS provider name
 */
export function getCMSProvider(): 'local' | 'sanity' {
  const config = loadConfig();
  return config?.cms?.provider || 'local';
}

/**
 * Check if a CMS is properly configured
 */
export function isCMSConfigured(): boolean {
  const config = loadConfig();

  if (!config) return false;

  const provider = config.cms?.provider || 'local';

  if (provider === 'local') {
    return true; // Local always works
  }

  if (provider === 'sanity') {
    return !!(config.cms?.sanity?.projectId || process.env.SANITY_PROJECT_ID);
  }

  return false;
}
