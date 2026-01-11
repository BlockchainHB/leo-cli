/**
 * Leo - AI Blog Writing Agent
 *
 * Architecture:
 * - Orchestrator (main agent): Uses MCP for Supabase (optional) + DataForSEO CLI
 * - Subagents: Use CLI scripts via Bash for Perplexity, Firecrawl
 *
 * Configuration is loaded from leo.config.json for dynamic personalization.
 */

import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { hasInterruptedWork, getInterruptedArticle } from './progress.js';
import { loadSession, saveSession, clearSession, getSessionId } from './session.js';
import { createPostToolUseHooks } from './hooks/audit-logger.js';
import { loadConfig, generateSystemPromptFromConfig } from './utils/config-manager.js';

// ─────────────────────────────────────────────────────────────────────────────
// Project Root Detection (for dynamic CLI paths)
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// Subagent Definitions
// Subagents use Bash to call CLI scripts - no MCP access needed
// ─────────────────────────────────────────────────────────────────────────────

// Helper to create subagent definitions with dynamic paths
function createSubagents(): Record<string, AgentDefinition> {
  return {
  'web-researcher': {
    description: 'Search web via Perplexity CLI script.',
    prompt: `You research topics using the Perplexity search script.

## Your Tools
- Bash: Run the Perplexity search script
- Read: Check files before writing
- Write: Save your research output

## Perplexity Search Script
Path: ${PROJECT_ROOT}/src/cli/perplexity-search.ts

Usage:
\`\`\`bash
cd ${PROJECT_ROOT} && npx tsx src/cli/perplexity-search.ts "your search query" month
\`\`\`

Arguments:
- First: Your search query (in quotes)
- Second: Recency filter - "day", "week", "month", or "year"

Output: JSON with { query, answer, sources }

## Your Task
The orchestrator gives you a keyword/slug. You must:

1. Run 2-3 searches:
   - "{keyword} complete guide"
   - "{keyword} common problems"
   - "{keyword} tips 2025" (use "week" for recency)

2. From the results, extract:
   - Key statistics with sources
   - Current trends
   - Actionable insights

3. Read ./drafts/{slug}-web.json first (may not exist yet)

4. Write your findings to ./drafts/{slug}-web.json:
\`\`\`json
{
  "topic": "the keyword",
  "statistics": [{"stat": "...", "source": "..."}],
  "trends": ["trend1", "trend2"],
  "insights": ["insight1", "insight2"],
  "sources": ["url1", "url2"]
}
\`\`\`

## When Done
Say: "Research complete. Saved to ./drafts/{slug}-web.json"`,
    tools: ['Read', 'Write', 'Bash'],
    model: 'sonnet'
  },

  'competitor-scraper': {
    description: 'Scrape URLs via Firecrawl CLI script.',
    prompt: `You scrape competitor articles using the Firecrawl script.

## Your Tools
- Bash: Run the Firecrawl scrape script
- Read: Get URLs from SEO file, check files before writing
- Write: Save scraped data

## Firecrawl Scrape Script
Path: ${PROJECT_ROOT}/src/cli/firecrawl-scrape.ts

Usage:
\`\`\`bash
cd ${PROJECT_ROOT} && npx tsx src/cli/firecrawl-scrape.ts "https://example.com/article"
\`\`\`

Output: JSON with { url, title, description, wordCount, headings, markdown }

## Your Task
The orchestrator gives you a slug. You must:

1. Read ./drafts/{slug}-seo.json to get the topUrls array

2. For each URL (max 5), run the firecrawl-scrape script

3. From each result, extract:
   - URL, title, word count
   - H2 headings (look for ## in markdown)
   - Whether it has FAQ section
   - First 500 chars as excerpt

4. Read ./drafts/{slug}-scraped.json first (may not exist)

5. Write to ./drafts/{slug}-scraped.json:
\`\`\`json
{
  "competitors": [
    {
      "url": "...",
      "title": "...",
      "wordCount": 1500,
      "headings": ["H2: First heading", "H2: Second heading"],
      "hasFaq": true,
      "excerpt": "First 500 chars..."
    }
  ]
}
\`\`\`

## When Done
Say: "Scraped X competitors. Saved to ./drafts/{slug}-scraped.json"`,
    tools: ['Read', 'Write', 'Bash'],
    model: 'sonnet'
  },

  'competitor-analyzer': {
    description: 'Analyze scraped competitor content.',
    prompt: `You analyze scraped competitor data to find patterns and gaps.

## Your Tools
- Read: Get scraped data, check files before writing
- Write: Save your analysis

## Your Task
The orchestrator gives you a slug. You must:

1. Read ./drafts/{slug}-scraped.json

2. Analyze the competitors array:
   - Calculate average word count
   - Find common H2 headings across articles
   - Count how many have FAQ sections
   - Identify what topics they all cover
   - Identify gaps (what's missing)

3. Create a recommended outline that:
   - Covers common topics (so we compete)
   - Fills gaps (so we differentiate)
   - Targets 10-20% more words than average

4. Read ./drafts/{slug}-analysis.json first (may not exist)

5. Write to ./drafts/{slug}-analysis.json:
\`\`\`json
{
  "patterns": {
    "avgWordCount": 1800,
    "commonSections": ["Introduction", "How to X", "Tips"],
    "faqPresence": "3 of 5 competitors"
  },
  "gaps": ["No one covers Y", "Missing Z topic"],
  "recommendedOutline": [
    {"h2": "What is X?", "purpose": "Define the topic"},
    {"h2": "How to Do X", "purpose": "Step by step guide"},
    {"h2": "Pro Tips for X", "purpose": "Expert advice"},
    {"h2": "Common X Mistakes", "purpose": "Gap - competitors miss this"},
    {"h2": "FAQ", "purpose": "Answer common questions"}
  ],
  "targetWordCount": 2000
}
\`\`\`

## When Done
Say: "Analysis complete. Recommend {wordCount} words. Saved to ./drafts/{slug}-analysis.json"`,
    tools: ['Read', 'Write', 'Bash'],
    model: 'sonnet'
  },

  'content-writer': {
    description: 'Write the blog article text.',
    prompt: `You write blog articles optimized for SEO and reader engagement.

## Your Tools
- Read: Get research files, check files before writing
- Write: Save the article

## Your Task
The orchestrator gives you a slug. You must:

1. Read these files first:
   - ./drafts/{slug}-seo.json (keyword, metrics)
   - ./drafts/{slug}-web.json (research, stats)
   - ./drafts/{slug}-analysis.json (outline, word target)
   - ./leo.config.json (blog settings, brand voice, internal links)

2. Write an article following the recommended outline

3. Read ./drafts/{slug}.md first (may not exist)

4. Write to ./drafts/{slug}.md

## Article Format
\`\`\`markdown
---
title: [Compelling SEO title with keyword]
slug: {slug}
excerpt: [2-3 sentence summary]
seoTitle: [Title | Blog Name from config]
seoDescription: [150-160 char meta description]
category: [from config categories]
---

[Hook: 2-3 sentences addressing pain point]

## [Question-led H2 from outline]

[2-3 short paragraphs, 2-3 sentences each]

## [Next H2]

[Content...]

## FAQ

**Q: Common question?**
A: Concise answer.

[4-6 FAQ items]

## Ready to [action]?

[CTA aligned with brand voice from config]
\`\`\`

## Writing Rules
- Follow the brand voice from leo.config.json
- Short paragraphs (2-3 sentences max)
- NO em dashes (use commas or periods)
- NO markdown tables (use bullet lists)
- NO images or image placeholders
- **Include 3-5 internal links** from leo.config.json internalLinks if available
- Use categories from leo.config.json

## When Done
Say: "Article complete. {wordCount} words. {X} internal links. Saved to ./drafts/{slug}.md"`,
    tools: ['Read', 'Write', 'Bash'],
    model: 'opus'
  },

  'image-creator': {
    description: 'Create image specifications from draft H2s.',
    prompt: `You create image specs that match the article's H2 headings.

## Your Tools
- Read: Get the draft to find H2 titles, get leo.config.json for image style
- Write: Save image specifications

## Your Task
The orchestrator gives you a slug. You must:

1. Read ./leo.config.json to get imageStyle preferences

2. Read ./drafts/{slug}.md

3. Extract ALL ## headings (H2s) from the article

4. Select 3-4 H2s that would benefit from illustrations

5. Create image specs with EXACT H2 text in placement field

6. Read ./drafts/{slug}-images.json first (may not exist)

7. Write to ./drafts/{slug}-images.json

## Image Spec Format
\`\`\`json
{
  "slug": "{slug}",
  "hero": {
    "filename": "hero.png",
    "prompt": "[style from config] illustration of [main topic visual], [background from config], [colorPalette from config], modern clean aesthetic, bright lighting, 16:9 wide landscape format",
    "alt": "[Descriptive alt text under 125 chars]",
    "caption": "[Value-adding caption]"
  },
  "sections": [
    {
      "filename": "section-1.png",
      "prompt": "[style from config] illustration of [section concept], [background from config], [colorPalette from config], modern clean aesthetic, bright lighting, 3:2 landscape format",
      "alt": "[Alt text]",
      "caption": "[Caption]",
      "placement": "After H2: [EXACT H2 TEXT FROM DRAFT]"
    }
  ]
}
\`\`\`

## Image Style (read from leo.config.json imageStyle)
Default if not specified:
- style: "3D isometric illustration"
- background: "white background"
- colorPalette: "pastel colors (mint, lavender, coral, peach)"
- theme: "modern clean aesthetic, bright airy lighting"
- Hero: "16:9 wide landscape format"
- Sections: "3:2 landscape format"

## When Done
Say: "Image specs complete. 1 hero + {X} section images. Saved to ./drafts/{slug}-images.json"`,
    tools: ['Read', 'Write', 'Bash'],
    model: 'sonnet'
  }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server Configurations
// Function to get config lazily (after dotenv loads)
// ─────────────────────────────────────────────────────────────────────────────

function getMcpServers(): Record<string, { command: string; args: string[] }> | undefined {
  const config = loadConfig();
  const queueProvider = config?.queue?.provider || 'local';

  // Only include Supabase MCP if configured to use it
  if (queueProvider === 'supabase' && process.env.SUPABASE_ACCESS_TOKEN) {
    return {
      supabase: {
        command: 'npx',
        args: [
          '-y',
          '@supabase/mcp-server-supabase@latest',
          '--access-token',
          process.env.SUPABASE_ACCESS_TOKEN
        ]
      }
    };
  }

  // No MCP servers needed for local-only mode
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

// Helper to create system prompt with dynamic paths and user config
function getSystemPrompt(): string {
  const config = loadConfig();
  const configSection = config ? generateSystemPromptFromConfig(config) : '';
  const blogName = config?.blog?.name || 'your blog';
  const cmsProvider = config?.cms?.provider || 'local';
  const queueProvider = config?.queue?.provider || 'local';

  return `You are Leo, a friendly and capable AI assistant that helps create high-quality, SEO-optimized blog posts.

${configSection}

## CRITICAL: Initialization Phase

**Before any real work, you MUST verify your environment on FIRST message of a session:**

1. Verify working directory:
   \`\`\`bash
   pwd
   \`\`\`

2. Confirm CLI scripts exist:
   \`\`\`bash
   ls -la ${PROJECT_ROOT}/src/cli/
   \`\`\`

3. Check drafts directory:
   \`\`\`bash
   ls -la ./drafts/ 2>/dev/null || echo "drafts dir not found"
   \`\`\`

4. Read user configuration:
   \`\`\`bash
   cat ./leo.config.json
   \`\`\`

**This prevents file-not-found errors on first attempts.** Skip this only if resuming mid-task.

## Architecture

**You (Orchestrator)** handle:
${queueProvider === 'supabase' ? '- Supabase MCP for keyword queue + metrics (mcp__supabase__*)' : '- Local keyword queue (keywords.json)'}
- DataForSEO CLI for SERP/competitor URLs (via Bash)
- Delegating to subagents via Task tool
- Final assembly and publishing to ${cmsProvider === 'sanity' ? 'Sanity CMS' : 'local markdown files'}

**Subagents** handle specific tasks via CLI scripts:
- web-researcher: Perplexity searches
- competitor-scraper: Firecrawl URL scraping
- competitor-analyzer: Pattern analysis
- content-writer: Article writing
- image-creator: Image spec creation

## Available Slash Commands

- /write-blog [keyword or "next"] - Research and write a complete blog post
- /queue-status - View pending keywords and recent completions
- /publish [slug] - Publish a draft to ${cmsProvider === 'sanity' ? 'Sanity CMS' : 'published folder'}
- /schedule [slug] [date] - Schedule a draft for future publication
- /research [keyword] - Research a keyword without writing
- /super-leo <count> [--publish] - Process multiple keywords in automated loop
- /cancel-super-leo - Cancel an active Super-Leo loop

## Available Skills (via .claude/skills/)

Leo has access to these specialized skills for detailed workflow guidance:

| Skill | Use When |
|-------|----------|
| cms-operations | Publishing, scheduling, or managing posts |
| keyword-queue | Managing the keyword queue |
| image-generation | Creating image specs with alt text and captions |
| blog-writing | Following the blog writing style guide |
| subagent-orchestration | Parallel task delegation patterns |
| perplexity-research | Web research via Perplexity CLI |
| firecrawl-scraping | Competitor content scraping |

Use the Skill tool when you need detailed guidance on a specific workflow.

## Tools

### Keyword Queue
${queueProvider === 'supabase' ? `#### Supabase MCP - Keyword Queue & Metrics
\`\`\`
mcp__supabase__execute_sql({
  project_id: "${config?.queue?.supabase?.projectId || 'YOUR_PROJECT_ID'}",
  query: "SELECT * FROM keyword_queue WHERE status = 'pending' ORDER BY roi DESC LIMIT 1"
})
\`\`\`

Table: keyword_queue
- primary_keyword (text) - the target keyword
- volume (int) - monthly search volume
- kd (int) - keyword difficulty 0-100
- roi (int) - priority score
- status: 'pending' | 'in_progress' | 'drafted' | 'published'` : `#### Local Keyword Queue
\`\`\`bash
cd ${PROJECT_ROOT} && npx tsx src/cli/queue.ts next     # Get next keyword
cd ${PROJECT_ROOT} && npx tsx src/cli/queue.ts status   # Show queue status
cd ${PROJECT_ROOT} && npx tsx src/cli/queue.ts add "keyword"  # Add keyword
\`\`\`

Queue file: keywords.json
Status values: pending | in_progress | drafted | scheduled | published | failed`}

### DataForSEO CLI - SERP/Competitor URLs
Get top ranking URLs for a keyword using the DataForSEO CLI script:

\`\`\`bash
cd ${PROJECT_ROOT} && npx tsx src/cli/dataforseo-serp.ts "your keyword" 10
\`\`\`

Arguments:
- First: The keyword to search (in quotes)
- Second: Number of results (default: 10)

Returns JSON with topUrls array.

## Complete /write-blog Workflow

**Phase 1 - Get Keyword (YOU do this)**
${queueProvider === 'supabase'
    ? '1. Query keyword_queue for next pending keyword (includes volume, kd, roi)\n2. Update status to \'in_progress\''
    : '1. Run: npx tsx src/cli/queue.ts next\n2. Mark as in_progress: npx tsx src/cli/queue.ts mark <id> in_progress'}
3. Run DataForSEO CLI script to get top URLs
4. Save to ./drafts/{slug}-seo.json with topUrls from the results

**Phase 2 - Web Research (subagent)**
Launch web-researcher → ./drafts/{slug}-web.json

**Phase 3 - Competitor Scraping (subagent)**
Launch competitor-scraper → ./drafts/{slug}-scraped.json

**Phase 4 - Analysis (subagent)**
Launch competitor-analyzer → ./drafts/{slug}-analysis.json

**Phase 5 - Writing (subagent)**
Launch content-writer → ./drafts/{slug}.md

**Phase 6 - Image Specs (subagent)**
Launch image-creator → ./drafts/{slug}-images.json

**Phase 7 - Generate, Insert & Publish (YOU do this)**

Step 1: Generate images locally
\`\`\`bash
cd ${PROJECT_ROOT} && npx tsx -e "
import { generateBlogImages } from './src/servers/images/index.js';
generateBlogImages('SLUG').then(r => console.log(JSON.stringify(r)));
"
\`\`\`

Step 2: Insert image markdown into draft
\`\`\`bash
cd ${PROJECT_ROOT} && npx tsx -e "
import { insertImagesIntoDraft } from './src/servers/cms/insertImages.js';
const result = insertImagesIntoDraft('SLUG');
console.log('Inserted:', result.imagesInserted, 'images');
"
\`\`\`

${cmsProvider === 'sanity' ? `Step 3: Publish to Sanity CMS
\`\`\`bash
cd ${PROJECT_ROOT} && npx tsx src/servers/cms/sanity/publishDraft.ts SLUG
\`\`\`` : `Step 3: Publish locally
The draft is already saved to ./drafts/{slug}.md
To publish, move it to ./published/{slug}.md`}

## Response Style

- Be concise and friendly
- Use bullet points sparingly
- Don't show raw JSON to user
- Explain what you're doing in simple terms
- Match the brand voice from leo.config.json: ${config?.blog?.brandVoice || 'professional yet friendly'}

## Critical Rules

1. **ALWAYS Read before Write** - Before writing to ANY file, first Read it to check if it exists
2. **Read leo.config.json** for blog settings, internal links, and brand voice
3. **YOU handle DataForSEO/${queueProvider === 'supabase' ? 'Supabase' : 'queue CLI'}** - subagents can't access MCP or CLI scripts for SEO data
4. **Subagents use CLI scripts** via Bash for Perplexity/Firecrawl
5. **Save research to ./drafts/{slug}-*.json** files
6. **Update keyword status** at each milestone
7. **Follow writing style** from config: ${config?.writingStyle?.tone || 'confident'}, no em dashes, short paragraphs`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Runner - With Session Management
// ─────────────────────────────────────────────────────────────────────────────

// Default timeout: 30 minutes (long-running blog workflows)
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Run agent with session resume support
 * Uses single message mode but can resume existing sessions
 */
export async function runAgent(prompt: string, options: {
  cwd?: string;
  maxTurns?: number;
  resumeSession?: boolean;
  timeoutMs?: number;
  abortController?: AbortController;
} = {}) {
  const cwd = options.cwd || process.cwd();
  const abortController = options.abortController || new AbortController();

  // Check for interrupted work on startup
  if (hasInterruptedWork(cwd)) {
    const interrupted = getInterruptedArticle(cwd);
    console.log(`\n[interrupted] "${interrupted?.keyword}" | status: ${interrupted?.status}`);
    console.log(`  run /write-blog next to resume\n`);
  }

  // Setup timeout
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timeoutHandle: NodeJS.Timeout | null = null;
  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);
  }

  // Check for existing session to resume
  const existingSessionId = options.resumeSession ? await getSessionId(cwd) : null;

  // Create audit hooks for file operation monitoring
  const auditHooks = createPostToolUseHooks(cwd, existingSessionId || undefined);

  const result = query({
    prompt,
    options: {
      cwd,
      maxTurns: options.maxTurns || 50,
      systemPrompt: getSystemPrompt(),
      agents: createSubagents(),
      mcpServers: getMcpServers(),
      settingSources: ['project'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      abortController,
      allowedTools: [
        'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob',
        'Skill', 'Task',
        'mcp__supabase__*'
      ],
      // Add audit logging hooks for file operations
      hooks: {
        PostToolUse: auditHooks
      },
      // Resume existing session if available - this maintains context
      ...(existingSessionId ? { resume: existingSessionId } : {})
    }
  });

  return { result, cwd, abortController, timeoutHandle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Labels for UI - Claude Code style: ToolName(argument)
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolLabel {
  name: string;      // Display name (e.g., "Read", "Update", "Search")
  argument?: string; // Optional argument to show in parentheses
}

function getToolLabel(toolName: string, input?: Record<string, unknown>): string {
  const label = getToolLabelStructured(toolName, input);
  return label.argument ? `${label.name}(${label.argument})` : label.name;
}

export function getToolLabelStructured(toolName: string, input?: Record<string, unknown>): ToolLabel {
  // File operations with path
  if (toolName === 'Read') {
    const path = input?.file_path || input?.path;
    return { name: 'Read', argument: path ? getRelativePath(String(path)) : undefined };
  }
  if (toolName === 'Write') {
    const path = input?.file_path || input?.path;
    return { name: 'Write', argument: path ? getRelativePath(String(path)) : undefined };
  }
  if (toolName === 'Edit') {
    const path = input?.file_path || input?.path;
    return { name: 'Update', argument: path ? getRelativePath(String(path)) : undefined };
  }

  // Commands
  if (toolName === 'Bash') {
    const cmd = input?.command as string | undefined;
    if (cmd) {
      if (cmd.includes('perplexity')) return { name: 'Search', argument: 'web' };
      if (cmd.includes('firecrawl')) return { name: 'Scrape', argument: 'URL' };
      if (cmd.includes('tsx')) return { name: 'Run', argument: 'script' };
      return { name: 'Bash', argument: truncate(cmd, 30) };
    }
    return { name: 'Bash' };
  }

  // Search
  if (toolName === 'Grep') {
    const pattern = input?.pattern as string | undefined;
    return { name: 'Search', argument: pattern ? truncate(pattern, 20) : 'files' };
  }
  if (toolName === 'Glob') {
    const pattern = input?.pattern as string | undefined;
    return { name: 'Glob', argument: pattern ? truncate(pattern, 20) : undefined };
  }

  // Task delegation
  if (toolName === 'Task') {
    const agent = input?.agent as string | undefined;
    return { name: 'Task', argument: agent };
  }

  // Skill
  if (toolName === 'Skill') {
    const skill = input?.skill as string | undefined;
    return { name: 'Skill', argument: skill };
  }

  // MCP tools
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    const server = parts[1] || 'mcp';
    const tool = parts[2] || 'tool';

    if (server === 'supabase') {
      if (tool === 'execute_sql') return { name: 'Query', argument: 'database' };
      if (tool === 'list_tables') return { name: 'List', argument: 'tables' };
      return { name: 'Supabase', argument: tool.replace(/_/g, ' ') };
    }
    return { name: capitalize(server), argument: tool };
  }

  return { name: capitalize(toolName) };
}

function getRelativePath(path: string): string {
  // Convert absolute path to relative from project root
  const cwd = process.cwd();
  if (path.startsWith(cwd)) {
    return path.slice(cwd.length + 1); // Remove cwd + leading slash
  }
  // If not in cwd, show shortened path
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return parts.slice(-3).join('/');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncatePath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  const file = parts[parts.length - 1];
  return `.../${file}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Message Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StreamMessage {
  type:
    | 'text'           // Complete text response
    | 'stream'         // Streaming text chunk
    | 'thinking'       // Thinking block (full)
    | 'thinking_stream'// Streaming thinking
    | 'thinking_end'   // Thinking finished
    | 'tool_start'     // Tool invocation started
    | 'tool_result'    // Tool completed successfully
    | 'tool_error'     // Tool failed
    | 'subagent_start' // Subagent task started
    | 'subagent_end'   // Subagent task completed
    | 'success'        // Agent completed
    | 'error'          // Agent error
    | 'system'         // System message
    | 'init'           // Session initialized
    | 'auth'           // Auth status
    | 'usage';         // Token usage update
  content: string;
  metadata?: {
    tool?: string;
    toolId?: string;
    input?: Record<string, unknown>;
    agent?: string;
    agentType?: string;      // Subagent type (e.g., 'web-researcher')
    description?: string;    // Short description from Task input
    task?: string;
    batchId?: string;        // Groups parallel subagents
    isSubagentTool?: boolean;
    isError?: boolean;
    sessionId?: string;
    resultText?: string;
    // Usage data
    inputTokens?: number;
    outputTokens?: number;
    totalCostUsd?: number;
    contextWindow?: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function* streamAgent(prompt: string, options: {
  cwd?: string;
  maxTurns?: number;
  resumeSession?: boolean;
  timeoutMs?: number;
  abortController?: AbortController;
} = {}): AsyncGenerator<StreamMessage> {
  const { result, cwd, abortController, timeoutHandle } = await runAgent(prompt, options);

  // Helper to clear timeout when done
  const clearTimeoutIfSet = () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  };

  // Track session ID for persistence
  let capturedSessionId: string | null = null;

  // Track state
  let currentSubagent: string | null = null;
  let isThinking = false;
  let currentBatchId: string | null = null;

  // Track active tools by ID so we can match results
  const activeTools = new Map<string, { name: string; label: string; startTime: number; isSubagentTool: boolean; input?: Record<string, unknown> }>();

  // Track active subagents for parallel grouping
  const activeSubagents = new Map<string, { description: string; agentType: string; batchId: string }>();

  try {
  for await (const message of result) {
    const msg = message as Record<string, unknown>;
    
    switch (msg.type) {
      case 'assistant': {
        const assistantMsg = msg.message as Record<string, unknown> | undefined;
        const content = assistantMsg?.content;

        // Reset batch ID for new assistant message - parallel Tasks get same batch
        currentBatchId = null;

        if (Array.isArray(content)) {
          for (const block of content) {
            const b = block as Record<string, unknown>;
            
            // Text content
            if (b.type === 'text' && typeof b.text === 'string') {
              // End thinking before text
              if (isThinking) {
                isThinking = false;
                yield { type: 'thinking_end', content: '' };
              }
              yield { type: 'text', content: b.text };
            }
            
            // Thinking content
            else if (b.type === 'thinking' && typeof b.thinking === 'string') {
              // Only show thinking when NOT in subagent context
              if (!currentSubagent) {
                isThinking = true;
                yield { type: 'thinking', content: b.thinking };
              }
            }
            
            // Tool use
            else if (b.type === 'tool_use') {
              // End thinking before tool
              if (isThinking) {
                isThinking = false;
                yield { type: 'thinking_end', content: '' };
              }

              const toolName = b.name as string || 'tool';
              const toolId = b.id as string || `tool-${Date.now()}`;
              const input = b.input as Record<string, unknown> | undefined;

              // Check if this is a Task (subagent delegation)
              if (toolName === 'Task' && (input?.subagent_type || input?.agent)) {
                // Extract subagent info - SDK uses subagent_type, fallback to agent
                const agentType = (input.subagent_type || input.agent) as string;
                const description = (input.description || agentType) as string;

                // Generate batch ID for grouping parallel subagents
                // All Tasks in same message block get same batchId
                if (!currentBatchId) {
                  currentBatchId = `batch-${Date.now()}`;
                }

                currentSubagent = agentType;

                // Store subagent info for later matching
                activeSubagents.set(toolId, {
                  description,
                  agentType,
                  batchId: currentBatchId
                });

                // Store the task tool
                activeTools.set(toolId, {
                  name: toolName,
                  label: `delegating to ${agentType}`,
                  startTime: Date.now(),
                  isSubagentTool: false
                });

                yield {
                  type: 'subagent_start',
                  content: description,
                  metadata: {
                    agent: agentType,
                    agentType,
                    description,
                    task: input.prompt as string,
                    toolId,
                    batchId: currentBatchId
                  }
                };
              } else {
                // Regular tool - suppress if inside subagent
                const label = getToolLabel(toolName, input);
                const isSubagentTool = !!currentSubagent;

                activeTools.set(toolId, {
                  name: toolName,
                  label,
                  startTime: Date.now(),
                  isSubagentTool,
                  input
                });
                
                // Only emit tool_start for orchestrator tools, not subagent internals
                if (!isSubagentTool) {
                  yield { 
                    type: 'tool_start', 
                    content: label,
                    metadata: { 
                      tool: toolName, 
                      toolId,
                      input,
                      isSubagentTool: false
                    }
                  };
                }
              }
            }
          }
        } else if (typeof content === 'string' && content) {
          if (isThinking) {
            isThinking = false;
            yield { type: 'thinking_end', content: '' };
          }
          yield { type: 'text', content };
        }
        break;
      }

      case 'user': {
        const userMsg = msg.message as Record<string, unknown> | undefined;
        const content = userMsg?.content;
        
        if (Array.isArray(content)) {
          for (const block of content) {
            const b = block as Record<string, unknown>;
            
            if (b.type === 'tool_result') {
              const toolId = b.tool_use_id as string;
              const isError = b.is_error as boolean;
              const resultContent = b.content;
              
              // Get stored tool info
              const toolInfo = activeTools.get(toolId);
              activeTools.delete(toolId);
              
              // Extract result text
              let resultText = '';
              if (Array.isArray(resultContent)) {
                resultText = (resultContent as Array<Record<string, unknown>>)
                  .filter(r => r.type === 'text')
                  .map(r => String(r.text || '').slice(0, 300))
                  .join('\n');
              } else if (typeof resultContent === 'string') {
                resultText = resultContent.slice(0, 300);
              }
              
              // Check if this is a Task tool completing (subagent done)
              if (toolInfo?.name === 'Task') {
                const subagentInfo = activeSubagents.get(toolId);
                activeSubagents.delete(toolId);

                yield {
                  type: 'subagent_end',
                  content: subagentInfo?.description || currentSubagent || 'subagent',
                  metadata: {
                    agent: subagentInfo?.agentType || currentSubagent || undefined,
                    agentType: subagentInfo?.agentType,
                    description: subagentInfo?.description,
                    batchId: subagentInfo?.batchId,
                    toolId,
                    isError
                  }
                };

                // Only clear currentSubagent if no more active subagents
                if (activeSubagents.size === 0) {
                  currentSubagent = null;
                  currentBatchId = null;
                }
              }
              // Only emit tool_result for orchestrator tools
              else if (!toolInfo?.isSubagentTool) {
                yield {
                  type: isError ? 'tool_error' : 'tool_result',
                  content: toolInfo?.label || 'tool',
                  metadata: {
                    toolId,
                    tool: toolInfo?.name,
                    isError,
                    resultText,
                    input: toolInfo?.input
                  }
                };
              }
            }
          }
        }
        break;
      }

      case 'stream_event': {
        const streamType = msg.stream_type as string;
        const content = msg.content as string;
        
        if (streamType === 'text' && content) {
          if (isThinking) {
            isThinking = false;
            yield { type: 'thinking_end', content: '' };
          }
          yield { type: 'stream', content };
        } else if (streamType === 'thinking' && content) {
          // Only show thinking when NOT in subagent context
          if (!currentSubagent) {
            isThinking = true;
            yield { type: 'thinking_stream', content };
          }
        }
        break;
      }

      case 'result': {
        // Extract usage data
        const usage = msg.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        const modelUsage = msg.modelUsage as Record<string, { contextWindow?: number }> | undefined;
        const totalCostUsd = msg.total_cost_usd as number | undefined;

        // Get context window from first model
        let contextWindow = 200000; // Default for Sonnet
        if (modelUsage) {
          const firstModel = Object.values(modelUsage)[0];
          if (firstModel?.contextWindow) {
            contextWindow = firstModel.contextWindow;
          }
        }

        // Emit usage update
        if (usage) {
          yield {
            type: 'usage',
            content: '',
            metadata: {
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
              totalCostUsd: totalCostUsd || 0,
              contextWindow
            }
          };
        }

        if (msg.subtype === 'success') {
          yield { type: 'success', content: (msg.result as string) || 'completed' };
        } else if (msg.subtype === 'error_during_execution') {
          const error = msg.error as Record<string, unknown> | undefined;
          yield {
            type: 'error',
            content: (error?.message as string) || 'execution failed'
          };
        }
        break;
      }

      case 'system': {
        if (msg.subtype === 'init') {
          // Capture session ID for persistence
          const sessionId = msg.session_id as string | undefined;
          if (sessionId) {
            capturedSessionId = sessionId;
            // Fire and forget - don't await to avoid blocking the stream
            saveSession(cwd, { sessionId }).catch(err => {
              console.error('[session] Failed to save session:', err);
            });
          }

          // Check MCP server status
          const mcpServers = msg.mcp_servers as Array<{ name: string; status: string }> | undefined;
          if (mcpServers) {
            const failedServers = mcpServers.filter(s => s.status !== 'connected');
            if (failedServers.length > 0) {
              yield {
                type: 'error',
                content: `MCP servers failed to connect: ${failedServers.map(s => `${s.name} (${s.status})`).join(', ')}`
              };
            }
          }

          const slashCommands = msg.slash_commands as string[] | undefined;
          yield {
            type: 'init',
            content: `session ready | commands: ${slashCommands?.join(', ') || '/help'}`,
            metadata: { sessionId: capturedSessionId || undefined }
          };
        } else if (msg.subtype === 'compact_boundary') {
          yield { type: 'system', content: 'context compacted' };
        }
        break;
      }

      case 'auth_status': {
        const status = msg.status as string;
        if (status !== 'authorized') {
          yield { type: 'auth', content: `auth: ${status}` };
        }
        break;
      }
    }
  }
  } catch (error) {
    // Handle timeout/abort
    if (error instanceof Error && error.name === 'AbortError') {
      yield {
        type: 'error',
        content: 'Operation timed out. The agent was stopped after exceeding the time limit.'
      };
    } else {
      // Re-throw other errors
      throw error;
    }
  } finally {
    // Always clear the timeout when done
    clearTimeoutIfSet();
  }
}

export { createSubagents, getMcpServers, getSystemPrompt, PROJECT_ROOT };

// Re-export session utilities for UI
export {
  loadSession,
  saveSession,
  clearSession,
  getSessionId,
  hasValidSession,
  touchSession,
  startHeartbeat,
  getSessionHealth,
  archiveSession,
  listSessions,
  getSessionFromHistory,
  renameSession,
  updateSessionStats,
  getTimeAgo,
  type SessionHistoryEntry
} from './session.js';
