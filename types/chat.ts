export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    toolName?: string;
    toolData?: any;
    error?: boolean;
    loading?: boolean;
  };
}

export interface MCPCommand {
  command: string;
  description: string;
  example: string;
  toolName: string;
}

export const AVAILABLE_COMMANDS: MCPCommand[] = [
  {
    command: '/connect',
    description: 'Connect your Google Workspace account',
    example: '/connect',
    toolName: 'googleConnect',
  },
  {
    command: '/calendar',
    description: 'Get today\'s calendar events (requires Google connection)',
    example: '/calendar',
    toolName: 'getTodaysEvents',
  },
  {
    command: '/emails',
    description: 'Get last 10 emails (requires Google connection)',
    example: '/emails',
    toolName: 'getLastTenMails',
  },
  {
    command: '/status',
    description: 'Check MCP backend and Google connection status',
    example: '/status',
    toolName: 'status',
  },
  {
    command: '/test',
    description: 'Test backend connection and troubleshoot issues',
    example: '/test',
    toolName: 'connectionTest',
  },
  {
    command: '/debug',
    description: 'Debug authentication and token issues',
    example: '/debug',
    toolName: 'tokenDebug',
  },
  {
    command: '/help',
    description: 'Show available commands',
    example: '/help',
    toolName: 'help',
  },
];