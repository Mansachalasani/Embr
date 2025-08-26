import { MCPTool, MCPToolResponse } from '../types';

export class MCPToolRegistry {
  private static tools = new Map<string, MCPTool>();

  static registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    console.log(`Registered MCP tool: ${tool.name}`);
  }

  static getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  static getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
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