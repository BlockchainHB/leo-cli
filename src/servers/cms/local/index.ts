/**
 * Local CMS Adapter
 *
 * Saves blog posts as markdown files with YAML frontmatter.
 * No external CMS required - works completely locally.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LocalPost {
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

export interface PostMetadata {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  heroImage?: string;
  heroImageAlt?: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const DRAFTS_DIR = 'drafts';
const PUBLISHED_DIR = 'published';

/**
 * Ensure directories exist
 */
function ensureDirectories(): void {
  const dirs = [DRAFTS_DIR, PUBLISHED_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Generate YAML frontmatter from post metadata
 */
function generateFrontmatter(metadata: PostMetadata): string {
  const lines = ['---'];

  lines.push(`title: "${metadata.title.replace(/"/g, '\\"')}"`);
  lines.push(`slug: "${metadata.slug}"`);
  lines.push(`excerpt: "${metadata.excerpt.replace(/"/g, '\\"')}"`);
  lines.push(`category: "${metadata.category}"`);
  lines.push(`author: "${metadata.author}"`);
  lines.push(`seoTitle: "${metadata.seoTitle.replace(/"/g, '\\"')}"`);
  lines.push(`seoDescription: "${metadata.seoDescription.replace(/"/g, '\\"')}"`);

  if (metadata.heroImage) {
    lines.push(`heroImage: "${metadata.heroImage}"`);
  }
  if (metadata.heroImageAlt) {
    lines.push(`heroImageAlt: "${metadata.heroImageAlt.replace(/"/g, '\\"')}"`);
  }

  lines.push(`status: "${metadata.status}"`);

  if (metadata.publishedAt) {
    lines.push(`publishedAt: "${metadata.publishedAt}"`);
  }

  lines.push(`createdAt: "${metadata.createdAt}"`);
  lines.push(`updatedAt: "${metadata.updatedAt}"`);

  lines.push('---');

  return lines.join('\n');
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { metadata: PostMetadata; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error('Invalid frontmatter format');
  }

  const frontmatter = match[1];
  const body = match[2];

  const metadata: Partial<PostMetadata> = {};

  // Parse YAML-like frontmatter
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      }

      (metadata as Record<string, string>)[key] = value;
    }
  }

  return {
    metadata: metadata as PostMetadata,
    body: body.trim()
  };
}

/**
 * Create a new blog post
 */
export async function createPost(input: CreatePostInput): Promise<{
  path: string;
  status: 'draft' | 'published';
  slug: string;
}> {
  ensureDirectories();

  const now = new Date().toISOString();
  const status = input.publish ? 'published' : 'draft';
  const dir = input.publish ? PUBLISHED_DIR : DRAFTS_DIR;

  const metadata: PostMetadata = {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    category: input.category,
    author: input.author,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    heroImage: input.heroImage,
    heroImageAlt: input.heroImageAlt,
    status,
    publishedAt: input.publish ? now : undefined,
    createdAt: now,
    updatedAt: now
  };

  const frontmatter = generateFrontmatter(metadata);
  const content = `${frontmatter}\n\n${input.body}`;

  const filePath = path.join(dir, `${input.slug}.md`);
  fs.writeFileSync(filePath, content);

  console.log(`[LocalCMS] Created ${status}: ${filePath}`);

  return {
    path: filePath,
    status,
    slug: input.slug
  };
}

/**
 * Read a post by slug
 */
export async function getPost(slug: string): Promise<LocalPost | null> {
  // Check drafts first, then published
  const draftPath = path.join(DRAFTS_DIR, `${slug}.md`);
  const publishedPath = path.join(PUBLISHED_DIR, `${slug}.md`);

  let filePath: string | null = null;

  if (fs.existsSync(draftPath)) {
    filePath = draftPath;
  } else if (fs.existsSync(publishedPath)) {
    filePath = publishedPath;
  }

  if (!filePath) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const { metadata, body } = parseFrontmatter(content);

  return {
    ...metadata,
    body
  };
}

/**
 * Publish a draft post
 */
export async function publishPost(slug: string): Promise<{
  path: string;
  status: 'published';
  publishedAt: string;
}> {
  const draftPath = path.join(DRAFTS_DIR, `${slug}.md`);

  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft not found: ${slug}`);
  }

  const content = fs.readFileSync(draftPath, 'utf-8');
  const { metadata, body } = parseFrontmatter(content);

  const now = new Date().toISOString();
  metadata.status = 'published';
  metadata.publishedAt = now;
  metadata.updatedAt = now;

  const frontmatter = generateFrontmatter(metadata);
  const newContent = `${frontmatter}\n\n${body}`;

  const publishedPath = path.join(PUBLISHED_DIR, `${slug}.md`);
  fs.writeFileSync(publishedPath, newContent);

  // Remove draft
  fs.unlinkSync(draftPath);

  console.log(`[LocalCMS] Published: ${publishedPath}`);

  return {
    path: publishedPath,
    status: 'published',
    publishedAt: now
  };
}

/**
 * Update an existing post
 */
export async function updatePost(
  slug: string,
  updates: Partial<CreatePostInput>
): Promise<{ path: string; updatedAt: string }> {
  const post = await getPost(slug);

  if (!post) {
    throw new Error(`Post not found: ${slug}`);
  }

  const dir = post.status === 'published' ? PUBLISHED_DIR : DRAFTS_DIR;
  const filePath = path.join(dir, `${slug}.md`);

  const now = new Date().toISOString();

  const metadata: PostMetadata = {
    title: updates.title || post.title,
    slug: post.slug,
    excerpt: updates.excerpt || post.excerpt,
    category: updates.category || post.category,
    author: updates.author || post.author,
    seoTitle: updates.seoTitle || post.seoTitle,
    seoDescription: updates.seoDescription || post.seoDescription,
    heroImage: updates.heroImage || post.heroImage,
    heroImageAlt: updates.heroImageAlt || post.heroImageAlt,
    status: post.status,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: now
  };

  const frontmatter = generateFrontmatter(metadata);
  const body = updates.body || post.body;
  const content = `${frontmatter}\n\n${body}`;

  fs.writeFileSync(filePath, content);

  console.log(`[LocalCMS] Updated: ${filePath}`);

  return {
    path: filePath,
    updatedAt: now
  };
}

/**
 * List all posts
 */
export async function listPosts(options: {
  status?: 'draft' | 'published';
  limit?: number;
} = {}): Promise<PostMetadata[]> {
  ensureDirectories();

  const posts: PostMetadata[] = [];

  const dirs = options.status
    ? [options.status === 'draft' ? DRAFTS_DIR : PUBLISHED_DIR]
    : [DRAFTS_DIR, PUBLISHED_DIR];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      try {
        const { metadata } = parseFrontmatter(content);
        posts.push(metadata);
      } catch {
        console.warn(`[LocalCMS] Could not parse: ${file}`);
      }
    }
  }

  // Sort by updatedAt descending
  posts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (options.limit) {
    return posts.slice(0, options.limit);
  }

  return posts;
}

/**
 * Delete a post
 */
export async function deletePost(slug: string): Promise<boolean> {
  const draftPath = path.join(DRAFTS_DIR, `${slug}.md`);
  const publishedPath = path.join(PUBLISHED_DIR, `${slug}.md`);

  let deleted = false;

  if (fs.existsSync(draftPath)) {
    fs.unlinkSync(draftPath);
    deleted = true;
    console.log(`[LocalCMS] Deleted draft: ${slug}`);
  }

  if (fs.existsSync(publishedPath)) {
    fs.unlinkSync(publishedPath);
    deleted = true;
    console.log(`[LocalCMS] Deleted published: ${slug}`);
  }

  return deleted;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'list':
      listPosts({ status: arg as 'draft' | 'published' }).then(posts => {
        console.log(JSON.stringify(posts, null, 2));
      });
      break;

    case 'get':
      if (!arg) {
        console.error('Usage: local-cms get <slug>');
        process.exit(1);
      }
      getPost(arg).then(post => {
        if (post) {
          console.log(JSON.stringify(post, null, 2));
        } else {
          console.log('Post not found');
        }
      });
      break;

    case 'publish':
      if (!arg) {
        console.error('Usage: local-cms publish <slug>');
        process.exit(1);
      }
      publishPost(arg).then(result => {
        console.log('Published:', result);
      });
      break;

    default:
      console.log(`
Local CMS CLI

Commands:
  list [draft|published]   List posts
  get <slug>               Get a post
  publish <slug>           Publish a draft

Example:
  npx tsx src/servers/cms/local/index.ts list draft
  npx tsx src/servers/cms/local/index.ts publish my-post
`);
  }
}
