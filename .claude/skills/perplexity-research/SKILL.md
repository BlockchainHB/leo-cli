---
description: "Use this skill when searching for current information, finding recent news, or researching topics that need up-to-date web data. Triggers on: search web, current information, recent news, find articles, research topic."
---

# Perplexity Web Research (CLI Script)

This skill provides patterns for web search and research using the Perplexity CLI script. **DO NOT use MCP tools** - use the Bash command instead.

## How to Search - USE THIS COMMAND

Run this Bash command to search the web:

```bash
npx tsx src/cli/perplexity-search.ts "your search query here"
```

The script outputs the search results as text.

## When to Use Perplexity

- **Current events**: Recent industry news and policy changes
- **Statistics**: Latest trends and market data
- **Questions**: What people are asking about a topic
- **Verification**: Fact-check claims before publishing

## Example Searches

```bash
# Research fulfillment center trends
npx tsx src/cli/perplexity-search.ts "your topic fulfillment center trends 2025"

# Find common questions
npx tsx src/cli/perplexity-search.ts "common questions about your topic accounting"

# Get recent updates
npx tsx src/cli/perplexity-search.ts "your topic fee changes 2025"

# Find statistics
npx tsx src/cli/perplexity-search.ts "industry statistics 2025"
```

## Research Workflow

1. **Overview search**: `"{keyword} comprehensive guide"`
2. **Questions search**: `"common questions about {keyword}"`
3. **Recent updates**: `"{keyword} changes 2025"`
4. **Statistics**: `"{keyword} statistics data"`

## Output Format

Save research to `./drafts/{slug}-research.json`:

```json
{
  "keyword": "your topic accounting",
  "research_date": "2025-12-06",
  "overview": "Summary from overview search...",
  "common_questions": [
    "How do I get started with this topic?",
    "What tools work best for this use case?"
  ],
  "recent_changes": "Summary of recent changes...",
  "key_statistics": [
    "85% of users prefer this approach...",
    "Average success rate is..."
  ],
  "sources": [
    "https://source1.com",
    "https://source2.com"
  ]
}
```

## Best Practices

1. **Be specific** - Include context in queries
2. **Multiple searches** - Do 3-4 focused searches, not one broad one
3. **Save everything** - Store research for content writing phase
4. **Cite sources** - Note URLs for linking in articles
5. **Read before write** - Always read existing files first

## IMPORTANT

- **DO NOT use `mcp__perplexity-mcp__*` tools** - they are not available to subagents
- **USE the Bash command above** - it's the only way to search
- **ALWAYS read files before writing** - never overwrite without reading first
