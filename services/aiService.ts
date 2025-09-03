import { supabase } from '../lib/supabase';

const MCP_BASE_URL = 'http://localhost:3001/api';

interface AIQueryRequest {
  query: string;
  sessionId?: string;
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
   * Process a natural language query using AI with conversation context
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

  /**
   * Call a specific MCP tool directly
   */
  static async callMCPTool(toolName: string, params: any = {}): Promise<any> {
    console.log(`🔧 Calling MCP tool: ${toolName} with params:`, JSON.stringify(params, null, 2));
    
    try {
      // Get the current session to include access token if needed
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      console.log(`🌐 Making request to: ${MCP_BASE_URL}/mcp/tools/${toolName}/execute`);
      
      const response = await fetch(`${MCP_BASE_URL}/mcp/tools/${toolName}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP Error response body:`, errorText);
        
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log(`✅ MCP tool ${toolName} response:`, JSON.stringify(responseData, null, 2));
      
      return responseData;
    } catch (error) {
      console.error(`❌ Error calling MCP tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
        timestamp: new Date().toISOString()
      };
    }
  }
}