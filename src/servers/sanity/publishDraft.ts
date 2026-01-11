/**
 * Unified Publish Draft Script
 *
 * ONE COMMAND to go from written blog post + generated images → Sanity draft
 *
 * This script handles the ENTIRE workflow:
 * 1. Reads draft markdown and image specs
 * 2. Inserts image markdown into draft (if not already done)
 * 3. Uploads hero image to Sanity
 * 4. Uploads all section images to Sanity
 * 5. Builds the bodyImages map automatically
 * 6. Creates the post as a draft in Sanity with all images properly linked
 *
 * Usage:
 *   npx tsx src/servers/sanity/publishDraft.ts <slug>
 *   npx tsx src/servers/sanity/publishDraft.ts <slug> --publish (publish immediately)
 *   npx tsx src/servers/sanity/publishDraft.ts <slug> --dry-run (preview without creating)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

import { uploadImage } from './uploadImage.js';
import { createPost } from './createPost.js';
import { insertImagesIntoDraft, buildBodyImagesMap } from './insertImages.js';

config();

// =============================================================================
// INTERFACES
// =============================================================================

interface ImageSpec {
  filename?: string;
  name?: string;
  id?: string;
  heading?: string;
  placement?: string | object;
  caption?: string;
  alt?: string;
  seo?: { filename?: string; altText?: string };
  accessibility?: { altText?: string };
}

interface ImageSpecs {
  slug: string;
  hero: ImageSpec;
  sections?: ImageSpec[];
  images?: ImageSpec[];  // V1 compatibility
}

interface PublishResult {
  success: boolean;
  documentId?: string;
  slug: string;
  heroUploaded: boolean;
  imagesUploaded: number;
  imagesInserted: number;
  error?: string;
}

interface FrontMatter {
  title: string;
  slug: string;
  seoDescription: string;
  category?: string;
}

// =============================================================================
// CATEGORY MAPPING - Loaded from leo.config.json
// =============================================================================

/**
 * Load categories from leo.config.json
 * Returns a map of category slugs to Sanity IDs
 */
function loadCategoryMapping(): Record<string, string> {
  try {
    const configPath = './leo.config.json';
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const categories = config.categories || [];
      const mapping: Record<string, string> = {};
      for (const cat of categories) {
        if (cat.slug && cat.id) {
          mapping[cat.slug] = cat.id;
        }
      }
      return mapping;
    }
  } catch (err) {
    console.warn('Could not load categories from leo.config.json');
  }
  return {};
}

// Lazy-loaded category mapping
let CATEGORY_SLUGS_TO_IDS: Record<string, string> | null = null;

function getCategoryMapping(): Record<string, string> {
  if (!CATEGORY_SLUGS_TO_IDS) {
    CATEGORY_SLUGS_TO_IDS = loadCategoryMapping();
  }
  return CATEGORY_SLUGS_TO_IDS;
}

/**
 * Get default category from config, or first available category
 */
function getDefaultCategory(): string | undefined {
  try {
    const configPath = './leo.config.json';
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const categories = config.categories || [];
      return categories[0]?.slug;
    }
  } catch (err) {
    // Ignore errors
  }
  return undefined;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function extractFilename(img: ImageSpec, slug: string, index: number): string {
  return img.seo?.filename || img.filename || img.name || img.id
    ? `${slug}-${img.name || img.id || `section-${index}`}.png`
    : `${slug}-section-${index}.png`;
}

function extractAltText(img: ImageSpec): string {
  return img.accessibility?.altText || img.seo?.altText || img.alt || '';
}

function parseFrontMatter(markdown: string): { frontMatter: FrontMatter; body: string } {
  const fmMatch = markdown.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);

  if (!fmMatch) {
    throw new Error('Invalid markdown: missing frontmatter');
  }

  const fmContent = fmMatch[1];
  const body = fmMatch[2];

  // Parse YAML-like frontmatter
  const title = fmContent.match(/title:\s*["']?(.+?)["']?\s*$/m)?.[1] || '';
  const slug = fmContent.match(/slug:\s*["']?(.+?)["']?\s*$/m)?.[1] || '';
  const seoDescription = fmContent.match(/seoDescription:\s*["']?(.+?)["']?\s*$/m)?.[1] || '';
  const category = fmContent.match(/category:\s*["']?(.+?)["']?\s*$/m)?.[1];

  return {
    frontMatter: { title, slug, seoDescription, category },
    body
  };
}

function getCategoryId(categorySlug?: string): string | undefined {
  const mapping = getCategoryMapping();
  const defaultCat = getDefaultCategory();

  if (!categorySlug) {
    return defaultCat ? mapping[defaultCat] : undefined;
  }
  return mapping[categorySlug] || (defaultCat ? mapping[defaultCat] : undefined);
}

// =============================================================================
// MAIN PUBLISH FUNCTION
// =============================================================================

/**
 * Publish a draft to Sanity with all images.
 *
 * This is the ONE function Leo should call after writing a blog post.
 * It handles everything: image insertion, upload, and post creation.
 */
export async function publishDraftToSanity(
  slug: string,
  options: {
    publish?: boolean;  // Publish immediately vs create as draft
    dryRun?: boolean;   // Preview without creating
    categoryOverride?: string;  // Override category from frontmatter
  } = {}
): Promise<PublishResult> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📤 PUBLISH DRAFT TO SANITY: ${slug}`);
  console.log(`${'═'.repeat(60)}\n`);

  const result: PublishResult = {
    success: false,
    slug,
    heroUploaded: false,
    imagesUploaded: 0,
    imagesInserted: 0
  };

  try {
    // =========================================================================
    // STEP 1: Locate files
    // =========================================================================
    console.log('📁 Step 1: Locating files...');

    const draftPath = `./drafts/${slug}.md`;
    const specsPathV2 = `./drafts/${slug}-images-v2.json`;
    const specsPathV1 = `./drafts/${slug}-images.json`;
    const imagesDir = `./images/${slug}`;

    if (!fs.existsSync(draftPath)) {
      throw new Error(`Draft not found: ${draftPath}`);
    }

    const specsPath = fs.existsSync(specsPathV2) ? specsPathV2 :
                      fs.existsSync(specsPathV1) ? specsPathV1 : null;

    if (!specsPath) {
      throw new Error(`Image specs not found. Tried:\n  - ${specsPathV2}\n  - ${specsPathV1}`);
    }

    if (!fs.existsSync(imagesDir)) {
      throw new Error(`Images directory not found: ${imagesDir}\nRun: npx tsx src/servers/images/generateImages.ts generate ${slug}`);
    }

    console.log(`  ✅ Draft: ${draftPath}`);
    console.log(`  ✅ Specs: ${specsPath}`);
    console.log(`  ✅ Images: ${imagesDir}`);

    // =========================================================================
    // STEP 2: Read and parse files
    // =========================================================================
    console.log('\n📖 Step 2: Reading files...');

    const markdown = fs.readFileSync(draftPath, 'utf-8');
    const specs: ImageSpecs = JSON.parse(fs.readFileSync(specsPath, 'utf-8'));
    const { frontMatter, body } = parseFrontMatter(markdown);

    console.log(`  ✅ Title: ${frontMatter.title}`);
    console.log(`  ✅ Slug: ${frontMatter.slug}`);

    const sectionImages = specs.sections || specs.images || [];
    console.log(`  ✅ Hero + ${sectionImages.length} section images`);

    // =========================================================================
    // STEP 3: Insert images into draft (if not already done)
    // =========================================================================
    console.log('\n🖼️  Step 3: Inserting images into draft...');

    try {
      const insertResult = insertImagesIntoDraft(slug, options.dryRun);
      result.imagesInserted = insertResult.imagesInserted;

      if (insertResult.imagesInserted > 0) {
        console.log(`  ✅ Inserted ${insertResult.imagesInserted} images`);
      } else {
        console.log(`  ⏭️  No new images to insert (already done or no placements)`);
      }
    } catch (err: any) {
      console.log(`  ⚠️  Insert skipped: ${err.message}`);
    }

    // Re-read markdown after insertion
    const updatedMarkdown = fs.readFileSync(draftPath, 'utf-8');
    const { body: updatedBody } = parseFrontMatter(updatedMarkdown);

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN - Would upload and create:');
      console.log(`  Hero: ${specs.hero.filename || `${slug}-hero.png`}`);
      sectionImages.forEach((img, i) => {
        console.log(`  Section ${i + 1}: ${extractFilename(img, slug, i + 1)}`);
      });
      console.log('\n  Would create draft in Sanity');
      result.success = true;
      return result;
    }

    // =========================================================================
    // STEP 4: Upload hero image
    // =========================================================================
    console.log('\n☁️  Step 4: Uploading hero image...');

    const heroFilename = specs.hero.filename || specs.hero.seo?.filename || `${slug}-hero.png`;
    const heroPath = path.join(imagesDir, heroFilename);

    if (!fs.existsSync(heroPath)) {
      throw new Error(`Hero image not found: ${heroPath}`);
    }

    const heroAsset = await uploadImage({
      filePath: heroPath,
      filename: heroFilename,
      altText: extractAltText(specs.hero) || `${frontMatter.title} hero image`
    });

    result.heroUploaded = true;
    console.log(`  ✅ Hero uploaded: ${heroAsset.assetRef}`);

    // =========================================================================
    // STEP 5: Upload section images
    // =========================================================================
    console.log('\n☁️  Step 5: Uploading section images...');

    const uploadedAssets: Record<string, string> = {};

    for (let i = 0; i < sectionImages.length; i++) {
      const img = sectionImages[i];
      const filename = extractFilename(img, slug, i + 1);
      const imgPath = path.join(imagesDir, filename);

      if (!fs.existsSync(imgPath)) {
        console.log(`  ⚠️  Skipping missing image: ${filename}`);
        continue;
      }

      try {
        const asset = await uploadImage({
          filePath: imgPath,
          filename,
          altText: extractAltText(img) || `${frontMatter.title} section ${i + 1}`
        });

        uploadedAssets[filename] = asset.assetRef;
        result.imagesUploaded++;
        console.log(`  ✅ [${i + 1}/${sectionImages.length}] ${filename}`);
      } catch (err: any) {
        console.log(`  ❌ [${i + 1}/${sectionImages.length}] ${filename}: ${err.message}`);
      }
    }

    console.log(`  📊 Uploaded ${result.imagesUploaded}/${sectionImages.length} section images`);

    // =========================================================================
    // STEP 6: Build bodyImages map
    // =========================================================================
    console.log('\n🗺️  Step 6: Building bodyImages map...');

    const bodyImages = buildBodyImagesMap(specs, uploadedAssets);
    console.log(`  ✅ Map has ${Object.keys(bodyImages).length} entries`);

    // Debug: Show the mapping
    for (const [key, value] of Object.entries(bodyImages)) {
      console.log(`     ${key} → ${value.assetRef.slice(0, 30)}...`);
    }

    // =========================================================================
    // STEP 7: Create post in Sanity
    // =========================================================================
    console.log('\n📝 Step 7: Creating post in Sanity...');

    const categoryId = getCategoryId(options.categoryOverride || frontMatter.category);
    const categoryRefs = categoryId ? [categoryId] : [];

    const postResult = await createPost({
      title: frontMatter.title,
      slug: frontMatter.slug || slug,
      excerpt: frontMatter.seoDescription,
      body: updatedBody,
      heroImageRef: heroAsset.assetRef,
      heroImageAlt: extractAltText(specs.hero) || `${frontMatter.title} hero image`,
      categoryRefs,
      seoTitle: frontMatter.title,
      seoDescription: frontMatter.seoDescription,
      publish: options.publish || false,
      bodyImages
    });

    result.success = true;
    result.documentId = postResult.documentId;

    console.log(`  ✅ ${options.publish ? 'Published' : 'Draft created'}: ${postResult.documentId}`);
    console.log(`  📄 Path: ${postResult.path}`);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ SUCCESS: ${slug}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`  Document ID: ${result.documentId}`);
    console.log(`  Status: ${options.publish ? 'PUBLISHED' : 'DRAFT'}`);
    console.log(`  Hero: uploaded`);
    console.log(`  Section images: ${result.imagesUploaded} uploaded`);
    console.log(`  Inline images: ${Object.keys(bodyImages).length} mapped`);
    // Load Sanity studio URL from config or env
    const sanityStudioUrl = process.env.SANITY_STUDIO_URL;
    if (sanityStudioUrl) {
      console.log(`\n  View in Sanity Studio:`);
      console.log(`  ${sanityStudioUrl}/structure/post;${result.documentId}`);
    }

    return result;

  } catch (error: any) {
    result.error = error.message;
    console.error(`\n❌ FAILED: ${error.message}`);
    return result;
  }
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const showHelp = args.includes('--help') || args.includes('-h');
  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const publish = args.includes('--publish') || args.includes('-p');
  const slug = args.find(arg => !arg.startsWith('-'));

  if (showHelp || !slug) {
    console.log(`
Usage: npx tsx src/servers/sanity/publishDraft.ts <slug> [options]

THE ONE COMMAND to publish a blog post to Sanity.

This script handles EVERYTHING:
  1. Inserts image markdown into draft
  2. Uploads hero image to Sanity
  3. Uploads all section images to Sanity
  4. Builds the bodyImages map
  5. Creates the post with inline images

Options:
  --publish, -p    Publish immediately (default: create as draft)
  --dry-run, -n    Preview without uploading or creating
  --help, -h       Show this help message

Prerequisites:
  1. Draft exists: ./drafts/{slug}.md
  2. Image specs exist: ./drafts/{slug}-images.json (or -v2.json)
  3. Images generated: ./images/{slug}/*.png

Examples:
  npx tsx src/servers/sanity/publishDraft.ts my-blog-post
  npx tsx src/servers/sanity/publishDraft.ts my-blog-post --dry-run
  npx tsx src/servers/sanity/publishDraft.ts my-blog-post --publish

For Leo:
  After writing a blog post and generating images, just run:
  npx tsx src/servers/sanity/publishDraft.ts {slug}
`);
    process.exit(showHelp ? 0 : 1);
  }

  const result = await publishDraftToSanity(slug, { publish, dryRun });

  if (!result.success) {
    process.exit(1);
  }
}

// Run CLI if executed directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
