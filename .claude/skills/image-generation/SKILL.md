---
description: "Use this skill when creating images for blog posts, generating hero images, section illustrations, or any visual content. Triggers on: create image, generate image, hero image, blog images, illustrations, visual content."
---

# Image Generation for Blog Posts

This skill provides patterns for generating and managing images for blog posts. **Every image MUST have an associated metadata file with alt text and caption.**

## CRITICAL: Read Configuration First

Before creating images, read `leo.config.json` to get imageStyle preferences:

```json
{
  "imageStyle": {
    "style": "3D isometric illustration",
    "background": "white background",
    "colorPalette": "pastel colors (mint, lavender, coral)",
    "theme": "modern clean aesthetic"
  }
}
```

If imageStyle is not specified, use these defaults:
- **Style**: 3D Isometric Illustration
- **Background**: Light (white, off-white, very light gray)
- **Palette**: Pastel colors (soft mint, lavender, coral, peach)
- **Lighting**: Bright, airy, soft shadows
- **Mood**: Clean, modern, friendly, approachable

## Image Requirements

Each blog post needs:
- **1 Hero image** (1200x675px, 16:9) - appears at top
- **3-4 Section images** (1200x800px, 3:2) - support key points
- **Metadata file** with alt text + captions

## Directory Structure

```
images/
└── {slug}/
    ├── hero.png
    ├── comparison.png
    ├── workflow.png
    └── cost-breakdown.png

drafts/
└── {slug}-images.json    # Metadata file (REQUIRED)
```

## Image Metadata File (REQUIRED)

**ALWAYS create `./drafts/{slug}-images.json`:**

```json
{
  "slug": "your-topic-slug",
  "createdDate": "2025-12-06",
  "primaryKeyword": "your keyword",
  "totalImages": 5,

  "style": {
    "source": "leo.config.json or defaults",
    "style": "3D isometric illustration",
    "background": "white/light background",
    "colorPalette": "pastel (mint, lavender, coral)",
    "theme": "modern, clean, professional"
  },

  "hero": {
    "filename": "hero.png",
    "path": "./images/{slug}/hero.png",
    "prompt": {
      "mainSubject": "Main visual concept",
      "foreground": "Primary elements",
      "midground": "Supporting elements",
      "background": "Light, clean background",
      "style": "3D isometric illustration",
      "colors": "Pastel palette",
      "lighting": "Soft overhead, bright and airy",
      "camera": "Isometric view",
      "mood": "Professional, modern, approachable",
      "details": "Specific required elements",
      "negative": "photorealistic, dark, cluttered, harsh shadows"
    },
    "promptString": "Full combined prompt string...",
    "alt": "Descriptive alt text with keyword",
    "caption": "Caption that adds value beyond the image"
  },
  "sections": [
    {
      "name": "comparison",
      "filename": "comparison.png",
      "path": "./images/{slug}/comparison.png",
      "prompt": {...},
      "promptString": "...",
      "alt": "Side-by-side comparison description",
      "caption": "Caption explaining the comparison",
      "placement": "After H2: Section Heading Text"
    }
  ]
}
```

## Alt Text Guidelines

**Good alt text:**
- Describes what the image shows
- Is 125 characters or less
- Includes relevant context
- Does NOT start with "Image of" or "Picture of"

**Examples:**
```
✓ "Dashboard showing monthly revenue breakdown and key metrics"
✗ "Image of a dashboard"
✗ "Dashboard"
✗ "A really detailed dashboard showing lots of data about profits and metrics with charts"
```

## Caption Guidelines

Captions should:
- Add value beyond the image
- Match the article's conversational tone
- Be 1-2 sentences max
- Help readers understand why the visual matters

## Complete Image Workflow (TWO STEPS!)

### Step 1: Generate images locally

**⚠️ ALWAYS USE THE SCRIPT DIRECTLY - DO NOT TRY MODULE IMPORTS:**

```bash
npx tsx src/servers/images/generateImages.ts generate SLUG_HERE
```

**IMPORTANT**: Do NOT try to import the images module or use inline TypeScript with `npx tsx -e`. The module has .js extension issues when loaded. Always use the script command above - it works reliably every time.

Features:
- **Pre-flight check**: Validates API key and credits before starting
- **Parallel generation**: Generates multiple images concurrently
- **Resume support**: Automatically resumes if interrupted
- **Progress display**: Real-time status updates

Options:
- `--skip-preflight`: Skip credit check (for testing)
- `--force`: Regenerate all images (ignore state file)
- `preflight SLUG`: Check credits without generating

### Step 2: Publish to CMS

**For Sanity CMS:**
```bash
npx tsx src/servers/sanity/publishDraft.ts SLUG_HERE
```

This **ONE command** handles EVERYTHING:
1. Inserts image markdown into draft (if not already done)
2. Uploads hero image to Sanity
3. Uploads all section images to Sanity
4. Builds the `bodyImages` map automatically
5. Creates the post with all images properly linked

Options:
- `--dry-run` or `-n`: Preview without uploading
- `--publish` or `-p`: Publish immediately (default: draft)

**For Local Markdown:**
Images are already in `./images/{slug}/`. The draft at `./drafts/{slug}.md` can reference them directly.

**⚠️ NO LONGER NEEDED (handled automatically by publishDraft):**
- ~~insertImagesIntoDraft~~ - built into publishDraft
- ~~uploadImage for each image~~ - built into publishDraft
- ~~buildBodyImagesMap~~ - built into publishDraft
- ~~createPost with bodyImages~~ - built into publishDraft

**Requirements:**
- `OPENROUTER_API_KEY` in .env (for image generation)
- `SANITY_API_KEY` or `SANITY_API_TOKEN` in .env (for Sanity CMS)
- Image specs: `./drafts/{slug}-images.json`

## Using Images in Sanity

**Just use the unified command - it handles everything:**

```bash
npx tsx src/servers/sanity/publishDraft.ts SLUG
```

This automatically:
- Reads image metadata from `./drafts/{slug}-images.json`
- Uploads hero and all section images
- Inserts image markdown into draft
- Creates post with all images linked

For low-level access, see `sanity-cms` skill.

## Structured Prompt Format

Use this structured format for AI-ready prompts:

```json
{
  "prompt": {
    "mainSubject": "What is the primary focus of the image",
    "foreground": "Detailed description of main elements in front",
    "midground": "Supporting elements and context",
    "background": "Environment, setting (use style from config)",
    "style": "From config: e.g., 3D isometric illustration",
    "colors": "From config: e.g., pastel palette",
    "lighting": "Soft overhead lighting, bright and airy",
    "camera": "Isometric view, 30-degree angle",
    "mood": "From config: e.g., Professional, modern",
    "details": "Specific elements that must be visible",
    "negative": "photorealistic, dark, cluttered, harsh shadows"
  }
}
```

### Converting to promptString

Combine all fields into a single AI-ready prompt:

```
[style], [mainSubject], [foreground], [midground], [background],
[colors], [lighting], [camera], [mood], [details],
negative: [negative prompts]
```

## Checklist Before Publishing

- [ ] Hero image exists at `./images/{slug}/hero.png`
- [ ] All section images exist
- [ ] Metadata file exists at `./drafts/{slug}-images.json`
- [ ] Every image has alt text
- [ ] Every image has a caption
- [ ] Alt text is under 125 characters
- [ ] Captions add value (not just repeat alt)
- [ ] **Background is light (white/off-white)**
- [ ] **Style matches leo.config.json preferences**
