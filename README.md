# Leo - AI Blog Writing Agent

Leo is an AI-powered CLI tool that helps you create SEO-optimized blog content using Claude. It handles the entire content creation pipeline: keyword research, competitor analysis, content writing, image generation, and CMS publishing.

## Features

- **AI-Powered Writing**: Uses Claude to generate high-quality, SEO-optimized blog posts
- **Competitor Analysis**: Scrapes and analyzes top-ranking content for any keyword
- **SERP Research**: Integrates with DataForSEO for keyword and ranking data
- **Multi-Agent Workflow**: Orchestrates specialized agents for research, writing, and image creation
- **Flexible CMS**: Publish to Sanity CMS or save as local markdown files
- **Customizable Style**: Configure your blog's voice, tone, and visual style
- **Local Keyword Queue**: Manage your content pipeline without external dependencies

## Installation

```bash
# Install globally
npm install -g @anthropic/leo

# Or run directly with npx
npx @anthropic/leo
```

## Quick Start

### 1. First Run Setup

When you first run Leo, you'll be guided through an interactive setup:

```bash
leo
```

This will ask you about:
- Your blog name and niche
- Target audience
- Brand voice/tone
- Publishing preferences (Sanity CMS or local markdown)
- Image style preferences

### 2. Configure API Keys

After setup, configure your API keys:

```bash
leo settings
```

**Required:**
- `ANTHROPIC_API_KEY` - Your Claude API key ([Get one here](https://console.anthropic.com/settings/keys))

**Optional but recommended:**
- `DATAFORSEO_LOGIN/PASSWORD` - For SERP data and competitor analysis
- `PERPLEXITY_API_KEY` - For web research
- `FIRECRAWL_API_KEY` - For competitor page scraping
- `OPENROUTER_API_KEY` - For image generation
- `SANITY_API_KEY` - For Sanity CMS publishing

### 3. Add Keywords

```bash
# Add a single keyword
leo queue add "how to start a blog"

# Import from file (one keyword per line)
leo queue import keywords.txt

# View queue status
leo queue status
```

### 4. Write Content

```bash
# Write a blog post for a specific keyword
leo write "how to start a blog"

# Write the next keyword in queue
leo write next

# Batch process multiple keywords
leo super-leo 5
```

## Configuration

Leo stores your configuration in `leo.config.json`:

```json
{
  "version": "1.0",
  "blog": {
    "name": "My Tech Blog",
    "niche": "technology",
    "targetAudience": "developers and tech enthusiasts",
    "brandVoice": "professional yet approachable",
    "baseUrl": "https://myblog.com"
  },
  "cms": {
    "provider": "local"
  },
  "queue": {
    "provider": "local"
  },
  "author": {
    "name": "Your Name"
  },
  "categories": [
    { "slug": "tutorials", "name": "Tutorials" },
    { "slug": "guides", "name": "Guides" }
  ]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `leo` | Start Leo (runs setup on first use) |
| `leo write [keyword]` | Write a blog post for a keyword |
| `leo write next` | Write the next pending keyword |
| `leo queue status` | Show keyword queue statistics |
| `leo queue add "keyword"` | Add a keyword to the queue |
| `leo queue list` | List pending keywords |
| `leo settings` | Configure API keys |
| `leo update` | Update Leo to the latest version |
| `leo help` | Show all commands |

### Interactive Commands (inside Leo)

| Command | Description |
|---------|-------------|
| `/write-blog [keyword]` | Full research and writing workflow |
| `/queue-status` | Show queue statistics |
| `/publish [slug]` | Publish a draft |
| `/settings` | Open API key configuration |
| `/clear` | Clear conversation |
| `/cost` | Show session cost breakdown |

## Workflow

Leo uses a multi-phase workflow to create content:

1. **Keyword Research**: Gets SERP data and competitor URLs
2. **Web Research**: Gathers current information via Perplexity
3. **Competitor Scraping**: Analyzes top-ranking content
4. **Content Analysis**: Identifies patterns, gaps, and opportunities
5. **Article Writing**: Generates SEO-optimized content
6. **Image Creation**: Generates image specifications and images
7. **Publishing**: Publishes to CMS or saves locally

## Publishing Options

### Local Markdown (Default)

By default, Leo saves articles as markdown files:
- Articles: `./drafts/{slug}.md`
- Images: `./images/{slug}/`
- Image specs: `./drafts/{slug}-images.json`

### Sanity CMS

To publish to Sanity CMS:

1. Set `cms.provider` to `"sanity"` in `leo.config.json`
2. Configure your Sanity project ID and dataset
3. Add your `SANITY_API_KEY` to environment variables

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

## Updating

Leo includes a built-in update command that preserves your configuration:

```bash
# Check for updates
leo update check

# Update to latest version
leo update
```

## Environment Variables

Create a `.env` file in your project directory:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Research (Optional)
DATAFORSEO_LOGIN=your@email.com
DATAFORSEO_PASSWORD=your-password
PERPLEXITY_API_KEY=pplx-...
FIRECRAWL_API_KEY=fc-...

# Publishing (Optional)
OPENROUTER_API_KEY=sk-or-...
SANITY_API_KEY=sk...
SANITY_PROJECT_ID=your-project
SANITY_DATASET=production
```

## Architecture

Leo is built on the Claude Agent SDK and uses a multi-agent architecture:

```
Leo (Orchestrator)
├── Web Researcher (Perplexity)
├── Competitor Scraper (Firecrawl)
├── Competitor Analyzer
├── Content Writer (Claude Opus)
└── Image Creator
```

Each subagent specializes in a specific task and reports back to Leo for orchestration.

## Development

```bash
# Clone the repository
git clone https://github.com/anthropics/leo.git
cd leo

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build
```

## License

MIT

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- [GitHub Issues](https://github.com/anthropics/leo/issues)
- [Documentation](https://github.com/anthropics/leo/wiki)
