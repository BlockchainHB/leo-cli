#!/usr/bin/env node
/**
 * CLI: DataForSEO SERP Search
 *
 * Usage: npx tsx src/cli/dataforseo-serp.ts "your keyword" [depth]
 *
 * Arguments:
 *   keyword - The search keyword (required)
 *   depth   - Number of results to return (default: 10)
 *
 * Outputs JSON with top URLs, titles, and descriptions.
 *
 * Environment variables required:
 *   DATAFORSEO_LOGIN
 *   DATAFORSEO_PASSWORD
 */

import { config } from 'dotenv';
import { getSerpResults } from '../servers/dataforseo/index.js';

config();

async function main() {
  const keyword = process.argv[2];
  const depth = parseInt(process.argv[3] || '10', 10);

  if (!keyword) {
    console.error('Usage: dataforseo-serp "keyword" [depth]');
    console.error('');
    console.error('Example: dataforseo-serp "marketing automation tools" 10');
    process.exit(1);
  }

  try {
    const result = await getSerpResults({
      keyword,
      depth,
      location: 'United States',
      language: 'English',
    });

    // Format output for easy consumption by Leo/subagents
    const output = {
      keyword: result.keyword,
      totalResults: result.totalResults,
      topUrls: result.results.map(r => ({
        position: r.position,
        url: r.url,
        title: r.title,
        description: r.description,
        domain: r.domain,
        contentType: r.contentType,
        // Only include optional fields if they have values
        ...(r.timestamp && { publishDate: r.timestamp.split(' ')[0] }),
        ...(r.websiteName && { websiteName: r.websiteName }),
        ...(r.breadcrumb && { breadcrumb: r.breadcrumb }),
      })),
      metadata: {
        queriedAt: result.metadata.queriedAt,
        location: result.metadata.location,
        language: result.metadata.language,
        positionsReturned: result.metadata.positionsReturned,
        positionGaps: result.metadata.positionGaps,
        // Explain what fills the gaps (ads, featured snippets, etc.)
        itemTypeCounts: result.metadata.itemTypes,
      },
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const err = error as Error;
    console.error(JSON.stringify({
      error: err.message,
      // Include more context for debugging
      type: err.name || 'Error',
      hint: err.message.includes('DATAFORSEO')
        ? 'Check that DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are set in .env'
        : err.message.includes('fetch')
          ? 'Network error - check internet connection'
          : 'See DataForSEO API docs for error details',
    }));
    process.exit(1);
  }
}

main();
