import { MCPTool, MCPToolResponse } from '../types';
import { AIToolMetadata } from '../types/aiTools';
import { getTodaysEventsToolDefinition } from './tools/getTodaysEvents';
import { getEmailsToolDefinition } from './tools/getEmails';

export class MCPToolRegistry {
  private static instance: MCPToolRegistry;
  private tools = new Map<string, MCPTool>();
  private metadata = new Map<string, AIToolMetadata>();

  private constructor() {
    this.registerDefaultTools();
  }

  static getInstance(): MCPToolRegistry {
    if (!MCPToolRegistry.instance) {
      MCPToolRegistry.instance = new MCPToolRegistry();
    }
    return MCPToolRegistry.instance;
  }

  private registerDefaultTools() {
    // Register getTodaysEvents with AI metadata
    this.registerToolWithMetadata('getTodaysEvents', getTodaysEventsToolDefinition, {
      name: 'getTodaysEvents',
      description: 'Retrieves calendar events for the current day, including meeting times, titles, locations, and attendees',
      category: 'calendar',
      parameters: [
        {
          name: 'date',
          type: 'string',
          description: 'Specific date to get events for (YYYY-MM-DD format). If not provided, uses current date.',
          required: false,
          examples: ['2024-01-15', 'today']
        }
      ],
      examples: [
        {
          query: "What's on my calendar today?",
          expectedParams: {},
          description: "Get all events for today"
        },
        {
          query: "Do I have any meetings this morning?",
          expectedParams: {},
          description: "Get today's events (user will filter mentally for morning)"
        },
        {
          query: "What meetings do I have after lunch?",
          expectedParams: {},
          description: "Get today's events (AI will help filter in response)"
        },
        {
          query: "Show me my schedule for today",
          expectedParams: {},
          description: "Get full day schedule"
        }
      ],
      timeContext: 'current',
      dataAccess: 'read'
    });

    // Register getEmails with AI metadata
    this.registerToolWithMetadata('getEmails', getEmailsToolDefinition, {
      name: 'getEmails',
      description: 'Comprehensive Gmail email retrieval with advanced search, filtering, and customizable parameters including date ranges, labels, format options, and body content',
      category: 'email',
      parameters: [
        {
          name: 'maxResults',
          type: 'number',
          description: 'Maximum number of emails to retrieve (default: 20, max: 100)',
          required: false,
          examples: ['10', '50', '100']
        },
        {
          name: 'query',
          type: 'string',
          description: 'Gmail search query supporting full Gmail search syntax (from:, subject:, is:unread, etc.)',
          required: false,
          examples: ['from:boss@company.com', 'subject:meeting', 'is:unread', 'has:attachment']
        },
        {
          name: 'includeSpamTrash',
          type: 'boolean',
          description: 'Include emails from spam and trash folders (default: false)',
          required: false,
          examples: ['true', 'false']
        },
        {
          name: 'labelIds',
          type: 'array',
          description: 'Specific Gmail labels to search in (e.g., ["INBOX", "IMPORTANT"])',
          required: false,
          examples: ['["INBOX"]', '["IMPORTANT", "STARRED"]']
        },
        {
          name: 'format',
          type: 'string',
          description: 'Level of detail to retrieve: "full" (complete), "metadata" (headers only), "minimal" (basic info)',
          required: false,
          examples: ['full', 'metadata', 'minimal']
        },
        {
          name: 'includeBody',
          type: 'boolean',
          description: 'Whether to include email body content (default: true)',
          required: false,
          examples: ['true', 'false']
        },
        {
          name: 'dateRange',
          type: 'object',
          description: 'Date range filter with after/before dates in YYYY/MM/DD format',
          required: false,
          examples: ['{"after":"2024/01/01"}', '{"before":"2024/12/31"}', '{"after":"2024/01/01","before":"2024/01/31"}']
        }
      ],
      examples: [
        {
          query: "Check my emails",
          expectedParams: {},
          description: "Get recent emails from inbox"
        },
        {
          query: "Show me unread emails",
          expectedParams: { query: "is:unread" },
          description: "Filter for unread emails only"
        },
        {
          query: "Find emails from John with attachments",
          expectedParams: { query: "from:john has:attachment" },
          description: "Advanced search with multiple criteria"
        },
        {
          query: "Get emails from last week",
          expectedParams: { dateRange: { after: "2024/01/01" } },
          description: "Date-based filtering"
        },
        {
          query: "Show me 50 important emails",
          expectedParams: { maxResults: 50, labelIds: ["IMPORTANT"] },
          description: "Large result set with label filtering"
        },
        {
          query: "Get email headers only for performance",
          expectedParams: { format: "metadata", includeBody: false },
          description: "Minimal data retrieval for performance"
        }
      ],
      timeContext: 'any',
      dataAccess: 'read'
    });
  }

  private registerToolWithMetadata(name: string, tool: MCPTool, metadata: AIToolMetadata) {
    this.tools.set(name, tool);
    this.metadata.set(name, metadata);
    console.log(`📋 Registered AI-enabled tool: ${name}`);
  }

  // Legacy static methods for backward compatibility
  static registerTool(tool: MCPTool): void {
    const instance = MCPToolRegistry.getInstance();
    instance.tools.set(tool.name, tool);
    console.log(`Registered MCP tool: ${tool.name}`);
  }

  static getTool(name: string): MCPTool | undefined {
    return MCPToolRegistry.getInstance().tools.get(name);
  }

  static getAllTools(): MCPTool[] {
    return Array.from(MCPToolRegistry.getInstance().tools.values());
  }

  // New AI-enabled methods
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  getToolMetadata(name: string): AIToolMetadata | undefined {
    return this.metadata.get(name);
  }

  getAllToolMetadata(): AIToolMetadata[] {
    return Array.from(this.metadata.values());
  }

  getToolsByCategory(category: string): AIToolMetadata[] {
    return Array.from(this.metadata.values()).filter(tool => tool.category === category);
  }

  searchTools(query: string): AIToolMetadata[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.metadata.values()).filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.examples.some(example => example.query.toLowerCase().includes(lowerQuery))
    );
  }

  static async executeTool(
    name: string,
    userId: string,
    params?: any
  ): Promise<MCPToolResponse> {
    const tool = this.getTool(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      console.log(`Executing tool: ${name} for user: ${userId}`);
      return await tool.execute(userId, params);
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  static listTools(): Array<{
    name: string;
    description: string;
  }> {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}