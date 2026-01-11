/**
 * Sanity: Create Post
 * 
 * Creates a new blog post document in Sanity CMS.
 */

import { createClient } from '@sanity/client';
import type { SanityPost } from '../../types/index.js';

interface CreatePostInput {
  /** Post title */
  title: string;
  /** URL slug */
  slug: string;
  /** Short excerpt/description */
  excerpt: string;
  /** Portable Text body content OR raw markdown string */
  body: unknown[] | string;
  /** Hero image asset reference */
  heroImageRef: string;
  /** Hero image alt text */
  heroImageAlt: string;
  /** Category references */
  categoryRefs: string[];
  /** Author reference (from leo.config.json author.id) */
  authorRef?: string;
  /** SEO title */
  seoTitle: string;
  /** SEO description */
  seoDescription: string;
  /** Publish immediately (default: false - creates draft) */
  publish?: boolean;
  /** 
   * @deprecated DO NOT USE - This field is ignored!
   * To schedule a post, call schedulePost(documentId, date) AFTER createPost.
   * Setting publishedAt to a future date does NOT prevent the post from appearing live!
   */
  scheduledPublishAt?: string;
  /** Image assets to embed in body (src path -> {assetRef, alt, caption}) */
  bodyImages?: Record<string, { assetRef: string; alt: string; caption?: string }>;
}

interface CreatePostResponse {
  /** Sanity document ID */
  documentId: string;
  /** Document revision */
  revision: string;
  /** Full URL path */
  path: string;
  /** Post status: draft, published, or scheduled */
  status: 'draft' | 'published' | 'scheduled';
  /** If scheduled, the publish date */
  scheduledFor?: string;
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

// Default author ID - can be overridden via leo.config.json author.id
// If not set, posts will be created without an author reference
const DEFAULT_AUTHOR_REF: string | undefined = undefined;

/**
 * Validate required inputs before creating post
 */
function validateInputs(input: CreatePostInput): void {
  if (!input.heroImageRef || input.heroImageRef.trim() === '') {
    throw new Error('[Sanity] heroImageRef is required - upload image first and pass the asset._id');
  }
  if (!input.heroImageRef.startsWith('image-')) {
    throw new Error(`[Sanity] Invalid heroImageRef format: "${input.heroImageRef}". Expected format: image-{hash}-{dimensions}-{format}`);
  }
  if (!input.title || input.title.trim() === '') {
    throw new Error('[Sanity] title is required');
  }
  if (!input.slug || input.slug.trim() === '') {
    throw new Error('[Sanity] slug is required');
  }
  if (!input.categoryRefs || input.categoryRefs.length === 0) {
    throw new Error('[Sanity] At least one categoryRef is required');
  }
}

/**
 * Categories are loaded from leo.config.json
 * This is a placeholder - actual categories come from user configuration.
 *
 * Example config format:
 * {
 *   "categories": [
 *     { "slug": "tutorials", "name": "Tutorials", "id": "uuid-here" },
 *     { "slug": "guides", "name": "Guides", "id": "uuid-here" }
 *   ]
 * }
 */
export const SANITY_CATEGORIES: Record<string, string> = {};

export type SanityCategoryId = keyof typeof SANITY_CATEGORIES;

/**
 * Create a new blog post in Sanity CMS.
 * 
 * @example
 * const post = await createPost({
 *   title: 'Complete Guide to Your Topic',
 *   slug: 'your-topic-guide',
 *   excerpt: 'Master your topic with our comprehensive guide...',
 *   body: markdownContent, // Can be string or portable text array
 *   heroImageRef: 'image-abc123',
 *   heroImageAlt: 'Topic guide hero image',
 *   categoryRefs: ['tutorials'], // Category ID from leo.config.json
 *   seoTitle: 'Your Topic Guide | Your Blog',
 *   seoDescription: 'Learn everything about your topic...'
 * });
 */
export async function createPost(
  input: CreatePostInput
): Promise<CreatePostResponse> {
  const client = getClient();
  
  if (!getSanityToken()) {
    console.warn('[Sanity] No API token found, returning mock response');
    const mockStatus = input.publish ? 'published' : 'draft';
    return {
      documentId: 'mock-doc-id',
      revision: 'mock-rev',
      path: `/blog/${input.slug}`,
      status: mockStatus,
      scheduledFor: undefined
    };
  }

  try {
    // Validate required inputs
    validateInputs(input);
    
    // Convert body to portable text if it's a string
    let bodyContent: unknown[];
    if (typeof input.body === 'string') {
      bodyContent = markdownToPortableText(input.body, input.bodyImages);
    } else {
      bodyContent = input.body;
    }

    // Determine publishedAt based on options
    // IMPORTANT: Setting publishedAt does NOT schedule the post!
    // To schedule, call schedulePost() AFTER creating the document.
    let publishedAt: string | undefined;
    let status: 'draft' | 'published' | 'scheduled' = 'draft';
    
    if (input.publish) {
      // Publish immediately - set publishedAt to now
      publishedAt = new Date().toISOString();
      status = 'published';
    }
    // NOTE: scheduledPublishAt is IGNORED here. Do NOT set publishedAt for scheduled posts!
    // The document should be created as a draft (no publishedAt), then use
    // schedulePost(documentId, date) to schedule via the Sanity Scheduling API.
    // Setting publishedAt to a future date does NOT prevent the post from appearing!

    // Calculate read time (avg 200 words per minute)
    const bodyText = typeof input.body === 'string' ? input.body : '';
    const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
    
    // Log bodyImages for debugging
    if (input.bodyImages) {
      console.log(`[createPost] bodyImages provided with ${Object.keys(input.bodyImages).length} entries`);
    }

    const document = {
      _type: 'post',
      title: input.title,
      slug: { 
        _type: 'slug',
        current: input.slug 
      },
      excerpt: input.excerpt,
      body: bodyContent,
      heroImage: {
        _type: 'image',
        asset: {
          _type: 'reference',
          _ref: input.heroImageRef
        },
        alt: input.heroImageAlt
      },
      categories: input.categoryRefs.map(ref => ({
        _type: 'reference',
        _ref: ref,
        _key: ref
      })),
      // Authors array (not singular 'author')
      authors: [{
        _type: 'reference',
        _ref: input.authorRef || DEFAULT_AUTHOR_REF,
        _key: generateKey()
      }],
      seo: {
        _type: 'seo',
        title: input.seoTitle,
        description: input.seoDescription,
        // OG Image inside SEO object
        ogImage: {
          _type: 'image',
          asset: {
            _type: 'reference',
            _ref: input.heroImageRef
          },
          alt: input.heroImageAlt
        }
      },
      // Read time in minutes (field name is 'readingTime' not 'estimatedReadingTime')
      readingTime: readTimeMinutes,
      publishedAt
    };

    let result;
    let returnedDocId: string;

    if (input.publish) {
      // Publish immediately - use regular create (creates published document)
      result = await client.create(document);
      returnedDocId = result._id;
      console.log(`[Sanity] Created published post: ${result._id}`);
    } else {
      // Create as DRAFT - prefix ID with 'drafts.'
      // Generate a unique ID for the document
      const docId = `post-${input.slug}-${Date.now()}`;
      const draftId = `drafts.${docId}`;

      const draftDocument = {
        ...document,
        _id: draftId
      };

      result = await client.createOrReplace(draftDocument);
      // Return the publishedId (without drafts. prefix) for scheduling
      returnedDocId = docId;
      console.log(`[Sanity] Created draft post: ${result._id} (publishedId: ${docId})`);
    }

    if (input.scheduledPublishAt) {
      console.log(`[Sanity] ⚠️ scheduledPublishAt was provided but IGNORED. Call schedulePost('${returnedDocId}', '${input.scheduledPublishAt}') to actually schedule!`);
    }

    return {
      documentId: returnedDocId,
      revision: result._rev,
      path: `/blog/${input.slug}`,
      status,
      scheduledFor: undefined  // Never return scheduledFor - must use schedulePost() separately
    };
  } catch (error) {
    console.error('[Sanity] Create post failed:', error);
    throw error;
  }
}

/**
 * Convert markdown content to Portable Text blocks.
 * Handles: headings, paragraphs, lists, tables, images, bold, italic, links.
 */
export function markdownToPortableText(
  markdown: string,
  images?: Record<string, { assetRef: string; alt: string; caption?: string }>
): unknown[] {
  const blocks: unknown[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    
    // Skip frontmatter
    if (i === 0 && line === '---') {
      while (i < lines.length && lines[++i] !== '---') {}
      i++;
      continue;
    }

    // Empty line - skip
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings (# ## ### etc)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      blocks.push(createTextBlock(text, `h${level}`));
      i++;
      continue;
    }

    // Images: ![alt](src)
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      const alt = imageMatch[1];
      const src = imageMatch[2];
      // Look for image in provided images map (key is the src/file path)
      if (images && images[src]) {
        // Use the assetRef from the images map, not the src path
        const imgData = images[src];
        blocks.push(createImageBlock(imgData.assetRef, imgData.alt || alt, imgData.caption));
      } else {
        // Create a placeholder - skip images without refs
        // (they would create invalid Sanity documents)
        console.warn(`[Sanity] Skipping image without asset ref: ${src}`);
      }
      i++;
      continue;
    }

    // Tables: | Header1 | Header2 | -> Convert to comparison list (Sanity doesn't support tables)
    if (line.trim().startsWith('|') && line.includes('|')) {
      const tableRows: string[][] = [];
      
      // Collect all table rows
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = lines[i];
        // Skip separator rows (|---|---|)
        if (!row.match(/^\|[\s-:|]+\|$/)) {
          const cells = row
            .split('|')
            .slice(1, -1) // Remove first and last empty entries
            .map(cell => cell.trim());
          if (cells.length > 0) {
            tableRows.push(cells);
          }
        }
        i++;
      }

      // Convert table to bullet list comparison format
      if (tableRows.length > 1) {
        const headers = tableRows[0];
        const dataRows = tableRows.slice(1);
        
        // Create bullet points for each comparison row
        dataRows.forEach(row => {
          // Format: "**RowLabel**: Col1 (value), Col2 (value), etc."
          const rowLabel = row[0];
          const comparisons = headers.slice(1).map((header, idx) => {
            const value = row[idx + 1] || '';
            return `${header}: ${value}`;
          }).join(' | ');
          
          blocks.push(createListItemBlock(`**${rowLabel}**: ${comparisons}`, 'bullet'));
        });
      }
      continue;
    }

    // Unordered lists: - item or * item
    if (line.match(/^[\s]*[-*]\s+/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^[\s]*[-*]\s+/)) {
        const itemText = lines[i].replace(/^[\s]*[-*]\s+/, '');
        listItems.push(itemText);
        i++;
      }
      listItems.forEach(item => {
        blocks.push(createListItemBlock(item, 'bullet'));
      });
      continue;
    }

    // Ordered lists: 1. item
    if (line.match(/^[\s]*\d+\.\s+/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^[\s]*\d+\.\s+/)) {
        const itemText = lines[i].replace(/^[\s]*\d+\.\s+/, '');
        listItems.push(itemText);
        i++;
      }
      listItems.forEach(item => {
        blocks.push(createListItemBlock(item, 'number'));
      });
      continue;
  }

    // Blockquote: > text
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      blocks.push(createTextBlock(quoteMatch[1], 'blockquote'));
      i++;
      continue;
    }

    // Regular paragraph - collect lines until empty line or special block
    let paragraphText = line;
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^!\[/) &&
      !lines[i].match(/^\|/) &&
      !lines[i].match(/^[\s]*[-*]\s+/) &&
      !lines[i].match(/^[\s]*\d+\.\s+/) &&
      !lines[i].match(/^>\s/)
    ) {
      paragraphText += ' ' + lines[i];
      i++;
    }

    blocks.push(createTextBlock(paragraphText.trim(), 'normal'));
  }

  return blocks;
}

/**
 * Create a text block with inline formatting support.
 */
function createTextBlock(text: string, style: string) {
  const { children, markDefs } = parseInlineFormatting(text);
  
  return {
    _type: 'block',
    _key: generateKey(),
    style,
    markDefs,
    children
  };
}

/**
 * Parse inline markdown formatting (bold, italic, links).
 */
function parseInlineFormatting(text: string): {
  children: unknown[];
  markDefs: unknown[];
} {
  const children: unknown[] = [];
  const markDefs: unknown[] = [];
  
  // Regex patterns for inline formatting
  // Match: **bold**, *italic*, [text](url)
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      if (beforeText) {
        children.push({
          _type: 'span',
          _key: generateKey(),
          text: beforeText,
          marks: []
        });
      }
    }

    if (match[2]) {
      // Bold: **text**
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: match[2],
        marks: ['strong']
      });
    } else if (match[3]) {
      // Italic: *text*
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: match[3],
        marks: ['em']
      });
    } else if (match[4] && match[5]) {
      // Link: [text](url)
      const linkKey = generateKey();
      markDefs.push({
        _type: 'link',
        _key: linkKey,
        href: match[5]
      });
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: match[4],
        marks: [linkKey]
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    children.push({
      _type: 'span',
      _key: generateKey(),
      text: text.slice(lastIndex),
      marks: []
    });
  }

  // If no children were added, add the whole text as plain
  if (children.length === 0) {
    children.push({
        _type: 'span',
        _key: generateKey(),
        text,
        marks: []
    });
  }

  return { children, markDefs };
}

/**
 * Create an image block.
 */
function createImageBlock(assetRef: string, alt: string, caption?: string) {
  return {
    _type: 'inlineImage',  // Sanity schema expects 'inlineImage' for body images
    _key: generateKey(),
    asset: {
      _type: 'reference',
      _ref: assetRef
    },
    alt,
    caption
  };
}

// Note: Tables are converted to bullet list comparisons since Sanity doesn't support table blocks

/**
 * Create a list item block.
 */
function createListItemBlock(text: string, listType: 'bullet' | 'number') {
  const { children, markDefs } = parseInlineFormatting(text);
  
  return {
    _type: 'block',
    _key: generateKey(),
    style: 'normal',
    listItem: listType,
    level: 1,
    markDefs,
    children
  };
}

function generateKey(): string {
  return Math.random().toString(36).substring(2, 10);
}
