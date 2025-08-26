import { supabase } from '../lib/supabase';

const MCP_BASE_URL = 'http://localhost:3001/api';

interface AIQueryRequest {
  query: string;
  preferences?: {
    responseStyle?: 'brief' | 'detailed' | 'conversational';
    includeActions?: boolean;
  };
}

interface AIQueryResponse {
  success: boolean;
  data?: {
    query: string;
    response: string;
    toolUsed?: string;
    reasoning?: string;
    suggestedActions?: string[];
    rawData?: any;
  };
  error?: string;
  timestamp: string;
}

interface AvailableToolsResponse {
  success: boolean;
  data?: {
    tools: Array<{
      name: string;
      description: string;
      category: string;
      examples: string[];
      dataAccess: 'read' | 'write' | 'both';
    }>;
    totalCount: number;
    categories: string[];
  };
  error?: string;
  timestamp: string;
}

export class AIService {
  /**
   * Process a natural language query using AI
   */
  static async processQuery(request: AIQueryRequest): Promise<AIQueryResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/ai/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ AI query error:', error);
      throw error;
    }
  }

  /**
   * Get list of available AI tools
   */
  static async getAvailableTools(): Promise<AvailableToolsResponse> {
    try {
      const response = await fetch(`${MCP_BASE_URL}/ai/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error getting available tools:', error);
      throw error;
    }
  }

  /**
   * Get tools by category
   */
  static async getToolsByCategory(category: string): Promise<any> {
    try {
      const response = await fetch(`${MCP_BASE_URL}/ai/tools/category/${category}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error getting tools by category:', error);
      throw error;
    }
  }

  /**
   * Helper method to format AI responses for display
   */
  static formatAIResponse(response: AIQueryResponse): string {
    if (!response.success || !response.data) {
      return response.error || 'Sorry, I couldn\'t process your request.';
    }

    let formatted = response.data.response;

    // Add reasoning if available and user might find it helpful
    if (response.data.reasoning && response.data.toolUsed) {
      formatted += `\n\n*Used ${response.data.toolUsed} to get this information*`;
    }

    return formatted;
  }

  /**
   * Get suggested follow-up questions based on the response
   */
  static getSuggestedQuestions(response: AIQueryResponse): string[] {
    if (!response.success || !response.data?.suggestedActions) {
      return [];
    }

    return response.data.suggestedActions.map(action => 
      action.replace(/^(Would you like to|Do you want to|Should I)/, '').trim()
    );
  }

  /**
   * Check if AI service is available
   */
  static async checkAIAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${MCP_BASE_URL}/ai/tools`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.status !== 503; // 503 means AI service not available
    } catch (error) {
      return false;
    }
  }
}