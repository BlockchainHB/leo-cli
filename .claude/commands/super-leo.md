---
argument-hint: <count> [--publish]
description: Process multiple keywords automatically in a loop
allowed-tools: Bash, Read, Write, Edit, Task, mcp__supabase__execute_sql
---

# Super-Leo: Automated Keyword Processing

Run this command to process multiple keywords from the queue automatically. Super-Leo will loop through keywords until the target count is reached or the queue is empty.

## Setup

First, run the setup script with the target count:

```bash
bash scripts/setup-super-leo.sh $ARGUMENTS
```

## Workflow Per Keyword

For each keyword, execute the full blog workflow:

### 1. Get Next Keyword

Query the next pending keyword from Supabase:

```sql
SELECT id, primary_keyword, topic_cluster, volume, kd, bv
FROM keyword_queue
WHERE status = 'pending'
ORDER BY roi DESC, volume DESC
LIMIT 1;
```

If no pending keywords, report "Queue is empty" and stop.

### 2. Mark as In Progress

```sql
UPDATE keyword_queue
SET status = 'in_progress', updated_at = NOW()
WHERE id = [keyword_id];
```

### 3. Update blog-progress.json

```bash
cat > blog-progress.json << 'EOF'
{
  "currentKeyword": "[keyword]",
  "status": "in_progress",
  "phase": "research"
}
EOF
```

### 4. Research Phase

Get SERP data for the keyword:

```bash
npx tsx src/cli/dataforseo-serp.ts "[keyword]" 10
```

### 5. Content Creation

Use Task tool with content-writer agent to write the article:
- Pass SERP data and competitor URLs
- Generate slug from keyword
- Save draft to `drafts/{slug}.md`

### 6. Image Generation

Use Task tool with image-creator agent to:
- Generate hero image
- Generate section images based on H2 headings
- Save to `images/{slug}/`

### 7. Update Status to Drafted

```sql
UPDATE keyword_queue
SET status = 'drafted', updated_at = NOW()
WHERE id = [keyword_id];
```

Update blog-progress.json:
```json
{
  "currentKeyword": "[keyword]",
  "status": "drafted",
  "phase": "complete"
}
```

### 8. Auto-Publish (if enabled)

Check if auto-publish is enabled in `.claude/super-leo.local.md`.

If true:
- Upload images to Sanity
- Create and publish post
- Update status to 'published'

### 9. Report Completion

Output a summary:
```
Completed: [keyword]
Draft: drafts/[slug].md
Images: images/[slug]/
Status: drafted (or published)
```

## Important Notes

- Process ONE keyword at a time completely
- Always update Supabase status after each phase
- Keep blog-progress.json current for the stop hook
- If errors occur, mark keyword as 'error' and continue to next
- The stop hook will detect completion and loop to next keyword

## Cancel

To stop the loop early, run: `/cancel-super-leo`
