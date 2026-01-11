#!/usr/bin/env node
/**
 * CLI: Firecrawl URL Scraper (Enhanced)
 *
 * Usage: npx tsx src/cli/firecrawl-scrape.ts "https://example.com/page"
 *
 * Outputs JSON with comprehensive content extraction:
 * - Nested heading hierarchy (H2, H3, H4)
 * - Internal/external links with anchor text
 * - Images with alt text
 * - Tables as structured JSON
 * - FAQs (questions found in content)
 * - Dates mentioned in content
 * - Content quality metrics
 * - Validation status
 */

import { config } from 'dotenv';
import { scrapeUrl } from '../servers/firecrawl/scrapeUrl.js';

config();

type ScrapeStatus = 'success' | 'partial' | 'failed' | 'blocked' | 'not_found';

interface ValidationResult {
  status: ScrapeStatus;
  issues: string[];
  qualityScore: number; // 0-100
}

function validateContent(result: Awaited<ReturnType<typeof scrapeUrl>>): ValidationResult {
  const issues: string[] = [];
  let score = 100;

  // Check word count
  if (result.wordCount < 100) {
    issues.push('Very low word count - may be blocked or 404 page');
    score -= 40;
  } else if (result.wordCount < 500) {
    issues.push('Low word count - may be partial content');
    score -= 20;
  }

  // Check for headings
  if (result.flatHeadings.length === 0) {
    issues.push('No headings found - unstructured content');
    score -= 15;
  }

  // Check for access denied patterns
  const markdown = result.markdown.toLowerCase();
  if (markdown.includes('access denied') ||
      markdown.includes('403 forbidden') ||
      markdown.includes('please enable javascript') ||
      markdown.includes('captcha')) {
    issues.push('Content may be blocked or requires authentication');
    score -= 50;
  }

  // Check for 404 patterns
  if (markdown.includes('page not found') ||
      markdown.includes('404') ||
      markdown.includes('does not exist')) {
    issues.push('Page may not exist (404)');
    score -= 50;
  }

  // Determine status
  let status: ScrapeStatus = 'success';
  if (score <= 20) {
    status = markdown.includes('denied') || markdown.includes('forbidden') ? 'blocked' : 'failed';
  } else if (score <= 60) {
    status = 'partial';
  }
  if (markdown.includes('404') || markdown.includes('not found')) {
    status = 'not_found';
  }

  return {
    status,
    issues,
    qualityScore: Math.max(0, score),
  };
}

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: firecrawl-scrape "https://example.com/page"');
    console.error('');
    console.error('Returns comprehensive content extraction with validation.');
    process.exit(1);
  }

  try {
    const result = await scrapeUrl({ url });
    const validation = validateContent(result);

    // Build condensed output for subagents
    const output = {
      // Validation first - so agent knows if data is reliable
      validation: {
        status: validation.status,
        qualityScore: validation.qualityScore,
        issues: validation.issues,
      },

      // Core metadata
      url: result.url,
      title: result.title,
      description: result.description,

      // Content metrics
      metrics: {
        wordCount: result.wordCount,
        paragraphCount: result.paragraphCount,
        avgParagraphLength: result.avgParagraphLength,
        listCount: result.listCount,
        imageCount: result.images.length,
        tableCount: result.tables.length,
        internalLinkCount: result.internalLinkCount,
        externalLinkCount: result.externalLinkCount,
        hasStructuredData: result.hasStructuredData,
      },

      // Reading level analysis
      readability: result.readability,

      // Schema markup detection
      schemaMarkup: {
        types: result.schemaMarkup.types,
        hasArticle: result.schemaMarkup.hasArticle,
        hasFAQ: result.schemaMarkup.hasFAQ,
        hasHowTo: result.schemaMarkup.hasHowTo,
        hasBreadcrumb: result.schemaMarkup.hasBreadcrumb,
        hasProduct: result.schemaMarkup.hasProduct,
      },

      // CTAs with positioning
      ctas: result.ctas,

      // Structured content
      headings: result.headings, // Nested tree
      flatHeadings: result.flatHeadings.map(h => `${'#'.repeat(h.level)} ${h.text}`),

      // Links with anchor text (top 20)
      links: result.links.slice(0, 20).map(l => ({
        anchor: l.anchorText,
        url: l.url,
        internal: l.isInternal,
      })),

      // Images with alt text
      images: result.images.slice(0, 10),

      // Tables as structured data
      tables: result.tables.slice(0, 5),

      // FAQs found
      faqs: result.faqs,

      // Dates mentioned (for freshness analysis)
      dates: result.dates.slice(0, 5),

      // Truncated markdown for context
      contentPreview: result.markdown.slice(0, 3000) +
        (result.markdown.length > 3000 ? '\n\n...[truncated - full content available]' : ''),
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const err = error as Error;
    console.error(JSON.stringify({
      validation: {
        status: 'failed',
        qualityScore: 0,
        issues: [err.message],
      },
      url,
      error: err.message,
      hint: err.message.includes('FIRECRAWL')
        ? 'Check that FIRECRAWL_API_KEY is set in .env'
        : err.message.includes('fetch')
          ? 'Network error - check internet connection'
          : 'See Firecrawl API docs for error details',
    }));
    process.exit(1);
  }
}

main();

