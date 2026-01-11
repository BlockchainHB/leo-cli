---
description: "Use this skill when launching subagents, orchestrating parallel research, delegating tasks to specialists, or coordinating multi-step workflows. Triggers on: launch subagent, parallel research, delegate task, run workflow, coordinate agents."
---

# Subagent Orchestration

This skill provides patterns for launching and coordinating subagents. **Use the `Task` tool** to invoke subagents.

**Claude can launch up to 4 subagents in parallel.**

## CRITICAL: Read Configuration First

Before orchestrating any workflow, read `leo.config.json` to understand:
- Blog niche and target audience
- Available categories
- CMS provider (sanity or local)
- Queue provider (local or supabase)
- Image style preferences

## CRITICAL: Tool Access

| Agent | MCP Access | Tools |
|-------|------------|-------|
| **Leo (main agent)** | YES - MCP servers if configured | Read, Write, Edit, Bash, Grep, Glob, Task, MCP tools |
| **All subagents** | NO | Read, Write, Edit, Bash only |

**Subagents use CLI scripts via Bash:**
- Perplexity: `npx tsx src/cli/perplexity-search.ts "query"`
- Firecrawl: `npx tsx src/cli/firecrawl-scrape.ts "url"`

## Available Subagents (5 total)

| Subagent | Purpose | When to Use |
|----------|---------|-------------|
| `web-researcher` | Current info via Perplexity CLI | Phase 1 (parallel with SERP research) |
| `competitor-scraper` | Scrape competitor URLs via Firecrawl CLI | Phase 2 (after getting URLs) |
| `competitor-analyzer` | Analyze scraped content | Phase 3 (after scraping) |
| `content-writer` | Write the article | Phase 4 (after analysis) |
| `image-creator` | Image specs + metadata | Phase 5 (AFTER content-writer - reads draft for H2s) |

## Parallel Execution Pattern

**CRITICAL**: Only run subagents in parallel when they have NO dependencies on each other's output.
- ✅ web-researcher + SERP data fetch (both search independently)
- ❌ content-writer + image-creator (image-creator MUST read the draft first)

### Phase 1: Discovery (parallel tasks)

```typescript
// Launch in parallel - these don't depend on each other
Task({
  description: "Web research for topic",
  prompt: `Search for current information about [TOPIC]:
    - Recent statistics and trends
    - Industry news
    - Expert insights
    - Save to ./drafts/{slug}-research.json

    USE THIS COMMAND for all searches:
    npx tsx src/cli/perplexity-search.ts "query"`,
  subagent_type: "web-researcher"
});
```

### Phase 2: Scraping (after Phase 1)

```typescript
// Use URLs from SERP data or research
Task({
  description: "Scrape competitor content",
  prompt: `Scrape these competitor URLs:
    1. ${url1}
    2. ${url2}
    3. ${url3}

    Extract structure, headings, word count.
    Save to ./drafts/{slug}-scraped.json

    USE THIS COMMAND to scrape each URL:
    npx tsx src/cli/firecrawl-scrape.ts "URL"`,
  subagent_type: "competitor-scraper"
});
```

### Phase 3: Analysis (after Phase 2)

```typescript
Task({
  description: "Analyze competitor content",
  prompt: `Analyze the scraped content in ./drafts/{slug}-scraped.json:
    - Read leo.config.json for blog niche context
    - Identify patterns
    - Find gaps
    - Recommend article structure
    Save to ./drafts/{slug}-analysis.json

    Read the file first, then analyze.`,
  subagent_type: "competitor-analyzer"
});
```

### Phase 4: Content Writing (after Phase 3)

```typescript
// Write the article first - image-creator needs this to exist
Task({
  description: "Write blog post",
  prompt: `Write the blog post for "{keyword}" (TEXT ONLY):
    - Read leo.config.json for blog style and brand voice
    - Read research files in ./drafts/
    - NO image markdown - images handled separately
    - Save to ./drafts/{slug}.md

    ALWAYS read existing files before writing.`,
  subagent_type: "content-writer"
});
```

### Phase 5: Image Specs (after Phase 4 - MUST wait for draft)

**IMPORTANT**: image-creator MUST run AFTER content-writer because it reads the draft to find H2 headings.

```typescript
// Only run after content-writer completes - needs to read the draft
Task({
  description: "Create image specs",
  prompt: `Create image specifications based on the article:
    - Read leo.config.json for imageStyle preferences
    - READ ./drafts/{slug}.md FIRST
    - Find H2 headings to determine image placement
    - 1 hero image + 3-4 section images
    - Apply style from config (or defaults)
    - Save to ./drafts/{slug}-images.json`,
  subagent_type: "image-creator"
});
```

### Phase 6: Main Agent - Review, Generate & Publish (LEO does this)

**This is LEO's job. Do NOT delegate to a subagent.**

#### Step 1: Review draft quality (VERIFY ONLY - don't modify)
```bash
# Read and check the draft
cat ./drafts/{slug}.md | head -100
```
**VERIFY these exist (content-writer already added them):**
- NO em dashes (—)
- NO markdown tables
- Has 3-5 internal links (DO NOT add more - writer handles this)

If missing, ask content-writer to fix. Do NOT add links yourself during assembly.

#### Step 2: Generate images locally
```bash
npx tsx src/servers/images/generateImages.ts generate SLUG
```

Features:
- Pre-flight check validates API credits before starting
- Parallel generation with progress display
- Resume support if interrupted

#### Step 3: Publish to CMS

**For Sanity CMS:**
```bash
npx tsx src/servers/sanity/publishDraft.ts SLUG
```

This **ONE command** handles EVERYTHING:
1. Inserts image markdown into draft
2. Uploads hero image to Sanity
3. Uploads all section images to Sanity
4. Builds the bodyImages map automatically
5. Creates the post with all images properly linked

Options:
- `--dry-run` or `-n`: Preview without uploading
- `--publish` or `-p`: Publish immediately (default: draft)

**For Local Markdown:**
```bash
# Draft is already in ./drafts/{slug}.md
# Images are in ./images/{slug}/
# Copy to your content directory as needed
```

#### Step 4: Update keyword queue

**For local queue:**
```bash
npx tsx src/cli/queue.ts update SLUG drafted
```

**For Supabase queue (if configured):**
Use `mcp__supabase__execute_sql`:
```sql
UPDATE keyword_queue
SET status = 'drafted', sanity_id = 'DOC_ID', updated_at = NOW()
WHERE primary_keyword ILIKE '%keyword%';
```

#### Step 5: Schedule or Publish (optional)

**To schedule for future date (Sanity only):**
```bash
npx tsx -e "
import { schedulePost } from './src/servers/sanity/index.js';
schedulePost('DOCUMENT_ID', '2025-12-14T14:00:00.000Z', 'Article: TITLE')
  .then(r => console.log('SCHEDULED:', JSON.stringify(r, null, 2)));
"
```

**⚠️ NEVER pass `scheduledPublishAt` to createPost - it's ignored!**

#### Step 6: Present to user
```
✅ Draft ready! Document ID: {docId}
- To schedule: schedulePost('{docId}', 'YYYY-MM-DDTHH:mm:ss.000Z')
- To publish now: publishPost('{docId}')
```

## Complete Blog Workflow

```
┌─────────────────────────────────────────┐
│            PHASE 1: DISCOVER             │
│        (web-researcher + SERP)           │
│            [Run in parallel]             │
│  Uses: Perplexity CLI, DataForSEO        │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│            PHASE 2: SCRAPE               │
│         (competitor-scraper)             │
│      [Needs URLs from Phase 1]           │
│  Uses: Firecrawl CLI script              │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│            PHASE 3: ANALYZE              │
│        (competitor-analyzer)             │
│    [Needs scraped content from 2]        │
│  Uses: Read files only                   │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│            PHASE 4: WRITE                │
│          (content-writer)                │
│    [Needs analysis from Phase 3]         │
│   Output: {slug}.md                      │
│  Uses: Read/Write files                  │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│         PHASE 5: IMAGE SPECS             │
│          (image-creator)                 │
│  [MUST wait for draft from Phase 4]      │
│  Reads H2 headings from {slug}.md        │
│   Output: {slug}-images.json             │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│   PHASE 6: PUBLISH (Leo - Main Agent)    │
│                                          │
│  1. Review draft for quality             │
│  2. Generate images (ONE command)        │
│     npx tsx .../generateImages.ts SLUG   │
│  3. Publish to CMS (ONE command)         │
│     npx tsx .../publishDraft.ts SLUG     │
│  4. Update keyword queue                 │
│  5. Present to user for approval         │
│                                          │
│  Uses: CLI scripts, MCP if configured    │
└─────────────────────────────────────────┘
```

## Output Files Convention

All subagents save to `./drafts/{slug}-*.json`:

```
drafts/
├── {slug}-seo.json         # From SERP/keyword research
├── {slug}-research.json    # From web-researcher
├── {slug}-scraped.json     # From competitor-scraper
├── {slug}-analysis.json    # From competitor-analyzer
├── {slug}.md               # From content-writer
└── {slug}-images.json      # From image-creator
```

## Subagent Prompt Templates

### web-researcher

```
Research current information about "{topic}":

Use Perplexity CLI for all searches:
npx tsx src/cli/perplexity-search.ts "query"

1. Search: "{topic} statistics 2025"
2. Search: "common questions about {topic}"
3. Search: "{topic} trends recent"
4. Compile findings

Save to: ./drafts/{slug}-research.json
ALWAYS read existing file before writing.
```

### competitor-scraper

```
Scrape these competitor URLs:
1. {url1}
2. {url2}
3. {url3}

Use Firecrawl CLI for each URL:
npx tsx src/cli/firecrawl-scrape.ts "URL"

For each, extract:
- Title
- Headings structure (H1, H2, H3)
- Word count
- Key sections
- Has FAQ/tables/images

Save to: ./drafts/{slug}-scraped.json
ALWAYS read existing file before writing.
```

### competitor-analyzer

```
Analyze scraped content in ./drafts/{slug}-scraped.json:

1. READ leo.config.json for blog niche context
2. READ the scraped content file
3. Compare patterns across competitors
4. Identify strong points to emulate
5. Find gaps we can exploit
6. Recommend article structure

Save to: ./drafts/{slug}-analysis.json
ALWAYS read existing file before writing.
```

### content-writer

```
Write blog post for "{keyword}":

1. READ leo.config.json for blog style and settings
2. READ all research files in ./drafts/{slug}-*.json
3. Follow the brand voice from config
4. Include 3-5 internal links from config
5. No tables, use comparison lists
6. No em dashes

Save to: ./drafts/{slug}.md
ALWAYS read existing file before writing.
```

### image-creator

```
Create image specs for "{keyword}" blog:

1. READ leo.config.json for imageStyle preferences
2. READ ./drafts/{slug}.md
3. Create specs for 1 hero + 3-4 section images
4. Apply style from config (or defaults: pastel, light backgrounds)
5. Include alt text + captions

Save to: ./drafts/{slug}-images.json
ALWAYS read existing file before writing.
```

## Best Practices

1. **Read config first**: All subagents should read leo.config.json for context
2. **Max 4 parallel**: Don't launch more than 4 subagents at once
3. **Wait for dependencies**: Phase 2 needs Phase 1 output
4. **Single purpose**: Each subagent does ONE thing
5. **File communication**: Subagents share data via ./drafts/ files
6. **Update status**: Update queue between phases
7. **Include CLI commands**: Always tell subagents the exact command to use
8. **Read before write**: All agents must read files before writing
9. **image-creator runs LAST**: NEVER run image-creator in parallel with content-writer. It must read the completed draft to find H2 headings for image placement.
