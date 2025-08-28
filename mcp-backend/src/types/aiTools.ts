export interface AIToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  examples?: string[];
}

export interface AIToolMetadata {
  name: string;
  description: string;
  category: 'calendar' | 'email' | 'productivity' | 'system' | 'web' | 'external' | 'social' | 'custom' | 'search';
  parameters: AIToolParameter[];
  examples: {
    query: string;
    expectedParams: Record<string, any>;
    description: string;
  }[];
  timeContext?: 'current' | 'future' | 'past' | 'any' | 'recent';
  dataAccess: 'read' | 'write' | 'both';
}

export interface AIToolSelection {
  tool: string;
  confidence: number;
  parameters: Record<string, any>;
  reasoning: string;
  geminiOutput?: string;
}

export interface AIResponse {
  success: boolean;
  toolUsed?: string;
  rawData?: any;
  naturalResponse: string;
  reasoning?: string;
  suggestedActions?: string[];
  chainedTools?: string[];
  error?: string;
}

export interface UserContext {
  query: string;
  timestamp: string;
  timezone?: string;
  sessionId?: string;
  preferences?: {
    responseStyle: 'brief' | 'detailed' | 'conversational';
    includeActions: boolean;
  };
}