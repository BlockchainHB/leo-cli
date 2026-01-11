---
description: "Use this skill to find relevant blog posts for internal linking. Triggers on: internal links, backlinks, related posts, link to other articles."
---

# Internal Linking Skill

## CRITICAL: Read Configuration First

Before adding internal links, read `leo.config.json` to get:
- `blog.baseUrl` - The base URL for your blog
- `internalLinks` - Available pages to link to
- `categories` - Blog categories

## IMPORTANT: Who Handles Internal Links

**content-writer subagent** is responsible for adding 3-5 internal links to every article. Leo does NOT add links during assembly.

- content-writer reads `leo.config.json` to get available internal links
- Leo can use this skill to find additional relevant posts if needed
- The links in config are the primary source for internal linking

## Purpose

Every blog post should naturally link to 3-5 relevant articles from your blog. This improves SEO, keeps readers on-site, and builds topical authority.

## Configuration Format

Internal links are defined in `leo.config.json`:

```json
{
  "blog": {
    "baseUrl": "https://yourblog.com"
  },
  "internalLinks": [
    {
      "slug": "getting-started",
      "title": "Getting Started Guide",
      "url": "https://yourblog.com/blog/getting-started",
      "topics": ["beginners", "introduction", "basics"],
      "category": "tutorials"
    },
    {
      "slug": "advanced-tips",
      "title": "Advanced Tips and Tricks",
      "url": "https://yourblog.com/blog/advanced-tips",
      "topics": ["advanced", "optimization", "expert"],
      "category": "guides"
    }
  ]
}
```

## How to Find Relevant Links

Read `leo.config.json` and filter internal links by:
- **Topics**: Match article topics to link topics
- **Category**: Links in the same category
- **Relevance**: Links that naturally fit the content

### Example JavaScript to Find Links

```javascript
const config = JSON.parse(fs.readFileSync('./leo.config.json', 'utf-8'));
const links = config.internalLinks || [];

// Filter by topic
const relevantLinks = links.filter(link =>
  link.topics.some(topic =>
    ['your', 'relevant', 'topics'].includes(topic)
  )
);

// Filter by category
const categoryLinks = links.filter(link =>
  link.category === 'tutorials'
);
```

## Optional: Database Query (Supabase)

If using Supabase for internal links storage:

```sql
-- Find links by topic keywords
SELECT url, title, summary
FROM internal_links
WHERE topics && ARRAY['keywords', 'seo', 'ppc']::text[]
ORDER BY title;

-- Find links by category
SELECT url, title, summary
FROM internal_links
WHERE category = 'tutorials';

-- Search summaries for relevance
SELECT url, title, summary
FROM internal_links
WHERE summary ILIKE '%profit%' OR summary ILIKE '%fees%';
```

Use `mcp__supabase__execute_sql` with your project ID from config.

## How to Link Naturally

**Good - contextual link:**
> If you're still learning the basics, start with our [Getting Started Guide](https://yourblog.com/blog/getting-started) first.

**Good - "learn more" style:**
> For a deeper dive, see our [Advanced Tips guide](https://yourblog.com/blog/advanced-tips).

**Bad - forced link:**
> Here is a link to our guide: [link]. Now back to the topic...

## Linking Rules

1. **3-5 internal links per article** - More for longer posts
2. **Link early** - First internal link within first 500 words
3. **Natural anchor text** - Use descriptive phrases, not "click here"
4. **Relevant context** - Only link when topic is genuinely related
5. **End with CTA** - Final link can point to a signup page or related content

## Standard Links Pattern

Create a set of foundational articles that most posts can reference:

- **For beginners**: Link to introduction/basics guide
- **For getting started**: Link to step-by-step tutorial
- **For deep dives**: Link to comprehensive guides
- **For tools**: Link to calculator/tool pages

## Example: Finding Links for New Article

When writing a new post, the content-writer should:

1. Read `leo.config.json` to get `internalLinks`
2. Identify 3-5 links relevant to the article topic
3. Naturally incorporate them into the content
4. Use descriptive anchor text with keywords when appropriate

Example code in content-writer:
```javascript
// Read config
const config = JSON.parse(fs.readFileSync('./leo.config.json', 'utf-8'));
const availableLinks = config.internalLinks || [];

// For an article about "optimization", find relevant links
const relevantLinks = availableLinks.filter(link =>
  link.topics?.includes('optimization') ||
  link.topics?.includes('performance') ||
  link.category === 'guides'
);

// Use top 3-5 most relevant links in the article
```
