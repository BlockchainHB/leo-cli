#!/bin/bash
# Session Restore Hook - Provides context after compaction or resume
# Usage: session-restore.sh [compact|resume|clear|startup]

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_FILE="$PROJECT_ROOT/.claude/session-state.json"
PROGRESS_FILE="$PROJECT_ROOT/blog-progress.json"
CLAUDE_MD="$PROJECT_ROOT/.claude/CLAUDE.md"

SOURCE="${1:-startup}"

echo "=== Session Restore ($SOURCE) ===" >&2

# Function to output context reminder
output_context() {
    local msg="$1"
    echo "$msg"
}

# Always provide project context
output_context "PROJECT: Leo - AI Blog Agent"
output_context "WORKING_DIR: $PROJECT_ROOT"

# Check for saved session state (from pre-compact hook)
if [ -f "$STATE_FILE" ] && [ "$SOURCE" = "compact" ]; then
    SAVED_KEYWORD=$(jq -r '.workflow_state.keyword // ""' "$STATE_FILE")
    SAVED_STATUS=$(jq -r '.workflow_state.status // ""' "$STATE_FILE")
    SAVED_PHASE=$(jq -r '.workflow_state.phase // ""' "$STATE_FILE")
    CUSTOM_INSTRUCTIONS=$(jq -r '.custom_instructions // ""' "$STATE_FILE")

    if [ -n "$SAVED_KEYWORD" ]; then
        output_context ""
        output_context "=== RESTORED WORKFLOW STATE ==="
        output_context "Keyword: $SAVED_KEYWORD"
        output_context "Status: $SAVED_STATUS"
        output_context "Phase: $SAVED_PHASE"

        if [ -n "$CUSTOM_INSTRUCTIONS" ]; then
            output_context "Compact focus: $CUSTOM_INSTRUCTIONS"
        fi
    fi

    # Show recent files
    RECENT_DRAFTS=$(jq -r '.recent_files.drafts | join(", ")' "$STATE_FILE")
    if [ -n "$RECENT_DRAFTS" ] && [ "$RECENT_DRAFTS" != "" ]; then
        output_context "Recent drafts: $RECENT_DRAFTS"
    fi
fi

# Check current blog-progress.json for active work
if [ -f "$PROGRESS_FILE" ]; then
    CURRENT_KEYWORD=$(jq -r '.currentKeyword // ""' "$PROGRESS_FILE")
    CURRENT_STATUS=$(jq -r '.status // ""' "$PROGRESS_FILE")

    if [ -n "$CURRENT_KEYWORD" ]; then
        output_context ""
        output_context "=== CURRENT WORKFLOW ==="
        output_context "Active keyword: $CURRENT_KEYWORD"
        output_context "Status: $CURRENT_STATUS"

        # Check for related files
        if [ -f "$PROJECT_ROOT/drafts/${CURRENT_KEYWORD}.md" ]; then
            output_context "Draft exists: drafts/${CURRENT_KEYWORD}.md"
        fi
        if [ -f "$PROJECT_ROOT/drafts/${CURRENT_KEYWORD}-images-v2.json" ]; then
            output_context "Image specs: drafts/${CURRENT_KEYWORD}-images-v2.json"
        fi
        if [ -d "$PROJECT_ROOT/images/${CURRENT_KEYWORD}" ]; then
            IMAGE_COUNT=$(ls "$PROJECT_ROOT/images/${CURRENT_KEYWORD}"/*.png 2>/dev/null | wc -l | tr -d ' ')
            output_context "Images generated: $IMAGE_COUNT in images/${CURRENT_KEYWORD}/"
        fi
    fi
fi

# Provide quick reference for common tasks
output_context ""
output_context "=== QUICK REFERENCE ==="
output_context "Queue status: /queue-status"
output_context "Write blog: /write-blog"
output_context "Publish: /publish"
output_context "Schedule: /schedule"

# Remind about key rules
output_context ""
output_context "KEY RULES:"
output_context "- Always read files before writing"
output_context "- Use npx tsx (not node dist/)"
output_context "- Read leo.config.json for project settings"
