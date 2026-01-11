/**
 * Insert Images into Markdown Draft
 *
 * Reads image specs and inserts image markdown at specified placements.
 * Supports both V1 (string placement) and V2 (structured placement) formats.
 * Must be called BEFORE createPost so the markdown parser finds the images.
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';

// =============================================================================
// INTERFACES - V1 + V2 Compatible
// =============================================================================

interface PlacementV2 {
  section?: string;
  position?: string;
  insertAfter?: string;
  headingText?: string;
  headingMatch?: string;
  markdownSyntax?: string;
  htmlSyntax?: string;
}

interface ImageSpec {
  // V1 fields
  filename?: string;
  alt?: string;
  caption?: string;
  placement?: string | PlacementV2;

  // V2 fields
  name?: string;
  heading?: string;  // V2: The H2 heading text this image belongs under
  seo?: {
    filename?: string;
    altText?: string;
    title?: string;
    description?: string;
    keywords?: string[];
  };
  accessibility?: {
    altText?: string;
    longDescription?: string;
  };
}

interface ImageSpecs {
  slug: string;
  hero: ImageSpec;
  sections?: ImageSpec[];
  images?: ImageSpec[];  // V1 compatibility
}

interface InsertResult {
  originalLines: number;
  newLines: number;
  imagesInserted: number;
  placements: string[];
  dryRun: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract filename from V1 or V2 format
 */
function extractFilename(img: ImageSpec): string {
  return img.seo?.filename || img.filename || img.name || 'unknown.png';
}

/**
 * Extract alt text from V1 or V2 format
 */
function extractAltText(img: ImageSpec): string {
  return img.accessibility?.altText || img.seo?.altText || img.alt || '';
}

/**
 * Slugify a heading text to create a section ID
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')       // Replace spaces with hyphens
    .replace(/--+/g, '-')       // Replace multiple hyphens
    .trim();
}

/**
 * Check if words from search match words in target
 * Allows partial matching for V2 section IDs
 */
function fuzzyMatch(searchText: string, targetText: string): boolean {
  const searchWords = searchText.toLowerCase().split(/[-\s]+/).filter(w => w.length > 2);
  const targetWords = targetText.toLowerCase().split(/[-\s]+/);

  // Check if most search words appear in target
  const matchCount = searchWords.filter(word =>
    targetWords.some(tw => tw.includes(word) || word.includes(tw))
  ).length;

  return matchCount >= Math.ceil(searchWords.length * 0.5);
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Insert images into markdown draft at specified placements.
 * Supports both V1 and V2 image spec formats.
 *
 * @param slug - The article slug
 * @param dryRun - If true, don't write changes to file (preview mode)
 * @returns Modified markdown content and stats
 */
export function insertImagesIntoDraft(slug: string, dryRun = false): InsertResult {
  const draftPath = `./drafts/${slug}.md`;
  const specsPath = `./drafts/${slug}-images.json`;

  // Also check for V2 format file
  const specsPathV2 = `./drafts/${slug}-images-v2.json`;
  let actualSpecsPath = specsPath;

  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft not found: ${draftPath}`);
  }

  // Try V2 file first, fall back to V1
  if (fs.existsSync(specsPathV2)) {
    actualSpecsPath = specsPathV2;
    console.log(`[insertImages] Using V2 specs: ${specsPathV2}`);
  } else if (!fs.existsSync(specsPath)) {
    throw new Error(`Image specs not found: ${specsPath} or ${specsPathV2}`);
  }

  const markdown = fs.readFileSync(draftPath, 'utf-8');
  const specs: ImageSpecs = JSON.parse(fs.readFileSync(actualSpecsPath, 'utf-8'));

  const lines = markdown.split('\n');
  const originalLines = lines.length;
  const placements: string[] = [];

  // Build H2 mapping for fuzzy matching
  const h2Mapping = buildH2Mapping(lines);
  console.log(`[insertImages] Found ${Object.keys(h2Mapping).length} H2 headings in draft`);

  // Get all section images
  const sectionImages = specs.sections || specs.images || [];
  console.log(`[insertImages] Processing ${sectionImages.length} section images`);

  // Track line offset as we insert (insertions shift later line numbers)
  let lineOffset = 0;

  // Process each image with a placement
  for (const img of sectionImages) {
    if (!img.placement) {
      console.log(`[insertImages] Skipping image without placement: ${extractFilename(img)}`);
      continue;
    }

    let targetH2: string | null = null;
    let placementDesc: string;

    // V2 format: structured placement object
    if (typeof img.placement === 'object' && img.placement !== null) {
      const placement = img.placement as PlacementV2;

      if (placement.section) {
        // Convert section ID to H2 search pattern
        const sectionId = placement.section;
        targetH2 = findMatchingHeading(sectionId, h2Mapping);

        if (!targetH2) {
          console.log(`[insertImages] ⚠️ Could not map section ID "${sectionId}" to H2 heading`);
          continue;
        }
        console.log(`[insertImages] Mapped "${sectionId}" → "${targetH2}"`);
        placementDesc = `After H2: ${targetH2} (from section: ${sectionId})`;
      } else if (placement.headingText) {
        targetH2 = placement.headingText;
        placementDesc = `After H2: ${targetH2}`;
      } else if (placement.insertAfter) {
        // Direct insertAfter - look for exact heading
        targetH2 = placement.insertAfter.replace(/^#+ /, '');
        placementDesc = `After: ${placement.insertAfter}`;
      } else if (placement.position === 'after-h2' && img.heading) {
        // V2 format: position: "after-h2" with separate heading field
        targetH2 = img.heading;
        placementDesc = `After H2: ${targetH2} (from heading field)`;
      } else {
        console.log(`[insertImages] Invalid V2 placement format:`, img.placement);
        continue;
      }
    }
    // V2 simple format: "after-h2" string with heading field
    else if (typeof img.placement === 'string' && img.placement.toLowerCase() === 'after-h2') {
      if (img.heading) {
        targetH2 = img.heading;
        placementDesc = `After H2: ${targetH2}`;
      } else if (img.name) {
        // Fall back to using name as section ID for fuzzy matching
        targetH2 = findMatchingHeading(img.name, h2Mapping);
        if (targetH2) {
          placementDesc = `After H2: ${targetH2} (from name: ${img.name})`;
        } else {
          console.log(`[insertImages] ⚠️ placement "after-h2" but no heading field and could not match name "${img.name}"`);
          continue;
        }
      } else {
        console.log(`[insertImages] ⚠️ placement "after-h2" but no heading field for: ${extractFilename(img)}`);
        continue;
      }
    }
    // V1 format: "After H2: Heading Text"
    else if (typeof img.placement === 'string') {
      const match = img.placement.match(/After H2:\s*(.+)/i);
      if (!match) {
        console.log(`[insertImages] Skipping unrecognized placement: ${img.placement}`);
        continue;
      }
      targetH2 = match[1].trim();
      placementDesc = img.placement;
    }
    else {
      console.log(`[insertImages] Invalid placement format:`, img.placement);
      continue;
    }

    // Find the H2 line (with fuzzy matching)
    let insertIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        const h2Text = line.replace(/^##\s+/, '');

        // Exact match (case insensitive)
        if (h2Text.toLowerCase() === targetH2.toLowerCase()) {
          insertIndex = i + lineOffset + 1;
          break;
        }

        // Partial match (for V1 format with truncated titles)
        if (h2Text.toLowerCase().includes(targetH2.toLowerCase().substring(0, 30))) {
          insertIndex = i + lineOffset + 1;
          break;
        }

        // Fuzzy match (for V2 section IDs)
        if (fuzzyMatch(targetH2, h2Text)) {
          insertIndex = i + lineOffset + 1;
          break;
        }
      }
    }

    if (insertIndex === -1) {
      console.log(`[insertImages] ⚠️ H2 not found: "${targetH2}"`);
      continue;
    }

    // Skip any empty lines after the H2
    while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
      insertIndex++;
    }

    // Extract filename and alt from V1 or V2 format
    const filename = extractFilename(img);
    const alt = extractAltText(img);

    // Check for duplicate - skip if image already exists in markdown
    const imageAlreadyExists = lines.some(line =>
      line.includes(`](${filename})`)
    );
    if (imageAlreadyExists) {
      console.log(`[insertImages] ⏭️  Skipping ${filename} (already inserted)`);
      continue;
    }

    // Insert image markdown
    const imageMarkdown = `\n![${alt}](${filename})\n`;
    lines.splice(insertIndex, 0, imageMarkdown);
    lineOffset++;  // Track offset for subsequent insertions

    placements.push(placementDesc);
    console.log(`[insertImages] ✅ Inserted ${filename} at line ${insertIndex}`);
  }

  // Save modified markdown (unless dry run)
  const newMarkdown = lines.join('\n');
  if (dryRun) {
    console.log(`[insertImages] DRY RUN: Would insert ${placements.length} images into ${draftPath}`);
    console.log(`[insertImages] Placements:`, placements);
  } else {
    fs.writeFileSync(draftPath, newMarkdown);
    console.log(`[insertImages] Done: ${placements.length} images inserted into ${draftPath}`);
  }

  return {
    originalLines,
    newLines: lines.length,
    imagesInserted: placements.length,
    placements,
    dryRun
  };
}

/**
 * Build a mapping of H2 slugs to their actual text and line numbers
 */
function buildH2Mapping(lines: string[]): Record<string, { heading: string; lineNumber: number }> {
  const mapping: Record<string, { heading: string; lineNumber: number }> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      const heading = line.replace(/^##\s+/, '').trim();
      const slug = slugify(heading);

      mapping[slug] = {
        heading,
        lineNumber: i
      };
    }
  }

  return mapping;
}

/**
 * Find the best matching H2 heading for a V2 section ID
 * Uses fuzzy matching to handle short section IDs
 */
function findMatchingHeading(
  sectionId: string,
  mapping: Record<string, { heading: string; lineNumber: number }>
): string | null {
  // Try exact match first
  if (mapping[sectionId]) {
    return mapping[sectionId].heading;
  }

  // Score all headings and find the best match
  const searchWords = sectionId.split('-').filter(w => w.length > 2);
  let bestMatch: { heading: string; score: number } | null = null;

  for (const [slug, data] of Object.entries(mapping)) {
    const slugWords = slug.split('-').filter(w => w.length > 2);

    // Count exact word matches (not substrings)
    const exactMatches = searchWords.filter(word =>
      slugWords.some(sw => sw === word)
    ).length;

    // Count partial matches (one word starts with the other, min 4 chars)
    const partialMatches = searchWords.filter(word =>
      word.length >= 4 && slugWords.some(sw =>
        sw.length >= 4 && (sw.startsWith(word) || word.startsWith(sw))
      )
    ).length;

    // Score: exact matches worth 2, partial matches worth 1
    const score = exactMatches * 2 + partialMatches;
    const minScore = Math.ceil(searchWords.length * 1.0); // Need at least 50% match (lowered from 1.5)

    if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { heading: data.heading, score };
    }
  }

  return bestMatch?.heading || null;
}

/**
 * Build the bodyImages map for createPost from uploaded assets.
 * Supports both V1 and V2 image spec formats.
 *
 * @param specs - Image specs with filenames
 * @param uploadedAssets - Map of filename → Sanity asset ref
 * @returns bodyImages map for createPost
 */
export function buildBodyImagesMap(
  specs: ImageSpecs,
  uploadedAssets: Record<string, string>
): Record<string, { assetRef: string; alt: string; caption?: string }> {
  const bodyImages: Record<string, { assetRef: string; alt: string; caption?: string }> = {};

  const sectionImages = specs.sections || specs.images || [];

  for (const img of sectionImages) {
    const filename = extractFilename(img);
    const alt = extractAltText(img);

    if (uploadedAssets[filename]) {
      bodyImages[filename] = {
        assetRef: uploadedAssets[filename],
        alt,
        caption: img.caption
      };
    }
  }

  return bodyImages;
}

// =============================================================================
// CLI
// =============================================================================

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const showHelp = args.includes('--help') || args.includes('-h');
  const slug = args.find(arg => !arg.startsWith('-'));

  if (showHelp || !slug) {
    console.log(`
Usage: npx tsx src/servers/sanity/insertImages.ts <slug> [options]

Inserts image markdown into draft files based on image specs.

Options:
  --dry-run, -n   Preview changes without writing to file
  --help, -h      Show this help message

Supported placement formats:
  V1: "After H2: Heading Text"
  V2: { section: "section-id" }
  V2: { headingText: "Heading Text" }
  V2: "after-h2" (uses 'heading' field from spec)

Examples:
  npx tsx src/servers/sanity/insertImages.ts my-blog-post
  npx tsx src/servers/sanity/insertImages.ts my-blog-post --dry-run
`);
    process.exit(showHelp ? 0 : 1);
  }

  try {
    const result = insertImagesIntoDraft(slug, dryRun);
    console.log('\nResult:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
