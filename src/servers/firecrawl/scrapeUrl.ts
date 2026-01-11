/**
 * Firecrawl: Scrape URL
 * 
 * Scrapes a URL and extracts content as structured markdown.
 * Used for competitor analysis and content research.
 */

import type { FirecrawlResult, MCPToolResponse } from '../../types/index.js';

interface ScrapeUrlInput {
  /** The URL to scrape */
  url: string;
  /** Include metadata like title, description (default: true) */
  includeMetadata?: boolean;
  /** Wait for JavaScript rendering (default: true) */
  waitForJs?: boolean;
}

interface HeadingNode {
  level: number;
  text: string;
  children?: HeadingNode[];
}

interface LinkInfo {
  url: string;
  anchorText: string;
  isInternal: boolean;
}

interface ImageInfo {
  src: string;
  alt: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
  context?: string; // Heading or text before the table
}

interface CTAInfo {
  text: string;
  url?: string;
  position: 'top' | 'middle' | 'bottom';
  positionPercent: number; // 0-100, where in the content it appears
  type: 'button' | 'link' | 'text';
}

interface ReadabilityMetrics {
  fleschKincaidGrade: number; // Grade level (e.g., 8.2 = 8th grade)
  fleschReadingEase: number; // 0-100, higher = easier
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  readingLevel: 'easy' | 'moderate' | 'difficult';
}

interface SchemaMarkup {
  types: string[]; // e.g., ['Article', 'FAQPage', 'HowTo']
  hasArticle: boolean;
  hasFAQ: boolean;
  hasHowTo: boolean;
  hasBreadcrumb: boolean;
  hasProduct: boolean;
  rawSchemas: Array<{ type: string; properties: string[] }>;
}

interface ScrapeUrlResponse {
  url: string;
  title: string;
  description: string;
  content: string;
  markdown: string;
  headings: HeadingNode[];
  flatHeadings: Array<{ level: number; text: string }>; // Backwards compatible
  links: LinkInfo[];
  internalLinkCount: number;
  externalLinkCount: number;
  images: ImageInfo[];
  tables: TableData[];
  faqs: Array<{ question: string; answer: string }>;
  dates: string[]; // Dates found in content
  wordCount: number;
  paragraphCount: number;
  avgParagraphLength: number;
  listCount: number;
  hasStructuredData: boolean;
  // New fields
  readability: ReadabilityMetrics;
  ctas: CTAInfo[];
  schemaMarkup: SchemaMarkup;
}

/**
 * Scrape a URL and extract content as markdown.
 * 
 * @example
 * const page = await scrapeUrl({ url: 'https://example.com/blog/article' });
 * console.log(`Word count: ${page.wordCount}`);
 * console.log(`Headings: ${page.headings.map(h => h.text).join(', ')}`);
 */
export async function scrapeUrl(
  input: ScrapeUrlInput
): Promise<ScrapeUrlResponse> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    console.warn('[Firecrawl] No API key found, returning mock data');
    return {
      url: input.url,
      title: 'Mock Title',
      description: 'Mock description for development',
      content: '',
      markdown: '',
      headings: [],
      flatHeadings: [],
      links: [],
      internalLinkCount: 0,
      externalLinkCount: 0,
      images: [],
      tables: [],
      faqs: [],
      dates: [],
      wordCount: 0,
      paragraphCount: 0,
      avgParagraphLength: 0,
      listCount: 0,
      hasStructuredData: false,
      readability: {
        fleschKincaidGrade: 0,
        fleschReadingEase: 0,
        avgSentenceLength: 0,
        avgSyllablesPerWord: 0,
        readingLevel: 'moderate',
      },
      ctas: [],
      schemaMarkup: {
        types: [],
        hasArticle: false,
        hasFAQ: false,
        hasHowTo: false,
        hasBreadcrumb: false,
        hasProduct: false,
        rawSchemas: [],
      },
    };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url: input.url,
        formats: ['markdown', 'html', 'rawHtml'], // Include rawHtml for schema detection
        onlyMainContent: true,
        waitFor: input.waitForJs !== false ? 2000 : 0
      })
    });

    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${response.status}`);
    }

    const data = await response.json() as {
      data?: {
        markdown?: string;
        html?: string;
        rawHtml?: string; // Full page HTML for schema detection
        metadata?: { title?: string; description?: string }
      }
    };
    const markdown = data.data?.markdown || '';
    const html = data.data?.html || '';
    const rawHtml = data.data?.rawHtml || html; // Use rawHtml if available, fallback to html
    const urlObj = new URL(input.url);
    const baseDomain = urlObj.hostname;

    // Extract flat headings from markdown (backwards compatible)
    const headingMatches = markdown.matchAll(/^(#{1,6})\s+(.+)$/gm);
    const flatHeadings = Array.from(headingMatches).map((match: RegExpMatchArray) => ({
      level: match[1].length,
      text: match[2].trim()
    }));

    // Build nested heading tree
    const headings = buildHeadingTree(flatHeadings);

    // Extract links with anchor text and internal/external classification
    const linkMatches = markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    const links: LinkInfo[] = Array.from(linkMatches).map((match: RegExpMatchArray) => {
      const linkUrl = match[2];
      let isInternal = false;
      try {
        const parsed = new URL(linkUrl, input.url);
        isInternal = parsed.hostname === baseDomain || parsed.hostname.endsWith('.' + baseDomain);
      } catch {
        isInternal = linkUrl.startsWith('/') || linkUrl.startsWith('#');
      }
      return {
        url: linkUrl,
        anchorText: match[1].trim(),
        isInternal,
      };
    });
    const internalLinkCount = links.filter(l => l.isInternal).length;
    const externalLinkCount = links.filter(l => !l.isInternal).length;

    // Extract images from markdown ![alt](src)
    const imageMatches = markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
    const images: ImageInfo[] = Array.from(imageMatches).map((match: RegExpMatchArray) => ({
      alt: match[1].trim(),
      src: match[2].trim(),
    }));

    // Extract tables from markdown with context
    const tables = extractMarkdownTables(markdown, flatHeadings);

    // Extract FAQs - look for Q&A patterns (improved filtering)
    const faqs = extractFAQs(markdown);

    // Calculate readability metrics
    const readability = calculateReadability(markdown);

    // Extract CTAs with positioning
    const ctas = extractCTAs(markdown);

    // Extract schema markup from raw HTML (includes head with schema scripts)
    const schemaMarkup = extractSchemaMarkup(rawHtml);

    // Extract dates - common formats
    const datePatterns = [
      /\b(\d{4}-\d{2}-\d{2})\b/g,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
    ];
    const dates: string[] = [];
    for (const pattern of datePatterns) {
      const matches = markdown.matchAll(pattern);
      for (const match of matches) {
        if (!dates.includes(match[0])) {
          dates.push(match[0]);
        }
      }
    }

    // Count paragraphs and calculate average length
    const paragraphs = markdown.split(/\n\n+/).filter(p =>
      p.trim().length > 0 &&
      !p.trim().startsWith('#') &&
      !p.trim().startsWith('|') &&
      !p.trim().startsWith('-') &&
      !p.trim().startsWith('*') &&
      !p.trim().startsWith('>')
    );
    const paragraphCount = paragraphs.length;
    const totalParagraphWords = paragraphs.reduce((sum, p) => sum + p.split(/\s+/).filter(Boolean).length, 0);
    const avgParagraphLength = paragraphCount > 0 ? Math.round(totalParagraphWords / paragraphCount) : 0;

    // Count lists
    const listMatches = markdown.match(/^[\s]*[-*+]\s/gm);
    const numberedListMatches = markdown.match(/^[\s]*\d+\.\s/gm);
    const listCount = (listMatches?.length || 0) + (numberedListMatches?.length || 0);

    // Count words
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;

    // Check for structured data indicators
    const hasStructuredData = html.includes('application/ld+json') ||
                              html.includes('itemtype=') ||
                              html.includes('itemprop=');

    return {
      url: input.url,
      title: data.data?.metadata?.title || '',
      description: data.data?.metadata?.description || '',
      content: html,
      markdown,
      headings,
      flatHeadings,
      links,
      internalLinkCount,
      externalLinkCount,
      images,
      tables,
      faqs,
      dates,
      wordCount,
      paragraphCount,
      avgParagraphLength,
      listCount,
      hasStructuredData,
      readability,
      ctas,
      schemaMarkup,
    };
  } catch (error) {
    console.error('[Firecrawl] Scrape failed:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function buildHeadingTree(flatHeadings: Array<{ level: number; text: string }>): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: { node: HeadingNode; level: number }[] = [];

  for (const h of flatHeadings) {
    const node: HeadingNode = { level: h.level, text: h.text };

    // Pop stack until we find a parent with lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      const parent = stack[stack.length - 1].node;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    }

    stack.push({ node, level: h.level });
  }

  return root;
}

function extractMarkdownTables(
  markdown: string,
  headings: Array<{ level: number; text: string }>
): TableData[] {
  const tables: TableData[] = [];
  const lines = markdown.split('\n');

  // Match markdown tables: header row, separator row, data rows
  const tablePattern = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  const matches = markdown.matchAll(tablePattern);

  for (const match of matches) {
    const headerLine = match[1];
    const bodyLines = match[2].trim().split('\n');

    const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
    const rows = bodyLines.map(line =>
      line.split('|').map(cell => cell.trim()).filter(Boolean)
    );

    if (headers.length > 0 && rows.length > 0) {
      // Find context: look for preceding heading
      const tableIndex = markdown.indexOf(match[0]);
      const textBefore = markdown.slice(0, tableIndex);
      const lastHeadingMatch = textBefore.match(/^#{1,6}\s+(.+)$/gm);
      const context = lastHeadingMatch
        ? lastHeadingMatch[lastHeadingMatch.length - 1].replace(/^#+\s*/, '')
        : undefined;

      tables.push({ headers, rows, context });
    }
  }

  return tables;
}

function extractFAQs(markdown: string): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = [];
  const lines = markdown.split('\n');

  // Pattern: Lines ending with ? followed by non-question content
  const questionLines = markdown.matchAll(/^(?:#{1,6}\s+)?(.+\?)\s*$/gm);

  for (const match of questionLines) {
    const question = match[1].replace(/^#+\s*/, '').trim();

    // Skip noise: too short, contains markdown image syntax, or is a title
    if (question.length < 15 || question.length > 200) continue;
    if (question.includes('![') || question.includes('](')) continue;
    if (question.match(/^(What|How|Why|When|Where|Which|Who|Is|Are|Can|Do|Does|Should|Would|Could)/i) === null) continue;

    const questionIndex = lines.findIndex(l => l.includes(match[1]));
    if (questionIndex >= 0 && questionIndex < lines.length - 1) {
      // Get next non-empty, non-question line(s) as answer
      let answer = '';
      for (let i = questionIndex + 1; i < Math.min(questionIndex + 8, lines.length); i++) {
        const line = lines[i].trim();
        // Skip empty lines, headings, images, and other questions
        if (!line || line.startsWith('#') || line.startsWith('![') || line.endsWith('?')) continue;
        // Skip markdown formatting noise
        if (line.match(/^\[.*\]\(.*\)$/) || line.match(/^\*\*[^*]+\*\*$/)) continue;
        // Found good answer content
        answer = line.replace(/^\*\*|\*\*$/g, '').trim();
        if (answer.length > 20) break; // Need meaningful answer
      }

      // Only include if we have a real answer (not just links or short fragments)
      if (answer.length > 30 && !answer.startsWith('[') && !answer.includes('![')) {
        faqs.push({ question, answer: answer.slice(0, 300) + (answer.length > 300 ? '...' : '') });
      }
    }
  }

  // Dedupe by question similarity
  const seen = new Set<string>();
  return faqs.filter(faq => {
    const key = faq.question.toLowerCase().replace(/[^a-z]/g, '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

function calculateReadability(markdown: string): ReadabilityMetrics {
  // Strip markdown formatting for clean text analysis
  const cleanText = markdown
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/^#+\s+/gm, '') // Remove heading markers
    .replace(/\*\*|__/g, '') // Remove bold
    .replace(/\*|_/g, '') // Remove italic
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\|[^|]+\|/g, '') // Remove table cells
    .replace(/\n{2,}/g, '\n') // Normalize newlines
    .trim();

  // Split into sentences (rough approximation)
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const sentenceCount = Math.max(sentences.length, 1);

  // Split into words
  const words = cleanText.split(/\s+/).filter(w => w.match(/[a-zA-Z]/));
  const wordCount = Math.max(words.length, 1);

  // Count syllables (approximation)
  const countSyllables = (word: string): number => {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    // Count vowel groups
    const matches = word.match(/[aeiouy]+/g);
    let count = matches ? matches.length : 1;
    // Adjust for silent e
    if (word.endsWith('e') && count > 1) count--;
    // Adjust for -le endings
    if (word.match(/[^aeiou]le$/)) count++;
    return Math.max(count, 1);
  };

  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  // Calculate metrics
  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / wordCount;

  // Flesch-Kincaid Grade Level = 0.39 × (words/sentences) + 11.8 × (syllables/words) - 15.59
  const fleschKincaidGrade = Math.max(0, Math.round(
    (0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59) * 10
  ) / 10);

  // Flesch Reading Ease = 206.835 - 1.015 × (words/sentences) - 84.6 × (syllables/words)
  const fleschReadingEase = Math.min(100, Math.max(0, Math.round(
    206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord
  )));

  // Determine reading level
  let readingLevel: 'easy' | 'moderate' | 'difficult';
  if (fleschReadingEase >= 60) {
    readingLevel = 'easy';
  } else if (fleschReadingEase >= 30) {
    readingLevel = 'moderate';
  } else {
    readingLevel = 'difficult';
  }

  return {
    fleschKincaidGrade,
    fleschReadingEase,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    readingLevel,
  };
}

function extractCTAs(markdown: string): CTAInfo[] {
  const ctas: CTAInfo[] = [];
  const totalLength = markdown.length;

  // CTA patterns
  const ctaPatterns = [
    // Button-like CTAs: [Text](url) where text has action words
    /\[([^\]]*(?:start|sign up|get started|try|download|buy|subscribe|join|register|learn more|click here|free trial|get free|shop now|order now|book now|contact us|request|claim)[^\]]*)\]\(([^)]+)\)/gi,
    // Text CTAs: action phrases not in links
    /(?:^|\n)([^[\n]*(?:click here|sign up now|get started today|try it free|start your free|join now|register today|download now|subscribe now|buy now|order today)[^[\n]*)/gi,
  ];

  for (const pattern of ctaPatterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      const position = match.index || 0;
      const positionPercent = Math.round((position / totalLength) * 100);

      let positionLabel: 'top' | 'middle' | 'bottom';
      if (positionPercent < 20) {
        positionLabel = 'top';
      } else if (positionPercent > 80) {
        positionLabel = 'bottom';
      } else {
        positionLabel = 'middle';
      }

      const hasUrl = match[2] !== undefined;
      ctas.push({
        text: match[1].trim().slice(0, 100),
        url: hasUrl ? match[2] : undefined,
        position: positionLabel,
        positionPercent,
        type: hasUrl ? 'button' : 'text',
      });
    }
  }

  // Dedupe by text similarity
  const seen = new Set<string>();
  return ctas.filter(cta => {
    const key = cta.text.toLowerCase().replace(/[^a-z]/g, '').slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

function extractSchemaMarkup(html: string): SchemaMarkup {
  const result: SchemaMarkup = {
    types: [],
    hasArticle: false,
    hasFAQ: false,
    hasHowTo: false,
    hasBreadcrumb: false,
    hasProduct: false,
    rawSchemas: [],
  };

  // Extract JSON-LD schemas
  const jsonLdMatches = html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of jsonLdMatches) {
    try {
      const jsonText = match[1].trim();
      const schema = JSON.parse(jsonText);

      const processSchema = (s: Record<string, unknown>) => {
        const type = (s['@type'] as string) || '';
        const types = Array.isArray(type) ? type : [type];

        for (const t of types) {
          if (t && !result.types.includes(t)) {
            result.types.push(t);

            // Check specific types
            if (t.toLowerCase().includes('article') || t === 'BlogPosting' || t === 'NewsArticle') {
              result.hasArticle = true;
            }
            if (t === 'FAQPage' || t === 'Question') {
              result.hasFAQ = true;
            }
            if (t === 'HowTo' || t === 'HowToStep') {
              result.hasHowTo = true;
            }
            if (t === 'BreadcrumbList') {
              result.hasBreadcrumb = true;
            }
            if (t === 'Product' || t === 'Offer') {
              result.hasProduct = true;
            }

            // Extract properties for this type
            const properties = Object.keys(s).filter(k => !k.startsWith('@'));
            result.rawSchemas.push({ type: t, properties });
          }
        }

        // Handle @graph arrays
        if (s['@graph'] && Array.isArray(s['@graph'])) {
          for (const item of s['@graph'] as Record<string, unknown>[]) {
            processSchema(item);
          }
        }
      };

      processSchema(schema);
    } catch {
      // Invalid JSON, skip
    }
  }

  // Also check for microdata (itemtype attributes)
  const microdataMatches = html.matchAll(/itemtype\s*=\s*["']https?:\/\/schema\.org\/([^"']+)["']/gi);
  for (const match of microdataMatches) {
    const type = match[1];
    if (!result.types.includes(type)) {
      result.types.push(type);
      if (type.toLowerCase().includes('article')) result.hasArticle = true;
      if (type === 'FAQPage') result.hasFAQ = true;
      if (type === 'HowTo') result.hasHowTo = true;
      if (type === 'BreadcrumbList') result.hasBreadcrumb = true;
      if (type === 'Product') result.hasProduct = true;
    }
  }

  return result;
}

