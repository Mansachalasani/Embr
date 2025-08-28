import { MCPToolRegistry } from '../mcpToolRegistry';
import { getTodaysEventsToolDefinition } from './getTodaysEvents';
import { getLastTenMailsToolDefinition } from './getLastTenMails';
import { getEmailsToolDefinition } from './getEmails';
import { createCalendarEventToolDefinition } from './createCalendarEvent';
import { crawlPageToolDefinition } from './crawlPage';
import { searchWebToolDefinition } from './searchWeb';

// Register all tools
export function registerAllTools() {
  MCPToolRegistry.registerTool(getTodaysEventsToolDefinition);
  MCPToolRegistry.registerTool(getLastTenMailsToolDefinition);
  MCPToolRegistry.registerTool(getEmailsToolDefinition);
  MCPToolRegistry.registerTool(createCalendarEventToolDefinition);
  MCPToolRegistry.registerTool(crawlPageToolDefinition);
  MCPToolRegistry.registerTool(searchWebToolDefinition);
}

// Export tool definitions for potential individual use
export {
  getTodaysEventsToolDefinition,
  getLastTenMailsToolDefinition,
  getEmailsToolDefinition,
  createCalendarEventToolDefinition,
  crawlPageToolDefinition,
  searchWebToolDefinition,
};