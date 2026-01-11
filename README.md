# Leo

> AI-powered blog writing agent that creates SEO-optimized content with Claude

[![npm version](https://img.shields.io/npm/v/@anthropic/leo.svg)](https://www.npmjs.com/package/@anthropic/leo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Leo handles the entire content creation pipeline: keyword research, competitor analysis, content writing, image generation, and CMS publishing. Built with Claude and designed for developers who want to automate their blog content workflow.

## Why Use Leo?

- **Automated Research** - Analyzes top-ranking competitors and current web data
- **SEO-Optimized** - Generates content structured for search rankings
- **Multi-Agent Architecture** - Specialized agents for research, writing, and images
- **Flexible Publishing** - Sanity CMS or local markdown files
- **Configurable Style** - Customize voice, tone, and visual design
- **Local-First** - Works entirely on your machine with your API keys

## Installation

```bash
npm install -g @anthropic/leo
```

Or run directly without installing:

```bash
npx @anthropic/leo
```

## Quick Start

### 1. Run the Setup Wizard

```bash
leo
```

Leo guides you through interactive setup on first run:
- Blog name, niche, and URL
- Target audience description
- Writing style preferences
- CMS choice (Sanity or local markdown)

### 2. Add Your API Key

The setup wizard will prompt for your Claude API key. You can also configure it later:

```bash
leo settings
```

Get your key from [console.anthropic.com](https://console.anthropic.com/settings/keys)

### 3. Write Your First Article

```bash
leo write "how to start a blog in 2025"
```

Leo will:
1. Research the keyword and competitors
2. Analyze top-ranking content
3. Write an SEO-optimized article
4. Generate image specifications
5. Save to your configured CMS

## Examples

### Write a Single Article

```bash
leo write "best productivity apps for developers"
```

### Manage Your Keyword Queue

```bash
# Add keywords to your queue
leo queue add "react performance optimization"
leo queue add "typescript best practices"

# Check queue status
leo queue status

# Write the next queued keyword
leo write next
```

### Interactive Mode Commands

Inside Leo's interactive mode, use slash commands:

```
/write-blog seo tips for startups   # Research and write article
/queue-status                        # View pending keywords
/publish my-article-slug             # Publish to CMS
/settings                            # Configure API keys
/cost                                # Show session costs
```

### Configuration Example

Leo stores settings in `leo.config.json`:

```json
{
  "blog": {
    "name": "Dev Insights",
    "niche": "technology",
    "targetAudience": "software developers",
    "brandVoice": "technical and precise",
    "baseUrl": "https://devinsights.io"
  },
  "cms": {
    "provider": "local"
  },
  "author": {
    "name": "Jane Developer"
  }
}
```

## Commands

| Command | Description |
|---------|-------------|
| `leo` | Start interactive mode |
| `leo write [keyword]` | Write article for keyword |
| `leo write next` | Write next queued keyword |
| `leo queue status` | Show queue statistics |
| `leo queue add "kw"` | Add keyword to queue |
| `leo settings` | Configure API keys |
| `leo reset` | Reset config for fresh start |
| `leo update` | Update to latest version |

## How It Works

Leo orchestrates specialized agents in a multi-phase workflow:

```
Leo (Orchestrator)
 ├─ DataForSEO     → SERP data and competitor URLs
 ├─ Web Researcher → Current information via Perplexity
 ├─ Competitor Scraper → Top-ranking content via Firecrawl
 ├─ Content Analyzer → Patterns, gaps, and opportunities
 ├─ Content Writer → SEO-optimized article (Claude Opus)
 └─ Image Creator → Image specs and generation
```

Each phase builds on the previous, creating comprehensive, well-researched content.

## API Keys

| Key | Purpose | Required |
|-----|---------|----------|
| `ANTHROPIC_API_KEY` | Claude access | Yes |
| `DATAFORSEO_LOGIN/PASSWORD` | SERP data | No |
| `PERPLEXITY_API_KEY` | Web research | No |
| `FIRECRAWL_API_KEY` | Page scraping | No |
| `OPENROUTER_API_KEY` | Image generation | No |
| `SANITY_API_KEY` | CMS publishing | No |

Create a `.env` file:

```bash
ANTHROPIC_API_KEY=sk-ant-...
DATAFORSEO_LOGIN=your@email.com
DATAFORSEO_PASSWORD=your-password
PERPLEXITY_API_KEY=pplx-...
```

## Publishing Options

### Local Markdown (Default)

Articles save to your project:
- `./drafts/{slug}.md` - Article content
- `./images/{slug}/` - Generated images
- `./drafts/{slug}-images.json` - Image metadata

### Sanity CMS

Configure in `leo.config.json`:

```json
{
  "cms": {
    "provider": "sanity",
    "sanity": {
      "projectId": "your-project-id",
      "dataset": "production"
    }
  }
}
```

## Development

```bash
git clone https://github.com/BlockchainHB/leo-cli.git
cd leo-cli
npm install
npm run dev
```

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT

---

Built with [Claude](https://claude.ai) and [Ink](https://github.com/vadimdemedes/ink)
