/**
 * Firecrawl: Extract Structure
 * 
 * Analyzes a competitor page and extracts structural patterns
 * for content strategy insights.
 */

import { scrapeUrl } from './scrapeUrl.js';

interface ExtractStructureInput {
  /** The URL to analyze */
  url: string;
}

interface ContentStructure {
  url: string;
  title: string;
  /** Total word count */
  wordCount: number;
  /** Reading time in minutes */
  readingTime: number;
  /** Table of contents structure */
  tableOfContents: Array<{
    level: number;
    text: string;
    depth: number;
  }>;
  /** Number of CTAs found */
  ctaCount: number;
  /** Types of content sections */
  sectionTypes: string[];
  /** Key statistics or data points mentioned */
  statistics: string[];
  /** FAQ sections detected */
  hasFaq: boolean;
  /** Number of images (estimated from markdown) */
  imageCount: number;
}

/**
 * Extract structural patterns from a competitor page.
 * 
 * @example
 * const structure = await extractStructure({ url: 'https://example.com/blog/article' });
 * console.log(`Sections: ${structure.tableOfContents.length}`);
 * console.log(`CTAs: ${structure.ctaCount}`);
 */
export async function extractStructure(
  input: ExtractStructureInput
): Promise<ContentStructure> {
  const page = await scrapeUrl({ url: input.url });
  
  // Build table of contents with depth tracking
  let currentDepth = 0;
  const tableOfContents = page.headings.map((h, i) => {
    if (i === 0) {
      currentDepth = 0;
    } else {
      const prevLevel = page.headings[i - 1].level;
      if (h.level > prevLevel) {
        currentDepth++;
      } else if (h.level < prevLevel) {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }
    return {
      level: h.level,
      text: h.text,
      depth: currentDepth
    };
  });

  // Detect CTAs (common patterns)
  const ctaPatterns = [
    /sign up/gi,
    /get started/gi,
    /try free/gi,
    /start.*trial/gi,
    /download/gi,
    /subscribe/gi,
    /join/gi,
    /book.*demo/gi,
    /schedule.*call/gi
  ];
  const ctaCount = ctaPatterns.reduce((count, pattern) => {
    const matches = page.markdown.match(pattern);
    return count + (matches?.length || 0);
  }, 0);

  // Detect section types
  const sectionTypes: string[] = [];
  if (page.markdown.match(/## (what|definition|overview)/i)) sectionTypes.push('definition');
  if (page.markdown.match(/## (how|step|guide)/i)) sectionTypes.push('how-to');
  if (page.markdown.match(/## (faq|question|q&a)/i)) sectionTypes.push('faq');
  if (page.markdown.match(/## (comparison|vs|versus)/i)) sectionTypes.push('comparison');
  if (page.markdown.match(/## (tip|best practice|pro tip)/i)) sectionTypes.push('tips');
  if (page.markdown.match(/## (example|case study)/i)) sectionTypes.push('examples');

  // Extract statistics
  const statPatterns = page.markdown.match(/\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?|\d+(?:,\d+)*\+?\s*(?:million|billion|users|customers|sellers)/gi) || [];
  const statistics = [...new Set(statPatterns)].slice(0, 10);

  // Detect FAQ
  const hasFaq = /## (?:faq|frequently asked|common question)/i.test(page.markdown) ||
                 page.markdown.includes('**Q:') ||
                 (page.markdown.match(/\?\n/g)?.length || 0) > 3;

  // Count images
  const imageCount = (page.markdown.match(/!\[/g) || []).length;

  // Calculate reading time (avg 200 wpm)
  const readingTime = Math.ceil(page.wordCount / 200);

  return {
    url: input.url,
    title: page.title,
    wordCount: page.wordCount,
    readingTime,
    tableOfContents,
    ctaCount,
    sectionTypes,
    statistics,
    hasFaq,
    imageCount
  };
}

