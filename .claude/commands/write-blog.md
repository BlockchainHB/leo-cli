---
argument-hint: [keyword or "next"]
description: Research and write a complete blog post
allowed-tools: Read, Write, Edit, Bash, Agent
---

# Write Blog Post

Write a complete, SEO-optimized blog post using your configured settings from `leo.config.json`.

## First Step: Read Configuration

```bash
cat ./leo.config.json
```

Get the blog niche, brand voice, target audience, and other settings to personalize the content.

## Arguments

- If argument is "next" or empty: Get the next pending keyword from the queue
- Otherwise: Use the provided keyword as the topic

## Workflow

Execute these steps in order:

### 1. Get the Keyword

**For local queue (default):**
```bash
npx tsx src/cli/queue.ts next
```

**For Supabase queue (if configured in leo.config.json):**
Use MCP tool to query the keyword_queue table.

### 2. Research Phase (Parallel)

Invoke these subagents in parallel:

1. **web-researcher**: Search for current information, statistics, trends
2. **competitor-scraper**: Scrape top competitor URLs from SERP data

Wait for both to complete before proceeding.

### 3. Analysis Phase

Invoke **competitor-analyzer** with the scraped content:
- Analyze patterns across competitors
- Identify content gaps
- Recommend article structure

### 4. Content Creation

Invoke **content-writer** with the research context:
- Read leo.config.json for brand voice and style
- Use research data from previous phases
- Include internal links from config

### 5. Image Specs Generation

Invoke **image-creator** to create specs:
- Read leo.config.json for imageStyle preferences
- 1 hero image spec
- 3-4 section image specs based on content H2 headings
- Saves to `./drafts/{slug}-images.json`

### 6. Generate Images

**⚠️ ALWAYS USE THIS SCRIPT DIRECTLY - DO NOT TRY MODULE IMPORTS:**

```bash
npx tsx src/servers/images/generateImages.ts generate SLUG
```

**IMPORTANT**: Do NOT try to import the images module with `npx tsx -e`. Module imports fail due to .js extension issues. The script command above works reliably every time.

Features:
- Pre-flight check validates API credits before starting
- Parallel generation with progress display
- Resume support if interrupted

### 7. Save Draft

Save the complete draft to `./drafts/{slug}.md` with:
- Full article content
- Image references
- SEO metadata

### 8. Update Progress

```typescript
import * as fs from 'fs';

// Update blog-progress.json
const progress = JSON.parse(fs.readFileSync('./blog-progress.json', 'utf-8'));
progress.current_article = {
  keyword: keyword.keyword,
  status: 'ready_to_publish',
  draft_path: `./drafts/${slug}.md`,
  images_generated: images.length
};
progress.session_log.push({
  timestamp: new Date().toISOString(),
  action: `Completed draft for "${keyword.keyword}"`
});
fs.writeFileSync('./blog-progress.json', JSON.stringify(progress, null, 2));
```

### 9. Update Queue Status

**For local queue:**
```bash
npx tsx src/cli/queue.ts update SLUG drafted
```

**For Supabase queue:**
Use MCP tool to update status.

## Output

After completion, display:

```
Draft ready!

Keyword: [keyword]
Title: [title]
Word Count: [count]
Images: [count] generated at ./images/[slug]/
Draft: ./drafts/[slug].md

To publish to Sanity:
  npx tsx src/servers/sanity/publishDraft.ts [slug]

Or with dry-run first:
  npx tsx src/servers/sanity/publishDraft.ts [slug] --dry-run

For local markdown:
  Draft is ready at ./drafts/[slug].md
```
