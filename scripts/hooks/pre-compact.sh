#!/bin/bash
# Pre-Compact Hook - Saves important state before compaction
# This runs before Claude compacts the conversation

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_FILE="$PROJECT_ROOT/.claude/session-state.json"
PROGRESS_FILE="$PROJECT_ROOT/blog-progress.json"

# Read hook input from stdin (JSON)
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "unknown"')
CUSTOM_INSTRUCTIONS=$(echo "$INPUT" | jq -r '.custom_instructions // ""')

echo "=== Pre-Compact Hook ===" >&2
echo "Session: $SESSION_ID" >&2
echo "Trigger: $TRIGGER" >&2

# Get current state from blog-progress.json if it exists
CURRENT_KEYWORD=""
CURRENT_STATUS=""
CURRENT_PHASE=""

if [ -f "$PROGRESS_FILE" ]; then
    CURRENT_KEYWORD=$(jq -r '.currentKeyword // ""' "$PROGRESS_FILE")
    CURRENT_STATUS=$(jq -r '.status // ""' "$PROGRESS_FILE")
    CURRENT_PHASE=$(jq -r '.phase // ""' "$PROGRESS_FILE")
fi

# Get list of modified drafts
DRAFT_FILES=""
if [ -d "$PROJECT_ROOT/drafts" ]; then
    DRAFT_FILES=$(find "$PROJECT_ROOT/drafts" -name "*.md" -mmin -60 2>/dev/null | head -5 | tr '\n' ',' | sed 's/,$//')
fi

# Get list of generated images
IMAGE_DIRS=""
if [ -d "$PROJECT_ROOT/images" ]; then
    IMAGE_DIRS=$(find "$PROJECT_ROOT/images" -type d -mmin -60 2>/dev/null | head -5 | tr '\n' ',' | sed 's/,$//')
fi

# Save session state for restoration after compaction
jq -n \
    --arg session_id "$SESSION_ID" \
    --arg trigger "$TRIGGER" \
    --arg custom_instructions "$CUSTOM_INSTRUCTIONS" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg current_keyword "$CURRENT_KEYWORD" \
    --arg current_status "$CURRENT_STATUS" \
    --arg current_phase "$CURRENT_PHASE" \
    --arg draft_files "$DRAFT_FILES" \
    --arg image_dirs "$IMAGE_DIRS" \
    '{
        session_id: $session_id,
        trigger: $trigger,
        custom_instructions: $custom_instructions,
        saved_at: $timestamp,
        workflow_state: {
            keyword: $current_keyword,
            status: $current_status,
            phase: $current_phase
        },
        recent_files: {
            drafts: ($draft_files | split(",") | map(select(. != ""))),
            images: ($image_dirs | split(",") | map(select(. != "")))
        }
    }' > "$STATE_FILE"

echo "State saved to $STATE_FILE" >&2

# Output message for Claude to see (optional guidance for compaction)
if [ -n "$CURRENT_KEYWORD" ]; then
    echo "CONTEXT TO PRESERVE: Working on keyword '$CURRENT_KEYWORD' in phase '$CURRENT_PHASE' with status '$CURRENT_STATUS'"
fi
