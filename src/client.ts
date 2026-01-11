/**
 * MCP Client Wrapper
 * 
 * Following Anthropic's Code Execution pattern, this module provides
 * a central routing function for MCP tool calls that the agent can use
 * when writing code to interact with MCP servers.
 * 
 * @see https://www.anthropic.com/engineering/mcp-tool-usage
 */

import { MCPToolResponse } from './types/index.js';

// Server configurations loaded from environment or .mcp.json
interface MCPServerConfig {
  type: 'http' | 'stdio';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

const serverConfigs: Record<string, MCPServerConfig> = {
  ahrefs: {
    type: 'stdio',
    command: 'npx',
    args: [
      '-y',
      'mcp-remote',
      'https://api.ahrefs.com/mcp/mcp',
      '--header',
      `Authorization:${process.env.AHREFS_AUTH_HEADER || ''}`
    ]
  },
  supabase: {
    type: 'stdio',
    command: 'npx',
    args: [
      '-y',
      '@supabase/mcp-server-supabase@latest',
      '--access-token',
      process.env.SUPABASE_ACCESS_TOKEN || ''
    ]
  }
};

/**
 * Routes tool calls to the appropriate MCP server.
 * Tool names follow the pattern: server_name__tool_name
 * 
 * @example
 * // Call Ahrefs keyword volume tool
 * const result = await callMCPTool<AhrefsKeywordResult>(
 *   'ahrefs__get_keyword_volume',
 *   { keyword: 'your keyword' }
 * );
 */
export async function callMCPTool<T>(
  toolName: string,
  input: unknown
): Promise<MCPToolResponse<T>> {
  const [serverName, ...toolParts] = toolName.split('__');
  const actualToolName = toolParts.join('__');
  
  const config = serverConfigs[serverName];
  if (!config) {
    throw new Error(`Unknown MCP server: ${serverName}`);
  }

  // For now, return a placeholder response
  // The actual MCP routing will be handled by the Claude Agent SDK
  // when integrated with the query() function
  console.log(`[MCP] Calling ${serverName}.${actualToolName} with:`, input);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ server: serverName, tool: actualToolName, input })
    }]
  };
}

/**
 * Lists available tools from a specific MCP server.
 * Used for progressive disclosure - agent can discover tools on-demand.
 */
export async function listServerTools(serverName: string): Promise<string[]> {
  const toolsByServer: Record<string, string[]> = {
    ahrefs: [
      'keywords-explorer-volume-by-country',
      'serp-overview-serp-overview',
      'site-explorer-all-backlinks'
    ],
    firecrawl: [
      'scrape_url',
      'extract_structure',
      'batch_scrape'
    ],
    supabase: [
      'execute_sql',
      'list_tables',
      'get_schema'
    ],
    sanity: [
      'create_document',
      'upload_asset',
      'publish_document',
      'query'
    ],
    'image-gen': [
      'generate_isometric',
      'generate_hero'
    ]
  };

  return toolsByServer[serverName] || [];
}

/**
 * Gets detailed information about a specific tool.
 * Used for progressive disclosure when agent needs to understand tool interface.
 */
export async function getToolInfo(serverName: string, toolName: string): Promise<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  // Tool definitions - agent reads these on-demand
  const toolDefs: Record<string, Record<string, {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>> = {
    ahrefs: {
      get_keyword_volume: {
        name: 'get_keyword_volume',
        description: 'Get search volume and difficulty for a keyword',
        parameters: {
          keyword: { type: 'string', required: true, description: 'The keyword to research' },
          country: { type: 'string', default: 'us', description: 'Country code for localized data' }
        }
      },
      get_top_pages: {
        name: 'get_top_pages',
        description: 'Get top ranking pages for a keyword',
        parameters: {
          keyword: { type: 'string', required: true },
          limit: { type: 'number', default: 10 }
        }
      }
    },
    firecrawl: {
      scrape_url: {
        name: 'scrape_url',
        description: 'Scrape a URL and extract content as markdown',
        parameters: {
          url: { type: 'string', required: true },
          include_metadata: { type: 'boolean', default: true }
        }
      }
    },
    supabase: {
      execute_sql: {
        name: 'execute_sql',
        description: 'Execute a SQL query on the Supabase database',
        parameters: {
          query: { type: 'string', required: true }
        }
      }
    },
    sanity: {
      create_document: {
        name: 'create_document',
        description: 'Create a new document in Sanity CMS',
        parameters: {
          _type: { type: 'string', required: true },
          document: { type: 'object', required: true }
        }
      },
      upload_asset: {
        name: 'upload_asset',
        description: 'Upload an image asset to Sanity',
        parameters: {
          base64: { type: 'string', required: true },
          filename: { type: 'string', required: true },
          contentType: { type: 'string', default: 'image/png' }
        }
      }
    },
    'image-gen': {
      generate_isometric: {
        name: 'generate_isometric',
        description: 'Generate a 3D isometric illustration using Gemini',
        parameters: {
          prompt: { type: 'string', required: true },
          style: { type: 'string', default: '3d isometric, modern, teal and midnight palette' }
        }
      }
    }
  };

  const serverTools = toolDefs[serverName];
  if (!serverTools) {
    throw new Error(`Unknown server: ${serverName}`);
  }

  const tool = serverTools[toolName];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName} in server ${serverName}`);
  }

  return tool;
}

export { serverConfigs };

