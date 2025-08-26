import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { AIService } from '../services/aiService';
import { UserContext } from '../types/aiTools';

export class AIController {
  private static aiService: AIService;

  static async initializeAI(): Promise<void> {
    try {
      AIController.aiService = new AIService();
      console.log('🧠 AI Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error);
      // Don't throw - let the app continue without AI features
    }
  }

  static async processNaturalLanguageQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!AIController.aiService) {
        res.status(503).json({
          success: false,
          error: 'AI Service not available. Please check GEMINI_API_KEY configuration.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { query, preferences } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Query is required and must be a string',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      console.log(`🧠 Processing AI query for ${req.user.email}: "${query}"`);

      const context: UserContext = {
        query: query.trim(),
        timestamp: new Date().toISOString(),
        timezone: req.headers['x-timezone'] as string || 'UTC',
        preferences: {
          responseStyle: preferences?.responseStyle || 'conversational',
          includeActions: preferences?.includeActions !== false,
          ...preferences
        }
      };

      const result = await AIController.aiService.processQuery(context, req.user.id);

      res.json({
        success: result.success,
        data: {
          query: context.query,
          response: result.naturalResponse,
          toolUsed: result.toolUsed,
          reasoning: result.reasoning,
          suggestedActions: result.suggestedActions,
          rawData: result.rawData, // Include for debugging/advanced users
        },
        error: result.error,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('❌ Error in AI query processing:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while processing AI query',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async getAvailableTools(req: Request, res: Response): Promise<void> {
    try {
      if (!AIController.aiService) {
        res.status(503).json({
          success: false,
          error: 'AI Service not available',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const registry = AIController.aiService['toolRegistry']; // Access private property for this endpoint
      const tools = registry.getAllToolMetadata();

      res.json({
        success: true,
        data: {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            examples: tool.examples.map(ex => ex.query),
            dataAccess: tool.dataAccess
          })),
          totalCount: tools.length,
          categories: [...new Set(tools.map(t => t.category))]
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('❌ Error getting available tools:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available tools',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async getToolsByCategory(req: Request, res: Response): Promise<void> {
    try {
      if (!AIController.aiService) {
        res.status(503).json({
          success: false,
          error: 'AI Service not available',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { category } = req.params;
      
      if (!category) {
        res.status(400).json({
          success: false,
          error: 'Category parameter is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const registry = AIController.aiService['toolRegistry'];
      const tools = registry.getToolsByCategory(category);

      res.json({
        success: true,
        data: {
          category,
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            examples: tool.examples.map(ex => ex.query)
          })),
          count: tools.length
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('❌ Error getting tools by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tools by category',
        timestamp: new Date().toISOString(),
      });
    }
  }
}