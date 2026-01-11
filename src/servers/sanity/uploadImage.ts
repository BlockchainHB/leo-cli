/**
 * Sanity: Upload Image
 * 
 * Uploads an image asset to Sanity CMS from base64 data or file path.
 */

import { createClient } from '@sanity/client';
import * as fs from 'fs';
import * as path from 'path';

interface UploadImageInput {
  /** Base64 encoded image data (use this OR filePath) */
  base64?: string;
  /** File path to image (use this OR base64) */
  filePath?: string;
  /** Filename for the asset */
  filename: string;
  /** Alt text for accessibility */
  altText: string;
  /** MIME type (default: auto-detected or image/png) */
  contentType?: string;
}

interface UploadImageResponse {
  /** Sanity asset ID */
  assetId: string;
  /** Asset reference for document fields */
  assetRef: string;
  /** CDN URL for the image */
  url: string;
  /** Alt text */
  altText: string;
}

// Get Sanity API token (supports both SANITY_API_TOKEN and SANITY_API_KEY)
function getSanityToken(): string | undefined {
  return process.env.SANITY_API_TOKEN || process.env.SANITY_API_KEY;
}

// Lazy-initialized Sanity client
let sanityClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!sanityClient) {
    const projectId = process.env.SANITY_PROJECT_ID;
    if (!projectId) {
      throw new Error('SANITY_PROJECT_ID environment variable is required');
    }
    sanityClient = createClient({
      projectId,
      dataset: process.env.SANITY_DATASET || 'production',
      apiVersion: '2025-01-01',
      token: getSanityToken(),
      useCdn: false
    });
  }
  return sanityClient;
}

/**
 * Upload an image to Sanity CMS.
 * 
 * @example
 * const asset = await uploadImage({
 *   base64: imageData,
 *   filename: 'my-post-hero.png',
 *   altText: 'Hero image for my blog post'
 * });
 * // Use asset.assetRef in document heroImage field
 */
export async function uploadImage(
  input: UploadImageInput
): Promise<UploadImageResponse> {
  const client = getClient();
  
  if (!getSanityToken()) {
    console.warn('[Sanity] No API token found, returning mock asset');
    return {
      assetId: 'mock-asset-id',
      assetRef: 'image-mock-asset-id',
      url: 'https://cdn.sanity.io/images/mock/mock.png',
      altText: input.altText
    };
  }

  try {
    let buffer: Buffer;
    let contentType = input.contentType;
    
    if (input.filePath) {
      // Read from file path
      if (!fs.existsSync(input.filePath)) {
        throw new Error(`Image file not found: ${input.filePath}`);
      }
      buffer = fs.readFileSync(input.filePath);
      
      // Auto-detect content type from extension
      if (!contentType) {
        const ext = path.extname(input.filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml'
        };
        contentType = mimeTypes[ext] || 'image/png';
      }
    } else if (input.base64) {
    // Convert base64 to buffer
      buffer = Buffer.from(input.base64, 'base64');
      contentType = contentType || 'image/png';
    } else {
      throw new Error('Either base64 or filePath must be provided');
    }
    
    // Upload to Sanity
    const asset = await client.assets.upload('image', buffer, {
      filename: input.filename,
      contentType
    });

    console.log(`[Sanity] ✅ Uploaded image: ${input.filename} → ${asset._id}`);

    return {
      assetId: asset._id,
      assetRef: asset._id,
      url: asset.url,
      altText: input.altText
    };
  } catch (error) {
    console.error('[Sanity] Image upload failed:', error);
    throw error;
  }
}

/**
 * Upload multiple images in parallel.
 */
export async function uploadImages(
  images: UploadImageInput[]
): Promise<UploadImageResponse[]> {
  const results = await Promise.all(
    images.map(img => uploadImage(img).catch(err => {
      console.error(`Failed to upload ${img.filename}:`, err);
      return null;
    }))
  );
  
  return results.filter((r): r is UploadImageResponse => r !== null);
}

