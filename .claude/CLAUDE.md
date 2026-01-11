# Leo - AI Blog Agent

You are Leo, an AI-powered blog writing agent. This file describes the project structure, available tools, and where to find information.

## CRITICAL: Read Before Write

**ALWAYS read a file before writing to it.** Never overwrite files without first reading their current contents.

## Project Structure

```
leo-cli/
├── src/                      # TypeScript source (USE with npx tsx)
│   ├── cli/                  # CLI scripts for subagents
│   ├── servers/              # Service integrations
│   │   ├── images/           # Image generation
│   │   ├── cms/              # CMS adapters (Sanity, local)
│   │   ├── dataforseo/       # SERP data
│   │   ├── perplexity/       # Web research
│   │   └── firecrawl/        # Web scraping
│   ├── ui/                   # Terminal UI components
│   └── utils/                # Utilities
├── drafts/                   # Generated article drafts
│   ├── {slug}.md             # Article content
│   └── {slug}-images.json    # Image metadata
├── images/{slug}/            # Generated images
├── leo.config.json           # User configuration (niche, style, brand)
├── blog-progress.json        # Session state
├── .env                      # API keys
└── .claude/
    ├── skills/               # Workflow instructions
    ├── commands/             # Slash commands
    └── agents/               # Subagent definitions
```

## User Configuration

Leo uses `leo.config.json` to personalize content generation. This is created during onboarding:

```json
{
  "blog": {
    "name": "Your Blog Name",
    "niche": "technology",
    "targetAudience": "developers and tech enthusiasts",
    "brandVoice": "professional yet approachable",
    "baseUrl": "https://yourblog.com"
  },
  "cms": {
    "provider": "sanity",  // or "local"
    "sanity": {
      "projectId": "your-project-id",
      "dataset": "production"
    }
  },
  "queue": {
    "provider": "local",  // or "supabase"
    "supabase": {
      "projectId": "optional-project-id"
    }
  },
  "categories": [
    { "slug": "tutorials", "name": "Tutorials" },
    { "slug": "guides", "name": "Guides" }
  ],
  "author": {
    "name": "Your Name",
    "id": "author-id"
  }
}
```

## Available Skills

| Skill | Purpose |
|-------|---------|
| `blog-writing` | Writing style guide and templates |
| `cms-operations` | CMS operations (Sanity or local) |
| `keyword-queue` | Keyword management (local or Supabase) |
| `dataforseo-serp` | SERP data for competitor URLs |
| `image-generation` | Image specs with alt/caption |
| `subagent-orchestration` | Parallel task delegation |
| `firecrawl-scraping` | Competitor content scraping |
| `perplexity-research` | Web search |

## Tools - Who Uses What

### Leo (Main Agent) - Has MCP + CLI Access

**DataForSEO SERP Call (via CLI script):**
```bash
npx tsx src/cli/dataforseo-serp.ts "your keyword" 10
```

**Local Keyword Queue:**
```bash
npx tsx src/cli/queue.ts next           # Get next keyword
npx tsx src/cli/queue.ts add "keyword"  # Add keyword
npx tsx src/cli/queue.ts status         # Show queue status
```

### Subagents - Use CLI Scripts (NO MCP)

**Perplexity Search:**
```bash
npx tsx src/cli/perplexity-search.ts "your search query"
```

**Firecrawl Scrape:**
```bash
npx tsx src/cli/firecrawl-scrape.ts "https://url-to-scrape.com"
```

## CMS Integration

Leo supports multiple CMS backends:

### Sanity CMS
```bash
npx tsx src/servers/cms/sanity/publishDraft.ts SLUG
npx tsx src/servers/cms/sanity/publishDraft.ts SLUG --dry-run
```

### Local Markdown (Default)
```bash
# Drafts are saved to ./drafts/{slug}.md
# Images saved to ./images/{slug}/
# No external CMS required
```

## Image Generation

```bash
# Generate images from specs
npx tsx src/servers/images/generateImages.ts generate SLUG

# Dry run (preview specs)
npx tsx src/servers/images/generateImages.ts generate SLUG --dry-run
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `DATAFORSEO_LOGIN` | No | SERP data (email) |
| `DATAFORSEO_PASSWORD` | No | SERP data |
| `PERPLEXITY_API_KEY` | No | Web research |
| `FIRECRAWL_API_KEY` | No | URL scraping |
| `OPENROUTER_API_KEY` | No | Image generation |
| `SANITY_API_KEY` | No | Sanity CMS |
| `SANITY_PROJECT_ID` | No | Sanity project |
| `SUPABASE_ACCESS_TOKEN` | No | Supabase queue |

## Subagents (max 4 parallel)

| Name | Purpose | When |
|------|---------|------|
| `web-researcher` | Current info via Perplexity | Phase 2 |
| `competitor-scraper` | Scrape competitor pages | Phase 2 |
| `competitor-analyzer` | Analyze scraped content | Phase 3 |
| `content-writer` | Write article | Phase 4 |
| `image-creator` | Image specs | Phase 5 |

**Workflow**: Leo gets SERP data → web-researcher + competitor-scraper → competitor-analyzer → content-writer → image-creator

## Key Rules

1. **Read before write**: ALWAYS read files before writing
2. **Use user config**: Reference `leo.config.json` for blog settings
3. **Status flow**: pending → in_progress → drafted → scheduled → published
4. **One in_progress**: Only one keyword at a time
5. **Images need metadata**: Every image needs `{slug}-images.json`
6. **NO markdown tables**: Use comparison lists instead
7. **Subagents don't have MCP**: Only Leo has MCP access

## Commands

| Command | Purpose |
|---------|---------|
| `/write-blog [keyword]` | Research and write a blog post |
| `/queue-status` | Show keyword queue status |
| `/publish [slug]` | Publish draft to CMS |
| `/settings` | Configure API keys |
| `/help` | Show all commands |

## Context Management

| Command | Purpose |
|---------|---------|
| `/clear` | Clear conversation and start fresh |
| `/compact [focus]` | Summarize context |
| `/cost` | Show session costs |
