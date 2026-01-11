---
description: "Use this skill for SERP analysis. LEO ONLY - subagents cannot use Ahrefs MCP. Triggers on: SERP analysis, top ranking pages, competitor URLs."
---

# Ahrefs SEO Research (LEO ONLY)

**IMPORTANT**: Only Leo (the main agent) can use Ahrefs MCP. Subagents DO NOT have access.

## Available Tool

Leo can use:
- `mcp__ahrefs__serp-overview-serp-overview` - Analyze top-ranking pages for a keyword

## SERP Analysis - EXACT FORMAT REQUIRED

Get top-ranking URLs for competitor research. **ALL 4 PARAMETERS ARE REQUIRED**:

```
mcp__ahrefs__serp-overview-serp-overview({
  "keyword": "your target keyword",
  "country": "us",
  "select": "position,url,title,domain_rating,traffic,backlinks,keywords",
  "top_positions": 10
})
```

### Parameters (ALL REQUIRED):
- `keyword` (string): The search keyword
- `country` (string): Two-letter country code, use "us"
- `select` (string): Columns to return - ALWAYS use: "position,url,title,domain_rating,traffic,backlinks,keywords"
- `top_positions` (integer): Number of results - use 10

### Response Format:
```json
{
  "positions": [
    {
      "position": 1,
      "url": "https://example.com/article",
      "title": "Article Title",
      "domain_rating": 52.0,
      "traffic": 2713,
      "backlinks": 508,
      "keywords": 47
    }
  ]
}
```

## What Leo Gets from SERP

- Top ranking URLs (extract from positions[].url)
- Page titles
- Domain ratings
- Traffic estimates
- Backlink counts

## Workflow

1. **Leo** queries Supabase for keyword data
2. **Leo** runs SERP overview with EXACT format above
3. **Leo** extracts top URLs from positions array
4. **Leo** passes URLs to competitor-scraper subagent
5. Subagent scrapes using Firecrawl CLI (not MCP)

## Example Usage

For keyword "white label ppc":

```
mcp__ahrefs__serp-overview-serp-overview({
  "keyword": "white label ppc",
  "country": "us",
  "select": "position,url,title,domain_rating,traffic,backlinks,keywords",
  "top_positions": 10
})
```

Then extract URLs for scraping:
```javascript
const topUrls = result.positions
  .filter(p => p.url && !p.url.includes('reddit.com') && !p.url.includes('quora.com'))
  .slice(0, 5)
  .map(p => p.url);
```

## For Subagents

If you are a subagent and need competitor URLs:
- Ask Leo to provide them
- Or use Perplexity CLI to search for top articles

```bash
npx tsx src/cli/perplexity-search.ts "top articles about {keyword} your topic"
```

## Key Note

The keyword data (volume, difficulty, etc.) is already stored in Supabase `keyword_queue` table. Leo queries this directly - no need for Ahrefs keyword metrics.

Ahrefs is used ONLY for SERP analysis to find competitor URLs.
