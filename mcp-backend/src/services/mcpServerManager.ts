import { MCPTool } from '../types';
import { AIToolMetadata } from '../types/aiTools';

export interface MCPServer {
  name: string;
  description: string;
  category: string;
  tools: MCPTool[];
  metadata: Record<string, AIToolMetadata>;
  enabled: boolean;
}

export interface ServerConfig {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  toolFactory: () => Promise<{
    tools: MCPTool[];
    metadata: Record<string, AIToolMetadata>;
  }>;
}

export class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map();
  private static instance: MCPServerManager;

  private constructor() {}

  static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager();
    }
    return MCPServerManager.instance;
  }

  /**
   * Register a new MCP server with its tools
   */
  async registerServer(config: ServerConfig): Promise<void> {
    try {
      console.log(`🔌 Registering MCP server: ${config.name}`);
      
      if (!config.enabled) {
        console.log(`⏸️ Server ${config.name} is disabled, skipping registration`);
        return;
      }

      // Load tools from the server
      const { tools, metadata } = await config.toolFactory();
      
      const server: MCPServer = {
        name: config.name,
        description: config.description,
        category: config.category,
        tools,
        metadata,
        enabled: true,
      };

      this.servers.set(config.name, server);
      
      console.log(`✅ Registered server ${config.name} with ${tools.length} tools:`, 
        tools.map(t => t.name).join(', '));

    } catch (error) {
      console.error(`❌ Failed to register server ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Get all tools from all enabled servers
   */
  getAllTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    
    for (const server of this.servers.values()) {
      if (server.enabled) {
        allTools.push(...server.tools);
      }
    }
    
    return allTools;
  }

  /**
   * Get all tool metadata from all enabled servers
   */
  getAllToolMetadata(): AIToolMetadata[] {
    const allMetadata: AIToolMetadata[] = [];
    
    for (const server of this.servers.values()) {
      if (server.enabled) {
        allMetadata.push(...Object.values(server.metadata));
      }
    }
    
    return allMetadata;
  }

  /**
   * Get a specific tool by name
   */
  getTool(toolName: string): MCPTool | undefined {
    for (const server of this.servers.values()) {
      if (server.enabled) {
        const tool = server.tools.find(t => t.name === toolName);
        if (tool) {
          return tool;
        }
      }
    }
    return undefined;
  }

  /**
   * Get tool metadata by name
   */
  getToolMetadata(toolName: string): AIToolMetadata | undefined {
    for (const server of this.servers.values()) {
      if (server.enabled) {
        if (server.metadata[toolName]) {
          return server.metadata[toolName];
        }
      }
    }
    return undefined;
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): AIToolMetadata[] {
    const tools: AIToolMetadata[] = [];
    
    for (const server of this.servers.values()) {
      if (server.enabled) {
        for (const metadata of Object.values(server.metadata)) {
          if (metadata.category === category) {
            tools.push(metadata);
          }
        }
      }
    }
    
    return tools;
  }

  /**
   * Get all registered servers
   */
  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by name
   */
  getServer(serverName: string): MCPServer | undefined {
    return this.servers.get(serverName);
  }

  /**
   * Enable/disable a server
   */
  setServerEnabled(serverName: string, enabled: boolean): void {
    const server = this.servers.get(serverName);
    if (server) {
      server.enabled = enabled;
      console.log(`${enabled ? '✅ Enabled' : '⏸️ Disabled'} server: ${serverName}`);
    }
  }

  /**
   * Search tools across all servers
   */
  searchTools(query: string): AIToolMetadata[] {
    const lowerQuery = query.toLowerCase();
    const results: AIToolMetadata[] = [];
    
    for (const server of this.servers.values()) {
      if (server.enabled) {
        for (const metadata of Object.values(server.metadata)) {
          if (
            metadata.name.toLowerCase().includes(lowerQuery) ||
            metadata.description.toLowerCase().includes(lowerQuery) ||
            metadata.examples.some(example => 
              example.query.toLowerCase().includes(lowerQuery)
            )
          ) {
            results.push(metadata);
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalServers: number;
    enabledServers: number;
    totalTools: number;
    toolsByCategory: Record<string, number>;
  } {
    const servers = Array.from(this.servers.values());
    const enabledServers = servers.filter(s => s.enabled);
    const allTools = this.getAllToolMetadata();
    
    const toolsByCategory: Record<string, number> = {};
    for (const tool of allTools) {
      toolsByCategory[tool.category] = (toolsByCategory[tool.category] || 0) + 1;
    }
    
    return {
      totalServers: servers.length,
      enabledServers: enabledServers.length,
      totalTools: allTools.length,
      toolsByCategory,
    };
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, userId: string, params?: any): Promise<any> {
    const tool = this.getTool(toolName);
    
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }
    
    try {
      console.log(`🔧 Executing tool: ${toolName} for user: ${userId}`);
      return await tool.execute(userId, params);
    } catch (error) {
      console.error(`❌ Error executing tool ${toolName}:`, error);
      throw error;
    }
  }
}