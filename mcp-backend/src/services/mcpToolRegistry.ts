import { MCPTool, MCPToolResponse } from '../types';
import { AIToolMetadata } from '../types/aiTools';
import { getTodaysEventsToolDefinition } from './tools/getTodaysEvents';
import { getLastTenMailsToolDefinition } from './tools/getLastTenMails';

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

    // Register getLastTenMails with AI metadata
    this.registerToolWithMetadata('getLastTenMails', getLastTenMailsToolDefinition, {
      name: 'getLastTenMails',
      description: 'Retrieves the 10 most recent emails from Gmail inbox, including sender, subject, date, and snippet',
      category: 'email',
      parameters: [
        {
          name: 'maxResults',
          type: 'number',
          description: 'Maximum number of emails to retrieve (default: 10, max: 50)',
          required: false,
          examples: ['5', '20']
        },
        {
          name: 'query',
          type: 'string',
          description: 'Gmail search query to filter emails (e.g., "from:john@example.com", "subject:urgent")',
          required: false,
          examples: ['from:boss@company.com', 'subject:meeting', 'is:unread']
        }
      ],
      examples: [
        {
          query: "Check my emails",
          expectedParams: {},
          description: "Get latest 10 emails"
        },
        {
          query: "Do I have any new messages?",
          expectedParams: {},
          description: "Get recent emails to check for new ones"
        },
        {
          query: "Show me emails from my manager",
          expectedParams: { query: "from:manager@company.com" },
          description: "Filter emails by sender"
        },
        {
          query: "Any urgent emails?",
          expectedParams: { query: "subject:urgent OR subject:important" },
          description: "Filter for urgent emails"
        }
      ],
      timeContext: 'current',
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