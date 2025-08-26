import { MCPToolRegistry } from '../mcpToolRegistry';
import { getTodaysEventsToolDefinition } from './getTodaysEvents';
import { getLastTenMailsToolDefinition } from './getLastTenMails';

// Register all tools
export function registerAllTools() {
  MCPToolRegistry.registerTool(getTodaysEventsToolDefinition);
  MCPToolRegistry.registerTool(getLastTenMailsToolDefinition);
}

// Export tool definitions for potential individual use
export {
  getTodaysEventsToolDefinition,
  getLastTenMailsToolDefinition,
};