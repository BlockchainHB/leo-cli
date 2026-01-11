---
description: "Use this skill when scraping competitor websites, extracting content from URLs, or crawling web pages for research. Triggers on: scrape website, crawl page, extract content, competitor content, get webpage."
---

# Firecrawl Web Scraping (CLI Script)

This skill provides patterns for scraping web content using the Firecrawl CLI script. **DO NOT use MCP tools** - use the Bash command instead.

## How to Scrape - USE THIS COMMAND

Run this Bash command to scrape any URL:

```bash
npx tsx src/cli/firecrawl-scrape.ts "https://example.com/article"
```

The script outputs JSON with:
- `success`: boolean
- `markdown`: the page content as markdown
- `metadata`: title, description, etc.

## Example Usage

```bash
# Scrape a competitor blog post
npx tsx src/cli/firecrawl-scrape.ts "https://example.com/blog/your-topic"
```

## Competitor Analysis Workflow

1. Get URLs from keyword research or SERP analysis
2. For each URL, run the scrape command
3. Parse the JSON output
4. Extract headings, word count, structure
5. Save analysis to `./drafts/{slug}-scraped.json`

## Processing Scraped Content

After scraping, analyze:
- **Word count**: Split markdown by whitespace
- **Headings**: Match lines starting with `#`
- **Structure**: Note major sections
- **Gaps**: What's missing that we can cover?

## Output Format for Competitor Analysis

Save to `./drafts/{slug}-scraped.json`:

```json
{
  "urls_scraped": [
    {
      "url": "https://competitor.com/article",
      "title": "The Complete Guide to Your Topic",
      "wordCount": 2450,
      "headings": [
        "Why This Topic Matters",
        "Getting Started",
        "Key Considerations",
        "Tool Recommendations"
      ],
      "contentPreview": "First 500 words..."
    }
  ],
  "scrape_date": "2025-12-06"
}
```

## Best Practices

1. **Scrape 3-5 URLs max** - Focus on top competitors
2. **Cache results** - Save scraped content to files
3. **Extract structure** - Note headings, sections, word counts
4. **Look for gaps** - What topics do competitors miss?
5. **Read before write** - Always read existing files first

## Target Competitors

Identify competitors relevant to your niche from:
- SERP results for your target keywords
- Industry blogs and publications
- Popular content in your category

## IMPORTANT

- **DO NOT use `mcp__firecrawl__*` tools** - they are not available to subagents
- **USE the Bash command above** - it's the only way to scrape
- **ALWAYS read files before writing** - never overwrite without reading first
