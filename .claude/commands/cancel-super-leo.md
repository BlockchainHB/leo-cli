---
description: Cancel the active Super-Leo loop
allowed-tools: Bash, Read
---

# Cancel Super-Leo

Stop the active Super-Leo automated keyword processing loop.

## Check for Active Loop

```bash
if [ -f "./.claude/super-leo.local.md" ]; then
    echo "Active Super-Leo loop found"
else
    echo "No active Super-Leo loop"
fi
```

## If No Active Loop

Respond: "No active Super-Leo loop to cancel."

## If Active Loop Exists

1. Read the state file to get progress:

```bash
cat ./.claude/super-leo.local.md
```

2. Extract the stats from frontmatter:
   - target_count
   - completed_count
   - started_at

3. Delete the state file:

```bash
rm ./.claude/super-leo.local.md
```

4. Report the cancellation:

```
Super-Leo Cancelled

Progress: [completed_count]/[target_count] keywords completed
Started: [started_at]
Cancelled: [current_time]

The loop has been stopped. Any in-progress work remains in:
- Draft: drafts/[current_keyword].md (if started)
- Queue status: Check with /queue-status

To resume, run /super-leo with a new count.
```
