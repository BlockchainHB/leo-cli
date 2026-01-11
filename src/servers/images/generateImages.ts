/**
 * Image Generation via OpenRouter + Gemini
 *
 * Generates images from prompts using Google's Gemini 3 Pro Image Preview model.
 * Supports both V1 (simple) and V2 (enhanced) image specification formats.
 *
 * V1 Format: Simple string prompts with basic metadata
 * V2 Format: Structured prompts with rich metadata (technical specs, SEO, accessibility)
 *
 * OPTIMIZED FEATURES:
 * - Pre-flight checks (API key, credits validation)
 * - Parallel generation with concurrency control
 * - Resume support (skips already-generated images)
 * - Retry logic for transient errors
 * - Real-time progress output
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL = 'google/gemini-3-pro-image-preview';

// Concurrency and retry settings
const CONCURRENCY_LIMIT = 2;  // Max parallel image generations
const RETRY_ATTEMPTS = 2;     // Number of retries for failed generations
const RETRY_DELAY_MS = 2000;  // Delay between retries
const RATE_LIMIT_DELAY_MS = 500; // Small delay between parallel batches

// =============================================================================
// GENERATION STATE (for resume support)
// =============================================================================

interface GenerationState {
  slug: string;
  startedAt: string;
  completedAt?: string;
  total: number;
  completed: string[];  // filenames that succeeded
  failed: string[];     // filenames that failed
  status: 'running' | 'complete' | 'partial' | 'failed';
}

function getStatePath(imageDir: string): string {
  return path.join(imageDir, '.generation-state.json');
}

function loadState(imageDir: string): GenerationState | null {
  const statePath = getStatePath(imageDir);
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveState(imageDir: string, state: GenerationState): void {
  const statePath = getStatePath(imageDir);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// =============================================================================
// PRE-FLIGHT CHECKS
// =============================================================================

interface PreflightResult {
  ok: boolean;
  error?: string;
  credits?: number;
  estimatedCost?: number;
}

/**
 * Validate API key and check credits before generation
 */
async function preflightCheck(numImages: number): Promise<PreflightResult> {
  // Check API key exists
  if (!OPENROUTER_API_KEY) {
    return { ok: false, error: 'OPENROUTER_API_KEY not set in environment' };
  }

  // Check credits with OpenRouter
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { ok: false, error: 'Invalid API key (401 Unauthorized)' };
      }
      return { ok: false, error: `API key check failed: ${response.status}` };
    }

    const data = await response.json() as any;
    const credits = data.data?.limit_remaining ?? data.data?.usage ?? 0;

    // Estimate cost (~$0.05 per image for Gemini image generation)
    const estimatedCost = numImages * 0.05;

    // Check if we have enough credits (with 20% buffer)
    if (typeof credits === 'number' && credits < estimatedCost * 1.2) {
      return {
        ok: false,
        error: `Insufficient credits: $${credits.toFixed(2)} remaining, need ~$${estimatedCost.toFixed(2)} for ${numImages} images. Top up at https://openrouter.ai/settings/credits`,
        credits,
        estimatedCost
      };
    }

    return { ok: true, credits, estimatedCost };
  } catch (err: any) {
    // If we can't check credits, proceed with warning
    console.log(`⚠️  Could not verify credits: ${err.message}`);
    console.log(`   Proceeding anyway - watch for 402 errors`);
    return { ok: true };
  }
}

// =============================================================================
// CONCURRENCY CONTROL (p-limit style)
// =============================================================================

function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (queue.length > 0 && active < concurrency) {
      active++;
      const fn = queue.shift()!;
      fn();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const run = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          active--;
          next();
        }
      };

      queue.push(run);
      next();
    });
  };
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number,
  delayMs: number,
  label: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      // Don't retry on 402 (credits exhausted) or 401 (auth)
      if (err.message?.includes('402') || err.message?.includes('401')) {
        throw err;
      }

      if (i < attempts - 1) {
        console.log(`  ⚠️  ${label} failed (attempt ${i + 1}/${attempts}): ${err.message}`);
        console.log(`     Retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError;
}

// =============================================================================
// V2 FORMAT INTERFACES
// =============================================================================

interface StructuredPrompt {
  mainSubject: string;
  foreground: string;
  midground: string;
  background: string;
  style: string;
  colors: Record<string, string>;
  lighting: string;
  camera: string;
  mood: string;
  details: string;
  negative: string;
}

interface TechnicalSpecs {
  dimensions: {
    width: number;
    height: number;
    aspectRatio?: string;
    dpi?: number;
  };
  formats?: {
    primary: string;
    webOptimized?: string;
    fallback?: string;
  };
  optimization?: {
    maxFileSize: string;
    compression?: string;
    quality?: number;
  };
  responsive?: {
    desktop: string;
    tablet: string;
    mobile: string;
  };
}

interface AIGenerationParams {
  model: string;
  quality?: string;
  stylePreset?: string;
  negativePrompt: string;
  enhancePrompt?: boolean;
}

interface SEOMetadata {
  filename?: string;
  altText: string;
  title?: string;
  description?: string;
  keywords?: string[];
}

interface AccessibilityInfo {
  altText: string;
  longDescription?: string;
  textAlternative?: string;
  colorContrast?: {
    textToBackground: string;
    accentToBackground?: string;
  };
}

interface PlacementInfo {
  section?: string;
  position?: string;
  insertAfter?: string;
  headingText?: string;
  headingMatch?: string;
  markdownSyntax?: string;
  htmlSyntax?: string;
}

interface ValidationChecks {
  visualQuality?: string[];
  technicalRequirements?: string[];
  accessibilityChecks?: string[];
  seoOptimization?: string[];
}

// =============================================================================
// UNIFIED IMAGE SPEC INTERFACE (V1 + V2 Compatible)
// =============================================================================

interface ImageSpec {
  // Common fields
  filename?: string; // May be undefined in some V1 formats
  caption?: string;

  // V1 format (simple)
  prompt?: string | StructuredPrompt;
  alt?: string;
  dimensions?: string; // V1: "1200x630"
  id?: string; // Some V1 formats use id instead of filename

  // V2 format (enhanced)
  name?: string;
  promptString?: string;
  technical?: TechnicalSpecs;
  aiGeneration?: AIGenerationParams;
  seo?: SEOMetadata;
  accessibility?: AccessibilityInfo;
  placement?: string | PlacementInfo;
  validation?: ValidationChecks;
}

interface BrandingInfo {
  colorPalette?: Record<string, string>;
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    minimumSize?: string;
  };
  style?: string;
}

interface ImageSpecsFile {
  slug: string;
  createdDate?: string;
  created_date?: string; // V1 compatibility
  primaryKeyword?: string;
  totalImages?: number;
  branding?: BrandingInfo;
  hero: ImageSpec;
  sections?: ImageSpec[];
  images?: ImageSpec[]; // V1 compatibility
  generationWorkflow?: any;
  qualityAssurance?: any;
  notes?: any;
}

interface GeneratedImage {
  filename: string;
  filePath: string;
  alt: string;
  caption?: string;
  placement?: string;
  dimensions?: { width: number; height: number };
}

// =============================================================================
// FORMAT DETECTION AND EXTRACTION HELPERS
// =============================================================================

/**
 * Detect if specs file is V2 format
 */
function isV2Format(specs: ImageSpecsFile): boolean {
  return specs.hero.promptString !== undefined ||
         specs.hero.technical !== undefined ||
         specs.hero.seo !== undefined;
}

/**
 * Extract prompt string from either V1 or V2 format
 * V1: prompt is a string
 * V2: promptString is the AI-ready string, prompt is structured object
 */
function extractPrompt(spec: ImageSpec): string {
  // V2 format: use promptString if available
  if (spec.promptString) {
    return spec.promptString;
  }

  // V1 format: use prompt if it's a string
  if (typeof spec.prompt === 'string') {
    return spec.prompt;
  }

  // If prompt is an object (V2 structured but missing promptString)
  if (typeof spec.prompt === 'object' && spec.prompt) {
    const p = spec.prompt as StructuredPrompt;
    // Generate promptString from structured prompt
    const parts = [
      p.style,
      p.mainSubject,
      p.foreground && `${p.foreground} in foreground`,
      p.midground && `${p.midground} in midground`,
      p.background && `${p.background} in background`,
      p.lighting,
      p.camera,
      p.mood && `${p.mood} mood`,
      p.details,
      p.negative && `negative: ${p.negative}`
    ].filter(Boolean);

    return parts.join(', ');
  }

  throw new Error('No valid prompt found in image spec. Expected either "prompt" (string) or "promptString".');
}

/**
 * Extract alt text from either V1 or V2 format
 */
function extractAltText(spec: ImageSpec): string {
  // V2 format: accessibility.altText (preferred)
  if (spec.accessibility?.altText) {
    return spec.accessibility.altText;
  }

  // V2 format: seo.altText (fallback)
  if (spec.seo?.altText) {
    return spec.seo.altText;
  }

  // V1 format: direct alt property
  if (spec.alt) {
    return spec.alt;
  }

  // Last resort: use filename
  const filename = spec.filename || spec.id || spec.name || 'image';
  console.warn(`  ⚠️  No alt text found for ${filename}, using filename`);
  return filename.replace(/\.[^.]+$/, '').replace(/-/g, ' ');
}

/**
 * Extract dimensions from V1 or V2 format
 */
function extractDimensions(spec: ImageSpec, isHero: boolean): { width: number; height: number } {
  // V2 format: technical.dimensions
  if (spec.technical?.dimensions) {
    return {
      width: spec.technical.dimensions.width,
      height: spec.technical.dimensions.height
    };
  }

  // V1 format: dimensions string like "1200x630"
  if (spec.dimensions) {
    const match = spec.dimensions.match(/(\d+)x(\d+)/);
    if (match) {
      return { width: parseInt(match[1]), height: parseInt(match[2]) };
    }
  }

  // Default dimensions based on image type
  return isHero
    ? { width: 1200, height: 675 }  // 16:9 for hero
    : { width: 1200, height: 800 }; // 3:2 for sections
}

/**
 * Extract placement info from V1 or V2 format
 */
function extractPlacement(spec: ImageSpec): string | undefined {
  if (typeof spec.placement === 'object') {
    return spec.placement.section || spec.placement.position;
  }
  return spec.placement;
}

/**
 * Extract filename from V1 or V2 format
 * Falls back to id.png if filename is not present
 */
function extractFilename(spec: ImageSpec, slug: string, index: number): string {
  if (spec.filename) {
    return spec.filename;
  }

  // V1 fallback: use id as filename
  if (spec.id) {
    return `${slug}-${spec.id}.png`;
  }

  // V2 fallback: use name as filename
  if (spec.name) {
    return `${slug}-${spec.name}.png`;
  }

  // Last resort: use index
  return `${slug}-image-${index}.png`;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate image specs format and log useful information
 */
function validateSpecs(specs: ImageSpecsFile): void {
  const isV2 = isV2Format(specs);

  console.log('\n📊 Specs Validation:');
  console.log(`  Slug: ${specs.slug}`);
  console.log(`  Format: ${isV2 ? 'V2 (enhanced)' : 'V1 (simple)'}`);
  console.log(`  Total images expected: ${specs.totalImages || 'unknown'}`);

  if (specs.primaryKeyword) {
    console.log(`  Primary keyword: ${specs.primaryKeyword}`);
  }

  if (specs.branding) {
    console.log(`  ✓ Has branding guidelines`);
    if (specs.branding.colorPalette) {
      const colors = Object.entries(specs.branding.colorPalette)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      console.log(`    Colors: ${colors}`);
    }
  }

  if (isV2) {
    if (specs.hero.technical) {
      const { width, height } = specs.hero.technical.dimensions;
      console.log(`  ✓ Has technical specs (${width}x${height})`);
    }

    if (specs.hero.aiGeneration) {
      console.log(`  ✓ Has AI generation params (model: ${specs.hero.aiGeneration.model})`);
    }

    if (specs.hero.seo) {
      console.log(`  ✓ Has SEO metadata`);
    }

    if (specs.hero.accessibility) {
      console.log(`  ✓ Has accessibility info`);
    }

    if (specs.hero.validation) {
      console.log(`  ✓ Has validation checklists`);
    }
  }

  console.log('');
}

// =============================================================================
// IMAGE GENERATION
// =============================================================================

/**
 * Generate a single image using OpenRouter + Gemini
 * Supports both V1 (simple) and V2 (enhanced) specs
 */
async function generateImage(
  spec: ImageSpec,
  isHero: boolean = false
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not found in environment');
  }

  // Extract prompt (works with both V1 and V2)
  let enhancedPrompt = extractPrompt(spec);

  // Get dimensions
  const dimensions = extractDimensions(spec, isHero);

  // Add negative prompt if available (V2 feature)
  if (spec.aiGeneration?.negativePrompt && !enhancedPrompt.includes('negative:')) {
    enhancedPrompt += `, negative: ${spec.aiGeneration.negativePrompt}`;
  }

  // Add aspect ratio hint
  const aspectRatio = isHero ? '16:9 wide landscape' : '3:2 landscape';
  enhancedPrompt += `, ${aspectRatio} format, ${dimensions.width}x${dimensions.height}px, optimized for web blog`;

  // Determine model (V2 feature: use specified model, or default)
  const model = spec.aiGeneration?.model || DEFAULT_MODEL;

  console.log(`  📝 Model: ${model}`);
  console.log(`  📐 Dimensions: ${dimensions.width}x${dimensions.height}`);
  console.log(`  📏 Aspect: ${aspectRatio}`);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: enhancedPrompt
        }
      ],
      modalities: ['image', 'text']
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const result = await response.json() as any;

  if (result.choices && result.choices[0]?.message?.images?.[0]) {
    const imageUrl = result.choices[0].message.images[0].image_url.url;
    // Extract base64 data from data URL (format: data:image/png;base64,...)
    const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (base64Match) {
      return base64Match[1];
    }
    return imageUrl; // Return as-is if not a data URL
  }

  throw new Error('No image returned from Gemini');
}

// =============================================================================
// MAIN GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate all images from a specs file and save to disk
 * Supports both V1 and V2 formats
 *
 * OPTIMIZED VERSION:
 * - Pre-flight checks (validates API key and credits before starting)
 * - Parallel generation (2 images at a time)
 * - Resume support (skips already-generated images)
 * - Retry logic (retries failed images once)
 * - Real-time progress output
 *
 * @param specsPath Path to the {slug}-images.json file
 * @param outputDir Directory to save images (default: ./images/{slug}/)
 * @param options Optional settings for generation
 * @returns Array of generated image info with file paths
 */
export async function generateImagesFromSpecs(
  specsPath: string,
  outputDir?: string,
  options: { skipPreflight?: boolean; forceRegenerate?: boolean } = {}
): Promise<GeneratedImage[]> {
  const startTime = Date.now();

  // Read specs file
  const specsContent = fs.readFileSync(specsPath, 'utf-8');
  const specs: ImageSpecsFile = JSON.parse(specsContent);

  // Validate and log specs info
  validateSpecs(specs);

  const slug = specs.slug;
  const imageDir = outputDir || `./images/${slug}`;

  // Create output directory
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }

  // Build list of all images to generate
  const allImages: Array<{ spec: ImageSpec; filename: string; isHero: boolean; index: number }> = [];

  // Add hero
  const heroFilename = extractFilename(specs.hero, slug, 0);
  allImages.push({ spec: specs.hero, filename: heroFilename, isHero: true, index: 0 });

  // Add sections
  const sectionImages = specs.sections || specs.images || [];
  sectionImages.forEach((img, i) => {
    const filename = extractFilename(img, slug, i + 1);
    allImages.push({ spec: img, filename, isHero: false, index: i + 1 });
  });

  const totalImages = allImages.length;

  // =========================================================================
  // PRE-FLIGHT CHECKS
  // =========================================================================
  if (!options.skipPreflight) {
    console.log('\n🔍 Pre-flight checks...');
    const preflight = await preflightCheck(totalImages);

    if (!preflight.ok) {
      console.error(`\n❌ PRE-FLIGHT FAILED: ${preflight.error}`);
      console.error(`   Generation aborted before starting.`);
      throw new Error(`Pre-flight check failed: ${preflight.error}`);
    }

    console.log(`  ✅ API key valid`);
    if (preflight.credits !== undefined) {
      console.log(`  ✅ Credits: $${preflight.credits.toFixed(2)} (need ~$${preflight.estimatedCost?.toFixed(2)})`);
    }
    console.log(`  ✅ Ready to generate ${totalImages} images`);
  }

  // =========================================================================
  // RESUME SUPPORT - Check for previous state
  // =========================================================================
  let state = loadState(imageDir);
  let skippedCount = 0;

  if (state && !options.forceRegenerate) {
    console.log(`\n📂 Found previous generation state`);
    console.log(`   Status: ${state.status}, Completed: ${state.completed.length}/${state.total}`);

    if (state.status === 'complete') {
      console.log(`   All images already generated. Use --force to regenerate.`);
    }
  } else {
    state = {
      slug,
      startedAt: new Date().toISOString(),
      total: totalImages,
      completed: [],
      failed: [],
      status: 'running'
    };
  }

  // Filter out already-completed images (unless force regenerate)
  const imagesToGenerate = options.forceRegenerate
    ? allImages
    : allImages.filter(img => {
        const imgPath = path.join(imageDir, img.filename);
        const alreadyExists = fs.existsSync(imgPath) && state!.completed.includes(img.filename);
        if (alreadyExists) {
          skippedCount++;
        }
        return !alreadyExists;
      });

  if (skippedCount > 0) {
    console.log(`\n⏭️  Skipping ${skippedCount} already-generated image(s)`);
  }

  if (imagesToGenerate.length === 0) {
    console.log(`\n✅ All ${totalImages} images already exist!`);
    return buildGeneratedImagesResult(allImages, imageDir, specs);
  }

  // =========================================================================
  // PARALLEL GENERATION
  // =========================================================================
  console.log(`\n🚀 Starting parallel generation (${CONCURRENCY_LIMIT} concurrent)...`);
  console.log(`   Generating ${imagesToGenerate.length} images...\n`);

  const limiter = createLimiter(CONCURRENCY_LIMIT);
  const generatedImages: GeneratedImage[] = [];
  let completedCount = skippedCount;

  // Create generation tasks
  const tasks = imagesToGenerate.map(({ spec, filename, isHero, index }) => {
    return limiter(async () => {
      const imgName = spec.name || spec.id || (isHero ? 'hero' : `section-${index}`);
      const progress = `[${++completedCount}/${totalImages}]`;

      console.log(`${progress} 🎨 Generating ${imgName}...`);

      try {
        // Generate with retry
        const base64 = await withRetry(
          () => generateImage(spec, isHero),
          RETRY_ATTEMPTS,
          RETRY_DELAY_MS,
          imgName
        );

        const imgPath = path.join(imageDir, filename);
        fs.writeFileSync(imgPath, Buffer.from(base64, 'base64'));

        // Update state
        state!.completed.push(filename);
        state!.failed = state!.failed.filter(f => f !== filename);
        saveState(imageDir, state!);

        console.log(`${progress} ✅ ${filename}`);

        return {
          filename,
          filePath: imgPath,
          alt: extractAltText(spec),
          caption: spec.caption,
          placement: isHero ? 'hero' : extractPlacement(spec),
          dimensions: extractDimensions(spec, isHero)
        };
      } catch (err: any) {
        console.error(`${progress} ❌ ${imgName}: ${err.message}`);

        // Update state with failure
        if (!state!.failed.includes(filename)) {
          state!.failed.push(filename);
        }
        saveState(imageDir, state!);

        return null;
      }
    });
  });

  // Wait for all tasks to complete
  const results = await Promise.all(tasks);

  // Collect successful results
  for (const result of results) {
    if (result) {
      generatedImages.push(result);
    }
  }

  // Also include already-existing images in the result
  for (const img of allImages) {
    const imgPath = path.join(imageDir, img.filename);
    if (fs.existsSync(imgPath) && !generatedImages.find(g => g.filename === img.filename)) {
      generatedImages.push({
        filename: img.filename,
        filePath: imgPath,
        alt: extractAltText(img.spec),
        caption: img.spec.caption,
        placement: img.isHero ? 'hero' : extractPlacement(img.spec),
        dimensions: extractDimensions(img.spec, img.isHero)
      });
    }
  }

  // =========================================================================
  // FINAL STATE UPDATE
  // =========================================================================
  const elapsedMs = Date.now() - startTime;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  state.completedAt = new Date().toISOString();
  state.status = state.failed.length === 0 ? 'complete' :
                 state.completed.length > 0 ? 'partial' : 'failed';
  saveState(imageDir, state);

  // Summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Generated ${generatedImages.length}/${totalImages} images in ${elapsedSec}s`);
  console.log(`📁 Output: ${imageDir}`);

  if (state.failed.length > 0) {
    console.log(`⚠️  Failed: ${state.failed.join(', ')}`);
    console.log(`   Run again to retry failed images`);
  }

  return generatedImages;
}

/**
 * Helper to build result from existing images
 */
function buildGeneratedImagesResult(
  allImages: Array<{ spec: ImageSpec; filename: string; isHero: boolean }>,
  imageDir: string,
  specs: ImageSpecsFile
): GeneratedImage[] {
  return allImages
    .filter(img => fs.existsSync(path.join(imageDir, img.filename)))
    .map(img => ({
      filename: img.filename,
      filePath: path.join(imageDir, img.filename),
      alt: extractAltText(img.spec),
      caption: img.spec.caption,
      placement: img.isHero ? 'hero' : extractPlacement(img.spec),
      dimensions: extractDimensions(img.spec, img.isHero)
    }));
}

/**
 * Generate images for a blog post by slug
 * Looks for ./drafts/{slug}-images.json and outputs to ./images/{slug}/
 *
 * @param slug - The article slug
 * @param options - Optional settings
 *   - forceRegenerate: Skip resume, regenerate all images
 *   - skipPreflight: Skip API key and credits check
 */
export async function generateBlogImages(
  slug: string,
  options: { forceRegenerate?: boolean; skipPreflight?: boolean } = {}
): Promise<GeneratedImage[]> {
  // Check for V2 format first
  const v2Path = `./drafts/${slug}-images-v2.json`;
  const v1Path = `./drafts/${slug}-images.json`;

  let specsPath: string;

  if (fs.existsSync(v2Path)) {
    console.log(`📋 Found V2 specs: ${v2Path}`);
    specsPath = v2Path;
  } else if (fs.existsSync(v1Path)) {
    console.log(`📋 Found V1 specs: ${v1Path}`);
    specsPath = v1Path;
  } else {
    throw new Error(`Image specs not found. Tried:\n  - ${v2Path}\n  - ${v1Path}`);
  }

  return generateImagesFromSpecs(specsPath, undefined, options);
}

/**
 * Validate specs file without generating images
 */
export function validateSpecsFile(specsPath: string): void {
  const specsContent = fs.readFileSync(specsPath, 'utf-8');
  const specs: ImageSpecsFile = JSON.parse(specsContent);

  validateSpecs(specs);

  const sectionImages = specs.sections || specs.images || [];
  const slug = specs.slug;

  console.log('Hero image:');
  console.log(`  - ${extractFilename(specs.hero, slug, 0)}`);
  console.log(`  - Alt: ${extractAltText(specs.hero).slice(0, 50)}...`);
  console.log(`  - Prompt: ${extractPrompt(specs.hero).slice(0, 80)}...`);

  console.log(`\nSection images (${sectionImages.length}):`);
  sectionImages.forEach((img, i) => {
    const name = img.name || img.id || `section-${i + 1}`;
    console.log(`  ${i + 1}. ${name}: ${extractFilename(img, slug, i + 1)}`);
    console.log(`     Alt: ${extractAltText(img).slice(0, 50)}...`);
  });
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse flags
  const hasFlag = (flag: string) => args.includes(flag);
  const forceRegenerate = hasFlag('--force') || hasFlag('-f');
  const skipPreflight = hasFlag('--skip-preflight') || hasFlag('--no-preflight');

  if (!command || command === '--help' || command === '-h') {
    console.log(`
Usage: npx tsx src/servers/images/generateImages.ts <command> [options]

Commands:
  generate <slug>     Generate images for a blog post
  validate <path>     Validate a specs file without generating
  preflight <slug>    Run pre-flight checks only (verify API key & credits)

Options:
  --force, -f         Force regenerate all images (skip resume)
  --skip-preflight    Skip API key and credits check
  --help, -h          Show this help message

Examples:
  npx tsx src/servers/images/generateImages.ts generate my-blog-post
  npx tsx src/servers/images/generateImages.ts generate my-blog-post --force
  npx tsx src/servers/images/generateImages.ts validate ./drafts/my-blog-post-images-v2.json
  npx tsx src/servers/images/generateImages.ts preflight my-blog-post

Features:
  ✅ Pre-flight checks - Validates API key and credits before starting
  ✅ Parallel generation - Generates 2 images at a time (faster)
  ✅ Resume support - Skips already-generated images (run again to retry failures)
  ✅ Retry logic - Automatically retries transient failures
  ✅ Real-time progress - Shows [1/8] progress during generation
`);
    process.exit(0);
  }

  if (command === 'validate') {
    const specsPath = args[1];
    if (!specsPath) {
      console.error('Error: Please provide a specs file path');
      process.exit(1);
    }
    try {
      validateSpecsFile(specsPath);
    } catch (err: any) {
      console.error('Validation error:', err.message);
      process.exit(1);
    }
  } else if (command === 'preflight') {
    const slug = args[1];
    if (!slug) {
      console.error('Error: Please provide a slug');
      process.exit(1);
    }

    // Find specs to get image count
    const v2Path = `./drafts/${slug}-images-v2.json`;
    const v1Path = `./drafts/${slug}-images.json`;
    let specsPath = fs.existsSync(v2Path) ? v2Path : v1Path;

    if (!fs.existsSync(specsPath)) {
      console.error(`Error: No specs file found for ${slug}`);
      process.exit(1);
    }

    const specs = JSON.parse(fs.readFileSync(specsPath, 'utf-8'));
    const totalImages = (specs.sections?.length || specs.images?.length || 0) + 1;

    console.log(`\n🔍 Running pre-flight checks for ${slug}...`);
    console.log(`   Specs file: ${specsPath}`);
    console.log(`   Total images: ${totalImages}`);

    const result = await preflightCheck(totalImages);

    if (result.ok) {
      console.log(`\n✅ Pre-flight checks passed!`);
      if (result.credits !== undefined) {
        console.log(`   Credits: $${result.credits.toFixed(2)}`);
        console.log(`   Estimated cost: $${result.estimatedCost?.toFixed(2)}`);
      }
      process.exit(0);
    } else {
      console.error(`\n❌ Pre-flight failed: ${result.error}`);
      process.exit(1);
    }
  } else if (command === 'generate') {
    const slug = args[1];
    if (!slug) {
      console.error('Error: Please provide a slug');
      process.exit(1);
    }

    try {
      const images = await generateBlogImages(slug, { forceRegenerate, skipPreflight });
      console.log('\nGenerated images:');
      images.forEach(img => {
        console.log(`  - ${img.filePath}`);
      });
    } catch (err: any) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  } else {
    // Backward compatibility: treat first arg as slug
    try {
      const images = await generateBlogImages(command, { forceRegenerate, skipPreflight });
      console.log('\nGenerated images:');
      images.forEach(img => console.log(`  - ${img.filePath}`));
    } catch (err: any) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  }
}

// Run CLI if executed directly (ESM-compatible check)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch(console.error);
}
