---
argument-hint: [keyword]
description: Research a keyword without writing the full article
allowed-tools: Read, Write
---

# Research Keyword

Perform keyword and competitor research without generating the full article.
Useful for validating topics before committing to writing.

## Arguments

- `keyword`: The keyword to research

## Workflow

### 1. Keyword Research

Invoke **keyword-researcher** subagent:

```typescript
import * as ahrefs from './servers/ahrefs';

const keywordData = await ahrefs.getKeywordVolume({ 
  keyword: '$ARGUMENTS' 
});

const topPages = await ahrefs.getTopPages({ 
  keyword: '$ARGUMENTS',
  limit: 5 
});
```

### 2. Competitor Analysis

Invoke **competitor-analyzer** subagent:

```typescript
import * as firecrawl from './servers/firecrawl';

const competitors = await Promise.all(
  topPages.pages.slice(0, 3).map(async (page) => {
    const structure = await firecrawl.extractStructure({ url: page.url });
    return {
      url: page.url,
      ...structure
    };
  })
);
```

### 3. Save Research

Save to `./research/{keyword-slug}.json`:

```typescript
const research = {
  keyword: '$ARGUMENTS',
  researched_at: new Date().toISOString(),
  metrics: keywordData,
  competitors: competitors,
  recommendation: generateRecommendation(keywordData, competitors)
};

fs.writeFileSync(
  `./research/${slugify('$ARGUMENTS')}.json`,
  JSON.stringify(research, null, 2)
);
```

## Output Format

```
## Research: [keyword]

### Keyword Metrics
- Volume: X/month
- Difficulty: X/100
- CPC: $X.XX
- Global Volume: X/month

### Competition Analysis
| Rank | URL | Word Count | Sections | CTAs | Images |
|------|-----|------------|----------|------|--------|
| 1 | example.com/... | 2,500 | 12 | 4 | 8 |
| 2 | competitor.com/... | 1,800 | 8 | 6 | 5 |
| 3 | another.com/... | 3,200 | 15 | 3 | 12 |

### Content Gaps Identified
- [Gap 1]
- [Gap 2]
- [Gap 3]

### Recommendation
Difficulty: Easy / Medium / Hard
Priority: High / Medium / Low
Estimated Time: X hours

Suggested Approach:
[Specific strategy for this keyword]

---

To write this article: /write-blog [keyword]
```

## Use Cases

1. **Validate queue priorities**: Research keywords before deciding order
2. **Quick competitive intel**: See what competitors are doing
3. **Content planning**: Gather data for strategy discussions
4. **Training**: Understand the market before writing

