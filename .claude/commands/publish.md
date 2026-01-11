---
argument-hint: [slug]
description: Publish a draft blog post to Sanity CMS
allowed-tools: Read, Write, Bash
---

# Publish to Sanity

Publish a completed draft to Sanity CMS and update the keyword queue.

## Arguments

- `slug`: The slug of the draft to publish (e.g., "my-blog-post")

## The ONE Command

After images are generated, use this single command:

```bash
npx tsx src/servers/sanity/publishDraft.ts SLUG_HERE
```

This handles EVERYTHING:
1. ✅ Inserts image markdown into draft
2. ✅ Uploads hero image to Sanity
3. ✅ Uploads all section images to Sanity
4. ✅ Builds the bodyImages map
5. ✅ Creates the post as a draft with all images linked

Options:
- `--dry-run` or `-n`: Preview without uploading
- `--publish` or `-p`: Publish immediately (default: draft)

## Workflow

### 1. Verify prerequisites

Before running:
```bash
# Check draft exists
ls ./drafts/SLUG.md

# Check image specs exist
ls ./drafts/SLUG-images*.json

# Check images are generated
ls ./images/SLUG/
```

### 2. Dry run first (recommended)

```bash
npx tsx src/servers/sanity/publishDraft.ts SLUG --dry-run
```

This shows what would be uploaded without making any changes.

### 3. Create draft in Sanity

```bash
npx tsx src/servers/sanity/publishDraft.ts SLUG
```

Returns a document ID like: `drafts.post-abc123`

### 4. Update Supabase queue

After successful publish, update the keyword queue:

```sql
UPDATE keyword_queue
SET status = 'drafted',
    sanity_id = 'DOC_ID_FROM_STEP_3',
    updated_at = NOW()
WHERE primary_keyword ILIKE '%keyword%';
```

### 5. Optional: Schedule for future publication

If scheduling (not publishing immediately):

```bash
npx tsx -e "
import { schedulePost } from './src/servers/sanity/index.js';
schedulePost('DOCUMENT_ID', '2025-12-14T14:00:00.000Z', 'Article Title')
  .then(r => console.log('SCHEDULED:', JSON.stringify(r)));
"
```

Then update Supabase:
```sql
UPDATE keyword_queue
SET status = 'scheduled',
    scheduled_at = '2025-12-14T14:00:00.000Z',
    updated_at = NOW()
WHERE sanity_id = 'DOC_ID';
```

## Output

```
════════════════════════════════════════════════════════════
📤 PUBLISH DRAFT TO SANITY: [slug]
════════════════════════════════════════════════════════════

📁 Step 1: Locating files...
  ✅ Draft: ./drafts/[slug].md
  ✅ Specs: ./drafts/[slug]-images-v2.json
  ✅ Images: ./images/[slug]

📖 Step 2: Reading files...
  ✅ Title: [title]
  ✅ Slug: [slug]
  ✅ Hero + [N] section images

🖼️  Step 3: Inserting images into draft...
  ✅ Inserted [N] images

☁️  Step 4: Uploading hero image...
  ✅ Hero uploaded: image-abc123...

☁️  Step 5: Uploading section images...
  ✅ [1/N] filename.png
  ...

🗺️  Step 6: Building bodyImages map...
  ✅ Map has [N] entries

📝 Step 7: Creating post in Sanity...
  ✅ Draft created: drafts.post-abc123

════════════════════════════════════════════════════════════
✅ SUCCESS: [slug]
════════════════════════════════════════════════════════════
  Document ID: drafts.post-abc123
  Status: DRAFT

Next: Run /schedule [slug] [date] to schedule publication
```

