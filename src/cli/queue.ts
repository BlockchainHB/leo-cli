#!/usr/bin/env node
/**
 * Queue CLI
 *
 * Unified interface for keyword queue management.
 * Routes to local queue or Supabase based on configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  loadQueue,
  addKeyword,
  addKeywords,
  getNextKeyword,
  getQueueStats,
  getKeywordsByStatus,
  markInProgress,
  markDrafted,
  markPublished,
  markFailed,
  resetKeyword,
  importFromFile,
  exportToCSV,
  Keyword,
  KeywordStatus
} from '../servers/queue/local-queue.js';

// Check if config uses Supabase
function usesSupabase(): boolean {
  const configPath = path.join(process.cwd(), 'leo.config.json');
  if (!fs.existsSync(configPath)) {
    return false;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.queue?.provider === 'supabase';
  } catch {
    return false;
  }
}

// Format keyword for display
function formatKeyword(kw: Keyword): string {
  const status = kw.status.toUpperCase().padEnd(12);
  const priority = `P${kw.priority}`;
  return `[${kw.id}] ${status} ${priority} "${kw.keyword}"`;
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Check for Supabase mode
  if (usesSupabase()) {
    console.log('Note: Using Supabase queue. For local queue, update leo.config.json');
    // TODO: Route to Supabase queue when implemented
  }

  switch (command) {
    case 'add': {
      const keyword = args.slice(1).join(' ');
      if (!keyword) {
        console.error('Usage: queue add "your keyword"');
        process.exit(1);
      }
      const added = addKeyword(keyword);
      console.log('Added keyword:');
      console.log(formatKeyword(added));
      break;
    }

    case 'add-batch': {
      const keywords = args.slice(1);
      if (keywords.length === 0) {
        console.error('Usage: queue add-batch "keyword1" "keyword2" "keyword3"');
        process.exit(1);
      }
      const added = addKeywords(keywords);
      console.log(`Added ${added.length} keywords:`);
      added.forEach(kw => console.log(formatKeyword(kw)));
      break;
    }

    case 'next': {
      const next = getNextKeyword();
      if (next) {
        console.log(JSON.stringify(next, null, 2));
      } else {
        console.log('No pending keywords in queue');
      }
      break;
    }

    case 'status': {
      const stats = getQueueStats();
      console.log('\nKeyword Queue Status');
      console.log('='.repeat(30));
      console.log(`Total:       ${stats.total}`);
      console.log(`Pending:     ${stats.pending}`);
      console.log(`In Progress: ${stats.inProgress}`);
      console.log(`Drafted:     ${stats.drafted}`);
      console.log(`Scheduled:   ${stats.scheduled}`);
      console.log(`Published:   ${stats.published}`);
      console.log(`Failed:      ${stats.failed}`);
      break;
    }

    case 'list': {
      const status = (args[1] as KeywordStatus) || 'pending';
      const limit = parseInt(args[2]) || 20;
      const keywords = getKeywordsByStatus(status, limit);

      if (keywords.length === 0) {
        console.log(`No ${status} keywords`);
      } else {
        console.log(`\n${status.toUpperCase()} Keywords (${keywords.length}):`);
        console.log('-'.repeat(50));
        keywords.forEach(kw => console.log(formatKeyword(kw)));
      }
      break;
    }

    case 'mark': {
      const id = parseInt(args[1]);
      const newStatus = args[2] as KeywordStatus;

      if (!id || !newStatus) {
        console.error('Usage: queue mark <id> <status>');
        console.error('Status: pending, in_progress, drafted, scheduled, published, failed');
        process.exit(1);
      }

      let result: Keyword | null = null;
      switch (newStatus) {
        case 'in_progress':
          result = markInProgress(id);
          break;
        case 'drafted':
          result = markDrafted(id);
          break;
        case 'published':
          result = markPublished(id);
          break;
        case 'failed':
          result = markFailed(id);
          break;
        case 'pending':
          result = resetKeyword(id);
          break;
        default:
          console.error(`Unknown status: ${newStatus}`);
          process.exit(1);
      }

      if (result) {
        console.log('Updated:');
        console.log(formatKeyword(result));
      } else {
        console.error(`Keyword not found: ${id}`);
        process.exit(1);
      }
      break;
    }

    case 'import': {
      const filePath = args[1];
      const cluster = args[2];

      if (!filePath) {
        console.error('Usage: queue import <file> [topic-cluster]');
        process.exit(1);
      }

      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }

      const imported = importFromFile(filePath, cluster);
      console.log(`Imported ${imported.length} keywords from ${filePath}`);
      break;
    }

    case 'export': {
      const outputPath = args[1] || 'keywords-export.csv';
      exportToCSV(outputPath);
      console.log(`Exported queue to: ${outputPath}`);
      break;
    }

    case 'json': {
      const queue = loadQueue();
      console.log(JSON.stringify(queue, null, 2));
      break;
    }

    default:
      console.log(`
Leo Keyword Queue CLI

Commands:
  add "keyword"              Add a single keyword
  add-batch "kw1" "kw2"      Add multiple keywords
  next                       Get the next pending keyword (JSON)
  status                     Show queue statistics
  list [status] [limit]      List keywords by status
  mark <id> <status>         Update keyword status
  import <file> [cluster]    Import keywords from file
  export [file]              Export queue to CSV
  json                       Output full queue as JSON

Status values: pending, in_progress, drafted, scheduled, published, failed

Examples:
  npx tsx src/cli/queue.ts add "how to start a blog"
  npx tsx src/cli/queue.ts list pending 10
  npx tsx src/cli/queue.ts mark 5 in_progress
  npx tsx src/cli/queue.ts import keywords.txt "blogging"
`);
  }
}

main().catch(console.error);
