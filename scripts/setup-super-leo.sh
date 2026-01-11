#!/bin/bash
# Super-Leo Setup Script
# Initializes an automated loop for processing multiple keywords from the queue

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_FILE="$PROJECT_ROOT/.claude/super-leo.local.md"

usage() {
    cat << 'EOF'
Super-Leo: Automated Keyword Processing Loop

USAGE:
    /super-leo <count>
    /super-leo <count> --publish

ARGUMENTS:
    <count>     Number of keywords to process from the queue (required, positive integer)

OPTIONS:
    --publish   Auto-publish each article after completion (default: draft only)
    -h, --help  Show this help message

EXAMPLES:
    /super-leo 3                 # Process 3 keywords, save as drafts
    /super-leo 5 --publish       # Process 5 keywords and publish each

BEHAVIOR:
    - Pulls next pending keyword from Supabase queue
    - Runs full blog writing workflow (research, write, images)
    - Updates keyword status in queue
    - Repeats until target count reached or queue empty
    - Creates drafts in ./drafts/{slug}.md

TO CANCEL:
    Run /cancel-super-leo at any time

WARNING:
    This will run until complete. Ensure you have sufficient API credits.
EOF
}

# Parse arguments
COUNT=""
AUTO_PUBLISH="false"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        --publish)
            AUTO_PUBLISH="true"
            shift
            ;;
        *)
            if [[ -z "$COUNT" ]]; then
                COUNT="$1"
            else
                echo "Error: Unexpected argument '$1'" >&2
                usage >&2
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate count
if [[ -z "$COUNT" ]]; then
    echo "Error: You must specify how many keywords to process" >&2
    echo "" >&2
    usage >&2
    exit 1
fi

if ! [[ "$COUNT" =~ ^[1-9][0-9]*$ ]]; then
    echo "Error: Count must be a positive integer (got: '$COUNT')" >&2
    exit 1
fi

# Check if already running
if [[ -f "$STATE_FILE" ]]; then
    EXISTING_COUNT=$(sed -n 's/^target_count: *//p' "$STATE_FILE")
    EXISTING_COMPLETED=$(sed -n 's/^completed_count: *//p' "$STATE_FILE")
    echo "Error: Super-Leo is already running!" >&2
    echo "  Target: $EXISTING_COUNT keywords" >&2
    echo "  Completed: $EXISTING_COMPLETED keywords" >&2
    echo "" >&2
    echo "Run /cancel-super-leo to stop the current loop first." >&2
    exit 1
fi

# Create state directory if needed
mkdir -p "$PROJECT_ROOT/.claude"

# Create state file
cat > "$STATE_FILE" << EOF
---
target_count: $COUNT
completed_count: 0
auto_publish: $AUTO_PUBLISH
started_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
completed_keywords: []
---

# Super-Leo Task

Process $COUNT keywords from the queue using the full blog workflow.

## Instructions

1. Get the next pending keyword from the queue
2. Run the complete blog writing workflow:
   - Research the keyword (SERP, competitor analysis)
   - Write the article with images
   - Save draft to ./drafts/{slug}.md
3. Update keyword status in Supabase
4. Report completion

## Important Rules

- Focus on ONE keyword at a time
- Complete the full workflow before moving to next
- If queue is empty, report it and stop
- Track progress in blog-progress.json

## Auto-Publish Mode

Auto-publish is set to: $AUTO_PUBLISH

If true, publish each article immediately after completion.
If false, save as draft only.

## Current Task

Get the next keyword and start the blog workflow.
EOF

echo "Super-Leo initialized!"
echo ""
echo "Target: $COUNT keywords"
echo "Auto-publish: $AUTO_PUBLISH"
echo "State file: $STATE_FILE"
echo ""
echo "Starting automated keyword processing..."
