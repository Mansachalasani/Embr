import { MCPTool, MCPToolResponse } from '../types';
import { AIToolMetadata } from '../types/aiTools';
import { getTodaysEventsToolDefinition } from './tools/getTodaysEvents';
import { getEmailsToolDefinition } from './tools/getEmails';
import { getLastTenMailsToolDefinition } from './tools/getLastTenMails';
import { createCalendarEventToolDefinition } from './tools/createCalendarEvent';
import { crawlPageToolDefinition } from './tools/crawlPage';
import { searchWebToolDefinition } from './tools/searchWeb';

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

    // Register getLastTenMails with AI metadata
    this.registerToolWithMetadata('getLastTenMails', getLastTenMailsToolDefinition, {
      name: 'getLastTenMails',
      description: 'Quickly retrieve the last 10 emails from Gmail inbox for recent activity summary',
      category: 'email',
      parameters: [],
      examples: [
        {
          query: "Show me my recent emails",
          expectedParams: {},
          description: "Get the last 10 emails"
        },
        {
          query: "What are my latest emails?",
          expectedParams: {},
          description: "Quick email summary"
        }
      ],
      timeContext: 'recent',
      dataAccess: 'read'
    });

    // Register createCalendarEvent with AI metadata
    this.registerToolWithMetadata('createCalendarEvent', createCalendarEventToolDefinition, {
      name: 'createCalendarEvent',
      description: 'Create a new Google Calendar event with specified details including title, time, attendees, and location',
      category: 'calendar',
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Event title/subject',
          required: true,
          examples: ['Team Meeting', 'Doctor Appointment', 'Project Review']
        },
        {
          name: 'start_time',
          type: 'string',
          description: 'Event start time in ISO format (e.g., 2024-01-15T15:00:00.000Z)',
          required: true,
          examples: ['2024-01-15T15:00:00.000Z', '2024-02-01T09:30:00.000Z']
        },
        {
          name: 'end_time',
          type: 'string',
          description: 'Event end time in ISO format (e.g., 2024-01-15T16:00:00.000Z)',
          required: true,
          examples: ['2024-01-15T16:00:00.000Z', '2024-02-01T10:30:00.000Z']
        },
        {
          name: 'attendees',
          type: 'array',
          description: 'Array of attendee email addresses',
          required: false,
          examples: ['["john@company.com", "sarah@company.com"]', '["team@company.com"]']
        },
        {
          name: 'description',
          type: 'string',
          description: 'Event description/agenda',
          required: false,
          examples: ['Weekly team sync', 'Discuss project roadmap']
        },
        {
          name: 'location',
          type: 'string',
          description: 'Event location (physical or virtual)',
          required: false,
          examples: ['Conference Room A', 'https://zoom.us/j/123456789', 'Central Park']
        }
      ],
      examples: [
        {
          query: "Schedule a team meeting for tomorrow at 2 PM",
          expectedParams: { title: "Team Meeting", start_time: "2024-01-16T14:00:00.000Z", end_time: "2024-01-16T15:00:00.000Z" },
          description: "Create meeting with calculated date/time"
        },
        {
          query: "Create a doctor appointment for next Monday at 10 AM to 11 AM",
          expectedParams: { title: "Doctor Appointment", start_time: "2024-01-22T10:00:00.000Z", end_time: "2024-01-22T11:00:00.000Z" },
          description: "Healthcare appointment scheduling"
        }
      ],
      timeContext: 'future',
      dataAccess: 'write'
    });

    // Register crawlPage with AI metadata
    this.registerToolWithMetadata('crawlPage', crawlPageToolDefinition, {
      name: 'crawlPage',
      description: 'Crawl and extract content from web pages for analysis and information retrieval',
      category: 'web',
      parameters: [
        {
          name: 'url',
          type: 'string',
          description: 'URL of the web page to crawl (must be HTTP or HTTPS)',
          required: true,
          examples: ['https://example.com', 'https://news.ycombinator.com', 'https://github.com/user/repo']
        },
        {
          name: 'extract_content',
          type: 'boolean',
          description: 'Whether to extract main content (true) or return full HTML (false). Default: true',
          required: false,
          examples: ['true', 'false']
        },
        {
          name: 'max_length',
          type: 'number',
          description: 'Maximum number of characters to return. Default: 5000',
          required: false,
          examples: ['1000', '5000', '10000']
        }
      ],
      examples: [
        {
          query: "What's the latest news on Hacker News?",
          expectedParams: { url: "https://news.ycombinator.com" },
          description: "Crawl news website for current information"
        },
        {
          query: "Analyze the content of this GitHub repository",
          expectedParams: { url: "https://github.com/user/repo" },
          description: "Extract information from GitHub pages"
        },
        {
          query: "Get the main content from this article",
          expectedParams: { url: "https://example.com/article", extract_content: true },
          description: "Extract clean article content"
        }
      ],
      timeContext: 'current',
      dataAccess: 'read'
    });

    // Register searchWeb with AI metadata
    this.registerToolWithMetadata('searchWeb', searchWebToolDefinition, {
      name: 'searchWeb',
      description: 'Search the web for current information, news, and answers using natural language queries',
      category: 'search',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Natural language search query',
          required: true,
          examples: ['latest AI news', 'GPT-5 release date', 'weather in New York', 'Bitcoin price today']
        },
        {
          name: 'max_results',
          type: 'number',
          description: 'Maximum number of results to return (default: 10, max: 20)',
          required: false,
          examples: ['5', '10', '20']
        },
        {
          name: 'region',
          type: 'string',
          description: 'Search region/country code (default: us)',
          required: false,
          examples: ['us', 'uk', 'ca', 'au']
        }
      ],
      examples: [
        {
          query: "What's the weather in Hyderabad today?",
          expectedParams: { query: "weather Hyderabad today", max_results: 5 },
          description: "Get current weather information"
        },
        {
          query: "Latest news about AI developments",
          expectedParams: { query: "latest AI news developments 2024", max_results: 10 },
          description: "Search for recent AI news"
        },
        {
          query: "What movies are playing near me?",
          expectedParams: { query: "movie showtimes near me today", max_results: 10 },
          description: "Find current movie showtimes"
        },
        {
          query: "Bitcoin price right now",
          expectedParams: { query: "Bitcoin price today current", max_results: 5 },
          description: "Get current cryptocurrency prices"
        },
        {
          query: "Best restaurants in San Francisco",
          expectedParams: { query: "best restaurants San Francisco 2024", max_results: 10 },
          description: "Find local restaurant recommendations"
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