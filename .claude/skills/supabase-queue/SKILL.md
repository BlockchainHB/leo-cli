---
description: "Use this skill when working with the keyword queue in Supabase: fetching next keyword, updating keyword status, checking queue stats, or managing the blog pipeline. Triggers on: next keyword, queue status, mark as published, keyword queue, pending keywords."
---

# Supabase Keyword Queue Management

This skill provides SQL queries and code patterns for managing the keyword queue. **Use `mcp__supabase__execute_sql`** for all database operations.

## Table Schema

```sql
-- keyword_queue table
CREATE TABLE keyword_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, drafted, published
  priority INTEGER DEFAULT 50,
  search_volume INTEGER,
  keyword_difficulty INTEGER,
  cpc DECIMAL(10,2),
  roi_score DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  notes TEXT
);
```

## Status Flow

```
pending → in_progress → drafted → scheduled → published
   │                       │          │
   └── (abandoned) ←───────┴──────────┘
```

- **pending**: Not started
- **in_progress**: Currently being written (only ONE at a time)
- **drafted**: Draft saved, ready for review/publish
- **scheduled**: Scheduled for future publication in Sanity
- **published**: Live on Sanity CMS

## IMPORTANT: Agent Must Always Update Status

The agent should NEVER tell the user to run SQL manually. Always use `mcp__supabase__execute_sql` directly!

## Quick Reference

| Task | Query |
|------|-------|
| Get next keyword | See "Fetch Next Keyword" below |
| Mark in_progress | `UPDATE ... SET status = 'in_progress'` |
| Mark drafted | `UPDATE ... SET status = 'drafted'` |
| Mark published | `UPDATE ... SET status = 'published', published_at = NOW()` |
| Queue stats | See "Queue Statistics" below |

## Fetch Next Keyword

Get the highest-priority pending keyword:

```typescript
// Use mcp__supabase__execute_sql tool
const query = `
SELECT 
  id,
  keyword,
  search_volume,
  keyword_difficulty,
  cpc,
  roi_score,
  priority
FROM keyword_queue
WHERE status = 'pending'
ORDER BY 
  priority DESC,
  roi_score DESC NULLS LAST,
  search_volume DESC NULLS LAST
LIMIT 1;
`;

// Execute via MCP tool
const result = await mcp__supabase__execute_sql({ query });
const nextKeyword = result[0];
console.log(`Next: "${nextKeyword.keyword}" (ROI: ${nextKeyword.roi_score})`);
```

## Update Status

### Start Working (pending → in_progress)

```typescript
const query = `
UPDATE keyword_queue
SET 
  status = 'in_progress',
  updated_at = NOW()
WHERE keyword = 'your target keyword'
RETURNING id, keyword, status;
`;
await mcp__supabase__execute_sql({ query });
```

### Save Draft (in_progress → drafted)

```typescript
const query = `
UPDATE keyword_queue
SET 
  status = 'drafted',
  updated_at = NOW()
WHERE keyword = 'your target keyword'
RETURNING id, keyword, status;
`;
await mcp__supabase__execute_sql({ query });
```

### Schedule (drafted → scheduled)

```typescript
const query = `
UPDATE keyword_queue
SET 
  status = 'scheduled',
  sanity_id = 'your-sanity-doc-id',
  scheduled_at = '2025-12-08T14:00:00.000Z',
  updated_at = NOW()
WHERE primary_keyword = 'fulfillment center'
RETURNING id, primary_keyword, status, scheduled_at;
`;
await mcp__supabase__execute_sql({ project_id: 'YOUR_PROJECT_ID', query });
```

### Publish (scheduled/drafted → published)

```typescript
const query = `
UPDATE keyword_queue
SET 
  status = 'published',
  published_at = NOW(),
  updated_at = NOW()
WHERE primary_keyword = 'your target keyword'
RETURNING id, primary_keyword, status, published_at;
`;
await mcp__supabase__execute_sql({ project_id: 'YOUR_PROJECT_ID', query });
```

## Queue Statistics

```typescript
const query = `
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(roi_score)::numeric, 1) as avg_roi,
  ROUND(AVG(search_volume)::numeric, 0) as avg_volume
FROM keyword_queue
GROUP BY status
ORDER BY 
  CASE status 
    WHEN 'pending' THEN 1 
    WHEN 'in_progress' THEN 2 
    WHEN 'drafted' THEN 3 
    WHEN 'published' THEN 4 
  END;
`;
await mcp__supabase__execute_sql({ query });
```

## Top Pending Keywords

```typescript
const query = `
SELECT 
  keyword,
  search_volume,
  keyword_difficulty,
  roi_score,
  priority
FROM keyword_queue
WHERE status = 'pending'
ORDER BY priority DESC, roi_score DESC
LIMIT 10;
`;
await mcp__supabase__execute_sql({ query });
```

## Recently Published

```typescript
const query = `
SELECT 
  keyword,
  published_at,
  search_volume,
  roi_score
FROM keyword_queue
WHERE status = 'published'
ORDER BY published_at DESC
LIMIT 5;
`;
await mcp__supabase__execute_sql({ query });
```

## Check for Stuck Keywords

Find keywords stuck in `in_progress` for too long:

```typescript
const query = `
SELECT keyword, updated_at
FROM keyword_queue
WHERE status = 'in_progress'
  AND updated_at < NOW() - INTERVAL '24 hours';
`;
await mcp__supabase__execute_sql({ query });
```

## Important Rules

1. **Only ONE keyword should be `in_progress` at a time**
2. **Always update status at the right stage:**
   - Start writing → `in_progress`
   - Draft saved → `drafted`
   - Published to Sanity → `published`
3. **Never skip statuses** (don't go from `pending` to `published`)
4. **Check for interrupted work** before starting new keywords

