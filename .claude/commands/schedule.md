---
argument-hint: [slug] [date]
description: Schedule a draft blog post for future publication
allowed-tools: Read, Write, Bash
---

# Schedule Post for Future Publication

Schedule a completed draft to be published at a future date.

## Arguments

- `slug`: The slug of the draft to schedule (e.g., "my-blog-post")
- `date`: The publish date in YYYY-MM-DD format (e.g., "2025-01-15")
  - Optional time: YYYY-MM-DDTHH:MM (e.g., "2025-01-15T09:00")
  - Defaults to 9:00 AM EST if no time provided

## Workflow

### 1. Parse Arguments

```typescript
const args = '$ARGUMENTS'.split(' ');
const slug = args[0];
let dateArg = args[1] || '';

// Default to 9am EST if no time provided
if (!dateArg.includes('T')) {
  dateArg = `${dateArg}T09:00:00-05:00`;
}

const scheduledDate = new Date(dateArg);
if (isNaN(scheduledDate.getTime())) {
  throw new Error('Invalid date format. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM');
}
```

### 2. Find or Create Sanity Post

Check if the draft has already been uploaded to Sanity, or create it:

```typescript
import * as sanity from './servers/sanity';
import * as fs from 'fs';

const draftPath = `./drafts/${slug}.md`;
if (!fs.existsSync(draftPath)) {
  throw new Error(`Draft not found: ${draftPath}`);
}

// Check for existing Sanity document or create new one
// Then schedule it
```

### 3. Schedule the Post

```typescript
const result = await sanity.schedulePost(documentId, scheduledDate.toISOString());
console.log(`Scheduled for: ${scheduledDate.toLocaleString()}`);
```

### 4. Update Queue Status

Mark the keyword as 'scheduled' in Supabase (not 'published' until it actually goes live).

## Output

```
Scheduling post for future publication...

✓ Draft found: ./drafts/my-blog-post.md
✓ Post scheduled in Sanity

📅 Scheduled Publication
Title: Your Blog Post Title
Slug: my-blog-post
Publish Date: January 15, 2025 at 9:00 AM EST

The post will automatically go live at this time.
To view scheduled posts, run /queue-status.
```

## Examples

```
/schedule my-blog-post 2025-01-15
/schedule getting-started 2025-01-20T14:00
/schedule complete-guide 2025-02-01
```

