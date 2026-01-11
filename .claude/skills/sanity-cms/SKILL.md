---
description: "Use this skill when creating, publishing, scheduling, or managing blog posts in Sanity CMS. Triggers on: publish post, schedule post, upload image to Sanity, create Sanity document, manage CMS content."
---

# Sanity CMS Operations

## CRITICAL: Read Configuration First

Before any CMS operation, read `leo.config.json` to get:
- `cms.sanity.projectId` - Sanity project ID
- `cms.sanity.dataset` - Dataset (usually "production")
- `categories` - Available categories and their IDs
- `author` - Author information

## THE ONE COMMAND: publishDraftToSanity

**After writing a blog post and generating images, this is ALL you need:**

```bash
npx tsx src/servers/sanity/publishDraft.ts SLUG_HERE
```

This ONE command handles EVERYTHING:
1. Reads draft markdown and image specs
2. Inserts image markdown into draft (if not already done)
3. Uploads hero image to Sanity
4. Uploads all section images to Sanity
5. Builds the bodyImages map automatically
6. Creates the post as a draft in Sanity with all images properly linked

**Options:**
- `--dry-run` or `-n`: Preview without uploading or creating
- `--publish` or `-p`: Publish immediately (default: create as draft)

**Prerequisites:**
1. Draft exists: `./drafts/{slug}.md`
2. Image specs exist: `./drafts/{slug}-images.json` (or `-v2.json`)
3. Images generated: `./images/{slug}/*.png`

**Example workflow:**
```bash
# 1. Generate images (after content-writer + image-creator)
npx tsx src/servers/images/generateImages.ts generate SLUG

# 2. Publish to Sanity (ONE COMMAND does everything!)
npx tsx src/servers/sanity/publishDraft.ts SLUG

# Or preview first:
npx tsx src/servers/sanity/publishDraft.ts SLUG --dry-run
```

---

## Function Signatures (CRITICAL - Use Exact Field Names)

### uploadImage(input)

```typescript
interface UploadImageInput {
  filename: string;       // REQUIRED - e.g., 'hero.png'
  altText: string;        // REQUIRED - e.g., 'Product showcase'
  filePath?: string;      // Use this OR base64
  base64?: string;        // Use this OR filePath
}

// Returns:
interface UploadImageResponse {
  assetId: string;        // Full asset ID
  assetRef: string;       // Use THIS in createPost heroImageRef
  url: string;            // CDN URL
  altText: string;
}
```

### createPost(input)

```typescript
interface CreatePostInput {
  title: string;              // REQUIRED
  slug: string;               // REQUIRED
  excerpt: string;            // REQUIRED
  body: string;               // REQUIRED - markdown content
  heroImageRef: string;       // REQUIRED - must start with "image-"
  heroImageAlt: string;       // REQUIRED
  categoryRefs: string[];     // REQUIRED - array of category IDs from config
  authorRef?: string;         // Optional (from config author.id)
  seoTitle: string;           // REQUIRED
  seoDescription: string;     // REQUIRED
  publish?: boolean;          // Optional (default: false = draft)
  scheduledPublishAt?: string;// Optional - ISO date for scheduling
  bodyImages?: Record<string, {assetRef: string; alt: string; caption?: string}>;
}
```

**Common Mistakes:**
- ❌ `heroImage` → ✅ `heroImageRef`
- ❌ `category` → ✅ `categoryRefs` (array!)
- ❌ `content` → ✅ `body`
- ❌ Using `node -e` → ✅ Use `npx tsx -e`

---

## Workflow: Schedule a Post

When user says `/schedule [slug] [date]`:

### Step 1: Check if post exists in Sanity

```bash
npx tsx -e "
import { queryPosts } from './src/servers/sanity/index.js';
queryPosts({ status: 'draft' }).then(posts => {
  const post = posts.find(p => p.slug === 'SLUG_HERE');
  if (post) {
    console.log('FOUND:', JSON.stringify(post));
  } else {
    console.log('NOT_FOUND');
  }
});
"
```

### Step 2a: If NOT_FOUND, create the post first

1. Read the draft: `./drafts/{slug}.md`
2. Read image metadata: `./drafts/{slug}-images.json` (create if missing)
3. Read leo.config.json for categories and author
4. Upload hero image
5. Create post in Sanity

```bash
npx tsx -e "
import * as fs from 'fs';
import { createPost, uploadImage } from './src/servers/sanity/index.js';

// Read configuration
const config = JSON.parse(fs.readFileSync('./leo.config.json', 'utf-8'));
const markdown = fs.readFileSync('./drafts/SLUG.md', 'utf-8');

// Extract title from markdown
const titleMatch = markdown.match(/^#\\s+(.+)$/m);
const title = titleMatch ? titleMatch[1] : 'Untitled';

// Get first category from config (adjust based on content)
const categoryId = config.categories[0]?.id || config.categories[0]?.slug;

createPost({
  title: title,
  slug: 'SLUG',
  excerpt: 'EXCERPT_HERE',
  body: markdown,
  heroImageRef: 'IMAGE_REF_OR_PLACEHOLDER',
  heroImageAlt: 'ALT_TEXT',
  categoryRefs: [categoryId],
  authorRef: config.author?.id,
  seoTitle: title + ' | ' + config.blog.name,
  seoDescription: 'EXCERPT_HERE',
  publish: false
}).then(result => console.log('CREATED:', JSON.stringify(result)));
"
```

### Step 2b: If FOUND, schedule it

```bash
npx tsx -e "
import { schedulePost } from './src/servers/sanity/index.js';

schedulePost(
  'DOCUMENT_ID',
  '2025-12-08T14:00:00.000Z',
  'Scheduled: Article Title'
).then(result => console.log('SCHEDULED:', JSON.stringify(result)));
"
```

### Step 3: Update keyword queue

If using Supabase queue (check `leo.config.json` for queue.provider):

```sql
UPDATE keyword_queue
SET status = 'scheduled',
    sanity_id = 'SANITY_DOC_ID',
    scheduled_at = '2025-12-08T14:00:00.000Z',
    updated_at = NOW()
WHERE primary_keyword ILIKE '%keyword%';
```

If using local queue, update `./keyword-queue.json`.

---

## Workflow: Publish a Post Immediately

### Step 1: Find the draft in Sanity

```bash
npx tsx -e "
import { queryPosts } from './src/servers/sanity/index.js';
queryPosts({ status: 'draft' }).then(posts => console.log(JSON.stringify(posts, null, 2)));
"
```

### Step 2: Publish it

```bash
npx tsx -e "
import { publishPost } from './src/servers/sanity/index.js';
publishPost({ documentId: 'DOC_ID' }).then(r => console.log(JSON.stringify(r)));
"
```

### Step 3: Update queue status

Update the keyword queue (local JSON or Supabase) to status = 'published'.

---

## Workflow: Create a New Post with Images

**CRITICAL: Upload ALL images to Sanity FIRST, then create post with asset IDs.**

### Step 1: Read draft, image specs, and config

```javascript
const draft = await Read('./drafts/{slug}.md');
const imageSpecs = JSON.parse(await Read('./drafts/{slug}-images.json'));
const config = JSON.parse(await Read('./leo.config.json'));
```

### Step 2: Upload ALL images to Sanity (hero + body images)

```bash
npx tsx -e "
import { uploadImage } from './src/servers/sanity/index.js';

async function uploadAll() {
  // Upload hero image (from file path OR base64)
  const hero = await uploadImage({
    filePath: './images/SLUG/hero.png',  // OR use base64: 'base64data...'
    filename: 'hero.png',
    altText: 'Hero alt text here'
  });
  console.log('HERO_ASSET:', hero.assetRef);

  // Upload section images
  const section1 = await uploadImage({
    filePath: './images/SLUG/section-1.png',
    filename: 'section-1.png',
    altText: 'Section 1 alt text'
  });
  console.log('SECTION1_ASSET:', section1.assetRef);

  // Return all asset refs
  return {
    hero: hero.assetRef,
    section1: section1.assetRef
  };
}
uploadAll().then(r => console.log('ALL_ASSETS:', JSON.stringify(r)));
"
```

**Output example:**
```
HERO_ASSET: image-abc123-1920x1080-png
SECTION1_ASSET: image-def456-800x600-png
ALL_ASSETS: {"hero":"image-abc123-1920x1080-png","section1":"image-def456-800x600-png"}
```

### Step 3: Create post with uploaded asset IDs

Now pass the asset IDs to createPost. The `bodyImages` map links markdown image paths to Sanity asset refs.

```bash
npx tsx -e "
import * as fs from 'fs';
import { createPost } from './src/servers/sanity/index.js';

const config = JSON.parse(fs.readFileSync('./leo.config.json', 'utf-8'));
const markdown = fs.readFileSync('./drafts/SLUG.md', 'utf-8');

// Map markdown image paths → Sanity asset refs
const bodyImages = {
  './images/SLUG/section-1.png': {
    assetRef: 'image-def456-800x600-png',  // From Step 2
    alt: 'Section 1 description',
    caption: 'Caption for readers'
  },
  './images/SLUG/section-2.png': {
    assetRef: 'image-ghi789-800x600-png',
    alt: 'Section 2 description',
    caption: 'Another caption'
  }
};

createPost({
  title: 'TITLE',
  slug: 'SLUG',
  excerpt: 'EXCERPT',
  body: markdown,
  heroImageRef: 'image-abc123-1920x1080-png',  // From Step 2
  heroImageAlt: 'Hero alt text here',
  categoryRefs: [config.categories[0]?.id],
  authorRef: config.author?.id,
  seoTitle: 'TITLE | ' + config.blog.name,
  seoDescription: 'EXCERPT',
  bodyImages: bodyImages,  // CRITICAL: Pass this for inline images!
  publish: false
}).then(r => console.log('CREATED:', JSON.stringify(r)));
"
```

### Step 4: Update queue status to 'drafted'

Update local queue or Supabase depending on configuration.

---

## Image Workflow Summary (NOW JUST 2 COMMANDS!)

```
1. image-creator subagent → ./drafts/{slug}-images.json
   - specs with "placement": "After H2: [EXACT H2 TEXT]" or "after-h2" with heading field

2. Generate images locally (ONE command)
   npx tsx src/servers/images/generateImages.ts generate SLUG
   → ./images/{slug}/*.png

3. Publish to Sanity (ONE command - handles EVERYTHING)
   npx tsx src/servers/sanity/publishDraft.ts SLUG
   → Inserts markdown, uploads images, builds bodyImages, creates post
```

**The old manual steps (insertImagesIntoDraft, uploadImage, buildBodyImagesMap, createPost) are now ALL handled by `publishDraft.ts`!**

---

## Reference: Categories

Categories are defined in `leo.config.json`. Read the config to get category IDs/slugs.

Example config structure:
```json
{
  "categories": [
    { "slug": "tutorials", "name": "Tutorials", "id": "uuid-here" },
    { "slug": "guides", "name": "Guides", "id": "uuid-here" }
  ]
}
```

## Reference: Author

Author information is in `leo.config.json`:

```json
{
  "author": {
    "name": "Your Name",
    "id": "author-uuid-here"
  }
}
```

## Reference: Date Format

All dates must be UTC with Z suffix: `YYYY-MM-DDTHH:mm:ss.sssZ`

Example conversions:
- "Dec 8, 2025 9am EST" → `2025-12-08T14:00:00.000Z` (EST is UTC-5)
- "Dec 8, 2025 9am PST" → `2025-12-08T17:00:00.000Z` (PST is UTC-8)

## Important Rules

1. **Always read leo.config.json first** - Get categories, author, blog settings
2. **Always use `npx tsx`** - Never use `node` with `./dist/` (may be stale)
3. **Update queue after any Sanity operation** - Local JSON or Supabase
4. **One category per post** - Pick the most relevant one from config
5. **Scheduling date must match publishedAt** - When scheduling, the `scheduledPublishAt` date passed to `createPost()` MUST be the same as the schedule date. If they don't match, the post goes live immediately AND gets scheduled. Always use `publish: false` when scheduling.

## CRITICAL: Scheduling Posts (TWO-STEP PROCESS!)

**⚠️ WARNING: `scheduledPublishAt` in createPost is IGNORED! You MUST call schedulePost() separately!**

Setting `publishedAt` to a future date does NOT schedule the post - it just puts a date field in the document. The document is STILL VISIBLE to queries!

### Correct Workflow:

```javascript
// Step 1: Create as DRAFT (no publishedAt)
const result = await createPost({
  // ... other fields
  publish: false  // Creates draft with NO publishedAt
});
console.log('Draft created:', result.documentId);

// Step 2: Schedule using Sanity Scheduling API
await schedulePost(result.documentId, '2025-12-08T14:00:00.000Z', 'My Article');
console.log('Scheduled for publication');
```

### Common Mistakes:
- ❌ `createPost({ scheduledPublishAt: '...' })` - This is IGNORED!
- ❌ `createPost({ publish: true })` - Publishes IMMEDIATELY
- ❌ Setting `publishedAt` to future date - Post still appears in queries!
- ✅ `createPost({ publish: false })` then `schedulePost(docId, date)` - Correct!

---

## Complete Copy-Paste Example: Create Draft

**Upload hero + create draft post:**

```bash
npx tsx -e "
import * as fs from 'fs';
import { uploadImage, createPost } from './src/servers/sanity/index.js';

const SLUG = 'your-slug-here';

// Read configuration
const config = JSON.parse(fs.readFileSync('./leo.config.json', 'utf-8'));

async function createBlogPost() {
  // 1. Upload hero image
  const hero = await uploadImage({
    filePath: './images/' + SLUG + '/hero.png',
    filename: 'hero.png',
    altText: 'Your hero alt text here'
  });
  console.log('HERO_REF:', hero.assetRef);

  // 2. Read markdown
  const markdown = fs.readFileSync('./drafts/' + SLUG + '.md', 'utf-8');

  // 3. Create post as DRAFT (publish: false means NO publishedAt)
  const result = await createPost({
    title: 'Your Title Here',
    slug: SLUG,
    excerpt: 'Your 2-3 sentence excerpt here.',
    body: markdown,
    heroImageRef: hero.assetRef,
    heroImageAlt: 'Your hero alt text here',
    categoryRefs: [config.categories[0]?.id],
    authorRef: config.author?.id,
    seoTitle: 'Your Title | ' + config.blog.name,
    seoDescription: 'Your meta description here (150-160 chars)',
    publish: false  // MUST be false for drafts/scheduling
  });

  console.log('CREATED:', JSON.stringify(result, null, 2));
  console.log('\\nDocument ID for scheduling:', result.documentId);
}

createBlogPost();
"
```

## Complete Copy-Paste Example: Schedule Post

**After creating a draft, schedule it for future publication:**

```bash
npx tsx -e "
import { schedulePost } from './src/servers/sanity/index.js';

// Use the documentId from createPost result
const DOCUMENT_ID = 'YOUR_DOCUMENT_ID_HERE';
const SCHEDULE_DATE = '2025-12-14T14:00:00.000Z';  // UTC!

schedulePost(DOCUMENT_ID, SCHEDULE_DATE, 'Scheduled: Article Title')
  .then(result => {
    console.log('SCHEDULED:', JSON.stringify(result, null, 2));
  });
"
```

**Replace these values:**
- `SLUG` - your article slug
- `DOCUMENT_ID` - the documentId returned from createPost
- `SCHEDULE_DATE` - UTC date (EST+5, PST+8)
- Categories come from `leo.config.json`
