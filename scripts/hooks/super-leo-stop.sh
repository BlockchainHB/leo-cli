#!/bin/bash
# Super-Leo Stop Hook
# Prevents session exit when super-leo is active
# Feeds the prompt back to continue processing keywords

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_FILE="$PROJECT_ROOT/.claude/super-leo.local.md"
PROGRESS_FILE="$PROJECT_ROOT/blog-progress.json"

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Check if super-leo is active
if [[ ! -f "$STATE_FILE" ]]; then
    # No active loop - allow exit
    exit 0
fi

# Parse YAML frontmatter
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$STATE_FILE")

# Extract values
TARGET_COUNT=$(echo "$FRONTMATTER" | grep '^target_count:' | sed 's/target_count: *//')
COMPLETED_COUNT=$(echo "$FRONTMATTER" | grep '^completed_count:' | sed 's/completed_count: *//')
AUTO_PUBLISH=$(echo "$FRONTMATTER" | grep '^auto_publish:' | sed 's/auto_publish: *//')
STARTED_AT=$(echo "$FRONTMATTER" | grep '^started_at:' | sed 's/started_at: *//')

# Validate numeric fields
if [[ ! "$TARGET_COUNT" =~ ^[0-9]+$ ]]; then
    echo "Super-Leo: State file corrupted (invalid target_count: '$TARGET_COUNT')" >&2
    rm -f "$STATE_FILE"
    exit 0
fi

if [[ ! "$COMPLETED_COUNT" =~ ^[0-9]+$ ]]; then
    echo "Super-Leo: State file corrupted (invalid completed_count: '$COMPLETED_COUNT')" >&2
    rm -f "$STATE_FILE"
    exit 0
fi

# Check blog-progress.json to see if a keyword was just completed
LAST_KEYWORD=""
LAST_STATUS=""
if [[ -f "$PROGRESS_FILE" ]]; then
    LAST_KEYWORD=$(jq -r '.currentKeyword // ""' "$PROGRESS_FILE" 2>/dev/null || echo "")
    LAST_STATUS=$(jq -r '.status // ""' "$PROGRESS_FILE" 2>/dev/null || echo "")
fi

# Determine if we just completed a keyword
# If status is "completed" or "published" or "drafted", count it
JUST_COMPLETED=false
if [[ "$LAST_STATUS" == "drafted" ]] || [[ "$LAST_STATUS" == "published" ]] || [[ "$LAST_STATUS" == "completed" ]] || [[ "$LAST_STATUS" == "scheduled" ]]; then
    # Check if this keyword is already in our completed list
    COMPLETED_KEYWORDS=$(echo "$FRONTMATTER" | grep '^completed_keywords:' | sed 's/completed_keywords: *//')
    if [[ -n "$LAST_KEYWORD" ]] && ! echo "$COMPLETED_KEYWORDS" | grep -q "$LAST_KEYWORD"; then
        JUST_COMPLETED=true
    fi
fi

# If we just completed one, update the count
if [[ "$JUST_COMPLETED" == "true" ]]; then
    COMPLETED_COUNT=$((COMPLETED_COUNT + 1))

    # Update state file with new completed count and keyword
    TEMP_FILE="${STATE_FILE}.tmp.$$"
    sed "s/^completed_count: .*/completed_count: $COMPLETED_COUNT/" "$STATE_FILE" > "$TEMP_FILE"

    # Also add keyword to completed list (simple append for now)
    sed -i.bak "s/^completed_keywords: \[\(.*\)\]/completed_keywords: [\1, \"$LAST_KEYWORD\"]/" "$TEMP_FILE" 2>/dev/null || true
    rm -f "${TEMP_FILE}.bak"
    mv "$TEMP_FILE" "$STATE_FILE"

    echo "Completed keyword $COMPLETED_COUNT/$TARGET_COUNT: $LAST_KEYWORD" >&2
fi

# Check if we've reached the target
if [[ $COMPLETED_COUNT -ge $TARGET_COUNT ]]; then
    echo "" >&2
    echo "============================================" >&2
    echo "Super-Leo Complete!" >&2
    echo "============================================" >&2
    echo "Processed: $COMPLETED_COUNT keywords" >&2
    echo "Started: $STARTED_AT" >&2
    echo "Finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
    echo "============================================" >&2
    rm -f "$STATE_FILE"
    exit 0
fi

# Check if queue is empty by looking at last assistant output
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path' 2>/dev/null || echo "")
QUEUE_EMPTY=false

if [[ -n "$TRANSCRIPT_PATH" ]] && [[ -f "$TRANSCRIPT_PATH" ]]; then
    # Check if last output mentioned empty queue
    LAST_OUTPUT=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -1 | jq -r '.message.content | map(select(.type == "text")) | map(.text) | join("\n")' 2>/dev/null || echo "")

    if echo "$LAST_OUTPUT" | grep -qi "queue is empty\|no pending keywords\|no more keywords"; then
        QUEUE_EMPTY=true
    fi
fi

if [[ "$QUEUE_EMPTY" == "true" ]]; then
    echo "" >&2
    echo "============================================" >&2
    echo "Super-Leo Stopped: Queue Empty" >&2
    echo "============================================" >&2
    echo "Processed: $COMPLETED_COUNT of $TARGET_COUNT keywords" >&2
    echo "Reason: No more pending keywords in queue" >&2
    echo "============================================" >&2
    rm -f "$STATE_FILE"
    exit 0
fi

# Not complete - continue loop
REMAINING=$((TARGET_COUNT - COMPLETED_COUNT))

# Extract the prompt from state file (everything after closing ---)
PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' "$STATE_FILE")

if [[ -z "$PROMPT_TEXT" ]]; then
    echo "Super-Leo: State file corrupted (no prompt found)" >&2
    rm -f "$STATE_FILE"
    exit 0
fi

# Build system message
SYSTEM_MSG="Super-Leo iteration $((COMPLETED_COUNT + 1))/$TARGET_COUNT | $REMAINING keywords remaining | Auto-publish: $AUTO_PUBLISH"

# Reset blog-progress.json for next keyword
if [[ -f "$PROGRESS_FILE" ]]; then
    jq '.status = "pending" | .phase = "starting" | .currentKeyword = ""' "$PROGRESS_FILE" > "${PROGRESS_FILE}.tmp" && mv "${PROGRESS_FILE}.tmp" "$PROGRESS_FILE"
fi

# Output JSON to block the stop and continue
jq -n \
    --arg prompt "$PROMPT_TEXT" \
    --arg msg "$SYSTEM_MSG" \
    '{
        "decision": "block",
        "reason": $prompt,
        "systemMessage": $msg
    }'

exit 0
