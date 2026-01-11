---
description: View the current keyword queue status and upcoming articles
allowed-tools: Read, Bash
---

# Queue Status

Display the current state of the keyword queue and any work in progress.

## First Step: Read Configuration

```bash
cat ./leo.config.json
```

Check `queue.provider` to determine if using local or Supabase queue.

## What to Show

### 1. Current Work in Progress

Check `blog-progress.json` for any active work:

```typescript
import * as fs from 'fs';

const progress = JSON.parse(fs.readFileSync('./blog-progress.json', 'utf-8'));

if (progress.current_article) {
  console.log('## Current Work');
  console.log(`Keyword: ${progress.current_article.keyword}`);
  console.log(`Status: ${progress.current_article.status}`);
  console.log(`Draft: ${progress.current_article.draft_path || 'Not started'}`);
}
```

### 2. Queue Statistics

**For local queue:**
```bash
npx tsx src/cli/queue.ts status
```

**For Supabase queue:**
Use MCP tool to query keyword_queue table.

### 3. Next Up (Top 5 Pending)

**For local queue:**
```bash
npx tsx src/cli/queue.ts list --limit 5
```

**For Supabase queue:**
```sql
SELECT primary_keyword, search_volume, keyword_difficulty, status
FROM keyword_queue
WHERE status = 'pending'
ORDER BY priority DESC, search_volume DESC
LIMIT 5;
```

### 4. Recently Completed

Check `blog-progress.json`:

```typescript
console.log('## Recently Completed');
progress.completed_articles?.slice(-5).forEach(article => {
  console.log(`- ${article.keyword} → ${article.slug}`);
});
```

## Output Format

Read blog name from `leo.config.json`:

```
## [Blog Name] Keyword Queue Status

### Current Work
Keyword: your keyword here
Status: drafting
Draft: ./drafts/your-keyword.md

### Queue Stats
| Status | Count |
|--------|-------|
| Pending | 35 |
| In Progress | 1 |
| Completed | 8 |

### Next in Queue
1. "keyword one" (Vol: 450, KD: 14) - In Progress
2. "keyword two" (Vol: 2,900, KD: 13) - Pending
3. "keyword three" (Vol: 8,600, KD: 26) - Pending
4. "keyword four" (Vol: 800, KD: 5) - Pending
5. "keyword five" (Vol: 1,200, KD: 18) - Pending

### Recently Completed (Last 5)
- keyword a → keyword-a
- keyword b → keyword-b
- keyword c → keyword-c
```
