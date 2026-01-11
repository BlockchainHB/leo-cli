#!/usr/bin/env node
/**
 * CLI: Perplexity Web Search
 * 
 * Usage: npx tsx src/cli/perplexity-search.ts "your search query" [recency]
 * 
 * Recency options: day, week, month (default), year
 * 
 * Outputs JSON to stdout.
 */

import { config } from 'dotenv';
import { searchWeb } from '../servers/perplexity/searchWeb.js';

config();

async function main() {
  const query = process.argv[2];
  const recency = (process.argv[3] as 'day' | 'week' | 'month' | 'year') || 'month';

  if (!query) {
    console.error('Usage: perplexity-search "query" [recency]');
    process.exit(1);
  }

  try {
    const result = await searchWeb({ query, recency });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: (error as Error).message }));
    process.exit(1);
  }
}

main();

