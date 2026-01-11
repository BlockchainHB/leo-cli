---
name: blog-writing
description: Complete knowledge base for writing SEO-optimized blog posts. Includes writing style templates, SEO guidelines, and content structure. Customized based on user's leo.config.json.
---

# Blog Writing Skill

This skill contains everything needed to write high-quality, SEO-optimized blog posts. It dynamically uses the user's configuration from `leo.config.json`.

## Dynamic Configuration

**IMPORTANT**: Before writing any content, read `leo.config.json` to get:
- Blog name, niche, and target audience
- Brand voice and writing style preferences
- Categories and internal links
- Image style preferences

## Writing Style Guide

### Voice and Tone

Adapt to the user's configured `brandVoice`. General principles:

- **Confident**: No hedging. Say "this works" not "this might work"
- **Action-oriented**: Every section should have a takeaway
- **Human**: Conversational but professional. Short sentences.
- **Audience-focused**: Write for the configured `targetAudience`

### Formatting Rules

**DO:**
- Short paragraphs (2-3 sentences max)
- Question-led H2 headers ("How Does X Work?")
- Bullet points for lists of 3+ items
- **Comparison lists** for feature comparisons (NOT tables)
- Bold for key terms on first use
- Internal links to other blog content

**DON'T:**
- Use em dashes (—) ever. Use commas, periods, or parentheses.
- **Use markdown tables** (many CMS don't support them)
- Write walls of text
- Use passive voice excessively
- Include fluff or filler content
- Over-promise results

### Comparison Format (Instead of Tables)

When comparing features or options, use this format:

```markdown
**Option A:**
- Cost: $100/month
- Difficulty: Easy
- Best For: Beginners

**Option B:**
- Cost: $200/month
- Difficulty: Medium
- Best For: Advanced users
```

Or use a bulleted comparison:

```markdown
- **Primary Function**: A (storage) vs B (processing)
- **Cost**: A ($100) vs B ($200)
- **Best For**: A (beginners) vs B (experts)
```

### Word Count Guidelines

**Traditional SEO (Rank in Search):**
- Pillar Guide: 5,000-8,000 words
- How-To: 2,000-3,000 words
- Comparison: 2,500-4,000 words
- Listicle: 2,000-3,000 words

**GEO/AI Search (Get Cited by AI):**
- Definition Page: 500-1,000 words
- Data/Research: 1,000-2,000 words
- Expert Take: 800-1,500 words
- Structured FAQ: 1,000-2,000 words

## Blog Post Template

### 1. Hook and Promise (100-150 words)

Open with a pain point or common misconception. Promise what the reader will learn.

```markdown
Most people think [misconception].

It doesn't have to be that way.

[Reframe the problem and introduce the solution]

In this guide, you'll learn:
- [Key takeaway 1]
- [Key takeaway 2]
- [Key takeaway 3]
```

### 2. Quick Facts Bar (Optional)

For data-heavy topics, add a callout block with key stats.

```markdown
> **Quick Facts**
> - [Stat 1]
> - [Stat 2]
> - [Stat 3]
```

### 3. Core Concept (400-600 words)

Define the topic. Explain why it matters now.

```markdown
## What Is [Topic]?

[Clear definition in 1-2 sentences]

### Why [Topic] Matters in [Year]

[Current context, trends, changes]

### The [Solution/Approach]

[How to approach this topic]
```

### 4. Step-by-Step Guide (800-1500 words)

Numbered steps with clear instructions.

```markdown
## How to [Achieve Goal]: Step-by-Step

### Step 1: [Action]

[2-3 sentences explaining the step]

### Step 2: [Action]

[Instructions with specific details]
```

### 5. Comparison or Case Study (Optional, 400-600 words)

Use for topics with alternatives or success stories. **DO NOT use tables.**

```markdown
## [Option A] vs [Option B]: Which Is Right for You?

**[Option A]:**
- Cost: $
- Difficulty: Easy
- Best For: Beginners

**[Option B]:**
- Cost: $$
- Difficulty: Medium
- Best For: Scale
```

### 6. Pro Tips (200-400 words)

Quick wins for experienced readers.

```markdown
## Pro Tips for [Topic]

1. **[Tip Name]**: [Explanation]
2. **[Tip Name]**: [Explanation]
3. **[Tip Name]**: [Explanation]
```

### 7. FAQ Section (200-400 words)

4-6 questions. Use schema-friendly formatting.

```markdown
## FAQ: [Topic]

**Q: [Common question]?**

A: [Concise answer in 2-3 sentences]

**Q: [Common question]?**

A: [Concise answer]
```

### 8. Conclusion and CTA (100-150 words)

Summarize key points. Call to action.

```markdown
## Start [Action] Today

[Summarize the main takeaway in 1-2 sentences]

[Connect to the reader's goals]

**[CTA Button Text]**: [Link]
```

## SEO Guidelines

### Title Format
- Include primary keyword near the beginning
- Add year for evergreen content: "(2025)"
- Keep under 60 characters
- Pattern: "[Primary Keyword]: [Benefit/Promise] (Year)"

### Meta Description
- 150-160 characters
- Include primary keyword
- End with implicit CTA
- Pattern: "[Answer to user intent]. [What they'll learn]. [Subtle CTA]."

### Keyword Placement
- Primary keyword in: title, first 100 words, 1+ H2, meta description
- Secondary keywords: distributed naturally in H3s and body
- LSI keywords: related terms throughout

### Internal Linking (WRITER'S RESPONSIBILITY)

**The content-writer subagent MUST include 3-5 internal links.**

Read `leo.config.json` for available internal links. Link naturally:

> If you're new to this topic, check out our [Beginner's Guide](/blog/getting-started) first.

> Before making a decision, use our [comparison tool](/tools/compare) to evaluate options.

**Linking rules:**
- First internal link within first 500 words
- Natural anchor text (not "click here")
- Final CTA links appropriately

### External Linking
- Link to authoritative sources only
- Industry reports, official documentation
- Academic or government sources when relevant
- No links to direct competitors

## Image Guidelines

### Visual Style

Read `leo.config.json` for the user's preferred `imageStyle`. Default:
- Clean, professional imagery
- Light backgrounds preferred
- Consistent style throughout article

### Hero Images
- Wide aspect ratio (16:9)
- More detailed, cinematic composition

### Section Images
- Consistent style
- Focused on specific concepts
- Clean backgrounds

### Alt Text
- Descriptive (not just "image")
- Include relevant keywords naturally
- Describe what's shown, not artistic interpretation

## Example Hook Openings

**Pain Point Opening:**
```
Everyone says [topic] is easy.

They're wrong.

It only becomes easy after you understand [key concept]. Here's what they don't tell you...
```

**Misconception Opening:**
```
The biggest mistake people make? Thinking [misconception].

In reality, the opposite is often true...
```

**Question Opening:**
```
How do successful [people/companies] consistently [achieve goal] while others struggle?

It's not luck. It's a system...
```

**Statistic Opening:**
```
[X]% of [attempts] fail in their first year.

But here's the thing: most of those failures were preventable...
```

## Content Personalization

Before writing, always check `leo.config.json` for:

1. **Blog name** - Use in CTAs and references
2. **Niche** - Tailor examples and terminology
3. **Target audience** - Adjust complexity and tone
4. **Brand voice** - Match the configured style
5. **Categories** - Assign appropriate category
6. **Internal links** - Link to existing content
7. **Image style** - Match visual preferences
