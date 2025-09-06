import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIToolMetadata, AIToolSelection, AIResponse, UserContext } from '../types/aiTools';
import { MCPToolRegistry } from './mcpToolRegistry';
import { SessionService } from './sessionService';

export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private toolRegistry: MCPToolRegistry;
  private responseCache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.toolRegistry = MCPToolRegistry.getInstance();
  }

  /**
   * Enrich user context with personalization preferences
   */
  private async enrichContextWithPreferences(context: UserContext, userId: string): Promise<UserContext> {
    try {
      const { supabase } = require('../config/supabase');
      
      // Fetch user preferences from database
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferences, onboarding_completed')
        .eq('user_id', userId)
        .single();

      if (error || !data?.preferences) {
        console.log('📋 No user preferences found, using defaults');
        return context; // Return original context if no preferences found
      }

      const preferences = data.preferences;
      console.log('🎨 Enriching context with user preferences:', {
        tone: preferences.communicationStyle?.tone,
        detailLevel: preferences.communicationStyle?.detail_level,
        interests: preferences.contentPreferences?.primary_interests?.length || 0,
        onboardingCompleted: data.onboarding_completed
      });

      // Create enriched context with preferences
      const enrichedContext: UserContext = {
        ...context,
        preferences: {
          ...context.preferences,
          // Map user personalization data to existing preferences structure
          responseStyle: this.mapDetailLevelToResponseStyle(preferences.communicationStyle?.detail_level),
          includeActions: preferences.assistantBehavior?.suggest_related_topics || false,
          isVoiceMode: context.preferences?.isVoiceMode || false,
          cleanForSpeech: context.preferences?.cleanForSpeech || false,
          isVoiceQuery: context.preferences?.isVoiceQuery || false,
        },
        // Add personalization data for AI prompt generation
        personalization: {
          userPreferences: preferences,
          onboardingCompleted: data.onboarding_completed,
          currentContext: {
            timeOfDay: new Date().getHours() < 12 ? 'morning' : 
                      new Date().getHours() < 17 ? 'afternoon' : 'evening',
            dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            timestamp: new Date().toISOString(),
          }
        }
      };

      return enrichedContext;
    } catch (error) {
      console.error('❌ Error enriching context with preferences:', error);
      return context; // Fallback to original context on error
    }
  }

  /**
   * Map detail level preference to response style
   */
  private mapDetailLevelToResponseStyle(detailLevel?: string): 'brief' | 'detailed' | 'conversational' {
    switch (detailLevel) {
      case 'brief': return 'brief';
      case 'detailed': 
      case 'comprehensive': return 'detailed';
      default: return 'conversational';
    }
  }

  /**
   * Main AI reasoning pipeline
   */
  async processQuery(context: UserContext, userId: string): Promise<AIResponse> {
    try {
      console.log('🧠 AI Processing query:', context.query);
      
      // Step 0: Fetch user preferences for personalized responses
      const enrichedContext = await this.enrichContextWithPreferences(context, userId);
      
      // Step 1: Analyze query and select tool
      const toolSelection = await this.selectTool(enrichedContext, userId);
      
      console.log(toolSelection)
      if (!toolSelection) {
        return {
          success: false,
          naturalResponse: "I'm not sure how to help with that request. I can assist with calendar events, emails, and productivity tasks.",
          error: 'No suitable tool found'
        };
      }

      if(toolSelection && toolSelection.tool === null && toolSelection.geminiOutput){
        return {
          success: true,
          naturalResponse: toolSelection.geminiOutput,
          reasoning: toolSelection.reasoning,
          rawData: null,
          suggestedActions: []
        };
      }
      console.log('🎯 Selected tool:', toolSelection.tool, 'with confidence:', toolSelection.confidence);
      
      // Step 2: Execute the selected tool (handle null tools for conversational responses)
      let toolResult;
      if (toolSelection.tool === null) {
        // Handle conversational responses without tools
        toolResult = {
          success: true,
          data: null,
          toolUsed: null
        };
      } else {
        toolResult = await this.executeTool(toolSelection, userId);
      }
      
      // Step 2.5: Check if we need tool chaining
      let chainedResult = null;
      if (toolResult.success && this.shouldChainTool(toolSelection, toolResult, enrichedContext)) {
        chainedResult = await this.performToolChaining(toolSelection, toolResult, userId, enrichedContext);
      }
      
      // Step 3: Generate natural language response
      const finalResult = chainedResult || toolResult;
      const naturalResponse = await this.generateResponse(enrichedContext, toolSelection, finalResult, userId);
      
      return {
        success: true,
        toolUsed: toolSelection.tool,
        rawData: finalResult.data,
        naturalResponse,
        reasoning: toolSelection.reasoning,
        suggestedActions: await this.generateSuggestedActions(context, finalResult),
        chainedTools: chainedResult ? ['searchWeb', 'crawlPage'] : undefined
      };

    } catch (error) {
      console.error('❌ AI processing error:', error);
      return {
        success: false,
        naturalResponse: 'Sorry, I encountered an error while processing your request. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Analyze user query and select the best tool with conversation context
   */
  public async selectTool(context: UserContext, userId?: string): Promise<AIToolSelection | null> {
    const availableTools = this.toolRegistry.getAllToolMetadata();
    
//     const prompt = `
// You are an intelligent assistant that helps users with calendar, email, and productivity tasks.

// Available Tools:
// ${this.formatToolsForPrompt(availableTools)}

// User Query: "${context.query}"
// Timestamp: ${context.timestamp}

// Analyze the user's query and determine:
// 1. Which tool (if any) best matches their request
// 2. What parameters should be passed to that tool
// 3. Your confidence level (0-100)
// 4. Your reasoning

// Respond in JSON format:
// {
//   "tool": "toolName or null",
//   "confidence": 85,
//   "parameters": {},
//   "reasoning": "explanation of your choice",
//   "geminiOutput": "optional output if no tool is needed"
// }

// Guidelines:
// - Calendar queries: use getTodaysEvents for "today", "this morning", "afternoon", "meetings"
// - Email queries: use getEmails for "emails", "messages", "inbox", "mail" - supports advanced search
// - If the query is unclear or doesn't match any tool, return tool: null
// - If the output can be generated by gemini and  dosent require a tool, return tool:null and add geminiOutput:{the output which can be showed to the user}
// - Be precise with parameters - only include what the user specified
// `;

    // Get conversation context if sessionId is provided
    let conversationContext = '';
    if (context.sessionId && userId) {
      try {
        const contextData = await SessionService.getConversationContext(context.sessionId, userId, 5);
        if (contextData.messages.length > 0) {
          conversationContext = '\n\nConversation History (last 5 messages):\n' + 
            contextData.messages.map((msg, index) => `${msg.role}: ${msg.content}`).join('\n');
          
          // Add tool usage context if available
          if (contextData.tool_calls.length > 0) {
            conversationContext += '\n\nRecent Tool Usage:\n' +
              contextData.tool_calls.map((call: any) => `- Used ${call.tool_name} ${call.created_at ? new Date(call.created_at).toLocaleTimeString() : ''}`).join('\n');
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch conversation context:', error);
      }
    }

const prompt=`You are an intelligent assistant with advanced capabilities including file management, document processing, Google Drive integration, and productivity tools.

Available Tools:
${this.formatToolsForPrompt(availableTools)}

User Query: "${context.query}"
Timestamp: ${context.timestamp}${conversationContext}

Your task:
1. Decide if the query should be handled by a tool or directly answered by Gemini.
2. If a tool is best, pick the correct one and extract the required parameters.
3. For real-time data (weather, news, stock prices, movie times, etc.) ALWAYS use searchWeb first.
4. If the user mentions or asks about a specific website/URL, use crawlPage to get current content.
5. For file operations, document processing, or Google Drive actions, use the appropriate tools.
6. If no tool matches but Gemini can generate a useful answer, provide that as "geminiOutput".
7. Always classify the response into a category.
8. Indicate if Gemini's output can safely be shown to the user with a boolean flag.

Respond in **valid JSON**:
{
  "tool": "toolName or null",
  "confidence": 0-100,
  "parameters": { "only include parameters explicitly mentioned by user" },
  "reasoning": "why this choice was made",
  "geminiOutput": "text or null",
  "category": "general | calendar | email | files | documents | drive | search | analysis | creation",
  "canUseGemini": true/false
}

Guidelines:
- **Context Awareness**: Use conversation history to understand follow-up questions, pronouns ("it", "that", "those"), and references ("the email", "my files", "that document").
- **Follow-up Handling**: 
  * "Create a doc from it" after retrieving emails → use createDocument with email data
  * "Summarize it" after finding files → use processDocument or generate summary
  * "Save it to drive" after generating content → use createGoogleDriveFile
  * "Tell me more about that" after search results → use crawlPage on relevant URLs
  * "What about tomorrow?" after today's calendar → use getTodaysEvents with tomorrow's date
- **Tool Selection**:
  * File System Tools: readFile, writeFile, listDirectory for local operations
  * Google Drive Tools: searchGoogleDrive, getGoogleDriveFile, createGoogleDriveFile for Drive operations
  * Document Tools: processDocument for analysis, createDocument/generateContentWithAI for creation
  * Calendar/Email: getTodaysEvents, getEmails with advanced Gmail search syntax
  * Web Tools: searchWeb for real-time data, crawlPage for specific URLs
- **Chaining Recognition**: Recognize when user wants multiple operations (e.g., "get my emails and create a summary document")
- **Reference Resolution**: When user says "that file", "the document", "my emails", look at recent context to identify what they're referring to
- **Time References**: "today", "tomorrow", "this week", "yesterday" - calculate appropriate dates based on timestamp
- **Pronoun Mapping**: "it" usually refers to the most recently mentioned item in conversation history
- If context is insufficient or unclear, ask for clarification through geminiOutput rather than guessing
`

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // Sanitize for safety
      if (text.startsWith("```")) {
        text = text.replace(/```(json)?/g, "").trim();
      }
    
      
      console.log('🤖 AI tool selection response:', text);
      
      const selection = JSON.parse(text);
      console.log(selection)
      
      // // Validate selection
      // if (selection.tool && !availableTools.find(t => t.name === selection.tool)) {
      //   console.warn('⚠️ AI selected invalid tool:', selection.tool);
      //   return null;
      // }
      
      // return selection.tool ? selection : null;
      return selection
      
    } catch (error) {
      console.error('❌ Error in tool selection:', error);
      return null;
    }
  }

  /**
   * Execute the selected MCP tool with caching
   */
  public async executeTool(selection: AIToolSelection, userId: string): Promise<any> {
    const tool = this.toolRegistry.getTool(selection.tool);
    if (!tool) {
      throw new Error(`Tool ${selection.tool} not found`);
    }

    // Create cache key
    const cacheKey = `${selection.tool}_${userId}_${JSON.stringify(selection.parameters)}`;
    
    // Check cache for non-real-time tools
    const cachedData = this.responseCache.get(cacheKey);
    if (cachedData && Date.now() - cachedData.timestamp < this.cacheTimeout) {
      console.log('📋 Using cached result for tool:', selection.tool);
      return cachedData.result;
    }

    console.log('🔧 Executing tool:', selection.tool, 'with params:', selection.parameters);
    
    const result = await tool.execute(userId, selection.parameters);
    
    // Cache the result
    this.responseCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    // Clean old cache entries periodically
    if (this.responseCache.size > 100) {
      this.cleanCache();
    }
    
    return result;
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Build personalization prompt based on user preferences
   */
  private buildPersonalizationPrompt(context: UserContext): string {
    if (!context.personalization?.userPreferences) {
      return '';
    }

    const prefs = context.personalization.userPreferences;
    const contextData = context.personalization.currentContext;
    
    let prompt = '\n**PERSONALIZATION CONTEXT**:\n';
    
    // User Info
    if (prefs.personalInfo?.name) {
      prompt += `- User's name: ${prefs.personalInfo.name}\n`;
    }
    if (prefs.personalInfo?.profession) {
      prompt += `- Profession: ${prefs.personalInfo.profession}\n`;
    }
    
    // Communication Style
    if (prefs.communicationStyle) {
      prompt += `- Preferred tone: ${prefs.communicationStyle.tone || 'balanced'}\n`;
      prompt += `- Detail level: ${prefs.communicationStyle.detail_level || 'moderate'}\n`;
      prompt += `- Explanation style: ${prefs.communicationStyle.explanation_style || 'examples-heavy'}\n`;
      if (prefs.communicationStyle.use_analogies) {
        prompt += `- User likes analogies and metaphors\n`;
      }
      if (prefs.communicationStyle.include_examples) {
        prompt += `- Include practical examples\n`;
      }
    }
    
    // Interests
    if (prefs.contentPreferences?.primary_interests?.length > 0) {
      prompt += `- Primary interests: ${prefs.contentPreferences.primary_interests.join(', ')}\n`;
    }
    if (prefs.contentPreferences?.learning_style) {
      prompt += `- Learning style: ${prefs.contentPreferences.learning_style}\n`;
    }
    if (prefs.contentPreferences?.preferred_formats?.length > 0) {
      prompt += `- Preferred formats: ${prefs.contentPreferences.preferred_formats.join(', ')}\n`;
    }
    
    // Assistant Behavior
    if (prefs.assistantBehavior) {
      prompt += `- Proactivity level: ${prefs.assistantBehavior.proactivity_level || 'suggestive'}\n`;
      prompt += `- Personality: ${prefs.assistantBehavior.personality || 'helpful'}\n`;
      if (prefs.assistantBehavior.follow_up_questions) {
        prompt += `- User appreciates follow-up questions\n`;
      }
      if (prefs.assistantBehavior.suggest_related_topics) {
        prompt += `- User likes topic suggestions\n`;
      }
    }
    
    // Work Context (if relevant)
    if (prefs.workPreferences?.work_schedule) {
      prompt += `- Most productive time: ${prefs.workPreferences.work_schedule}\n`;
    }
    if (prefs.workPreferences?.productivity_style) {
      prompt += `- Work style: ${prefs.workPreferences.productivity_style}\n`;
    }
    
    // Domain-Specific 
    if (prefs.domainPreferences?.tech_stack?.length > 0) {
      prompt += `- Tech stack: ${prefs.domainPreferences.tech_stack.join(', ')}\n`;
    }
    if (prefs.domainPreferences?.business_focus?.length > 0) {
      prompt += `- Business areas: ${prefs.domainPreferences.business_focus.join(', ')}\n`;
    }
    
    // Current Context
    if (contextData) {
      prompt += `- Time context: ${contextData.timeOfDay}, ${contextData.dayOfWeek}\n`;
    }
    
    prompt += '\n**IMPORTANT**: Adapt your response to match these preferences while maintaining helpfulness and accuracy.\n';
    
    return prompt;
  }

  /**
   * Get tone instruction based on user preferences
   */
  private getToneInstruction(context: UserContext): string {
    const tone = context.personalization?.userPreferences?.communicationStyle?.tone || 'friendly';
    
    switch (tone) {
      case 'professional':
        return 'Write in a professional, business-appropriate tone';
      case 'casual':
        return 'Use a relaxed, informal, conversational tone';
      case 'friendly':
        return 'Be warm, supportive, and approachable';
      case 'formal':
        return 'Use structured, precise, and academic language';
      case 'enthusiastic':
        return 'Be energetic, encouraging, and positive';
      case 'balanced':
        return 'Adapt your tone to match the context and topic';
      default:
        return 'Write in a friendly, conversational tone';
    }
  }

  /**
   * Generate natural language response from tool result with conversation context
   */
  public async generateResponse(context: UserContext, selection: AIToolSelection, toolResult: any, userId?: string): Promise<string> {
    if (!toolResult.success) {
      return `I couldn't retrieve the information you requested. ${toolResult.error || 'Please try again later.'}`;
    }

    // Get conversation context if sessionId is provided
    let conversationContext = '';
    if (context.sessionId && userId) {
      try {
        const contextData = await SessionService.getConversationContext(context.sessionId, userId, 3);
        if (contextData.messages.length > 0) {
          conversationContext = '\n\nConversation History (last 3 messages):\n' + 
            contextData.messages.map(msg => `${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`).join('\n');
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch conversation context for response generation:', error);
      }
    }

    // Build personalization context
    const personalizationPrompt = this.buildPersonalizationPrompt(context);

    const prompt = `
You are a helpful personal assistant. Convert this raw data into a natural, conversational response.

Original Query: "${context.query}"
Tool Used: ${selection.tool}
Raw Data: ${JSON.stringify(toolResult.data, null, 2)}${conversationContext}

${toolResult.data.auto_crawled ? 
`🔍 **SPECIAL INSTRUCTION**: This query involved automatically visiting and scraping ${toolResult.data.total_sites_crawled} websites to provide comprehensive information. Synthesize ALL the crawled content into a cohesive response.` : ''}

${personalizationPrompt}

Instructions:
- ${this.getToneInstruction(context)}
- Use conversation history to maintain context and continuity
- Focus on what the user asked for specifically
- **Handle chained operations**: If multiple tools were used, explain what was done in sequence
- **Multi-site web scraping**: If multiple websites were crawled automatically:
  * Synthesize information from ALL crawled sites into a comprehensive answer
  * Compare and contrast information from different sources when relevant
  * Mention that you "visited and analyzed multiple websites" to gather the information
  * Highlight any conflicting information between sources
  * Present the information in a well-organized, easy-to-understand format
- **Document creation**: If a document was created, mention where it was saved (locally/Drive) and provide any access links
- **Tool chaining**: When tools were chained, explain the workflow (e.g., "I searched the web and then visited multiple sites to gather detailed information")
- If it's calendar data, mention times and key details
- If it's email data, summarize key messages
- If it's file/drive data, mention file types, sizes, and locations
- For research/voice queries, be comprehensive since the user expects detailed information
- Keep it informative and well-structured
- ${context.preferences?.isVoiceMode || context.preferences?.isVoiceQuery ? 'Structure for voice consumption - use clear transitions and organize information logically for audio' : 'Use appropriate formatting (markdown, lists, etc.) for readability'}
- If the data is empty or minimal, acknowledge that naturally
- Reference previous messages when relevant (e.g., "As I mentioned earlier...")
- ${context.preferences?.isVoiceMode ? 'Speak naturally as if talking to someone in person' : 'Format appropriately for text display'}

Examples:
- For calendar: "You have 3 meetings today. Your next one is the team standup at 10 AM."
- For email: "You have 5 new emails. The most recent is from John about the project deadline."
- For chained operations: "I retrieved your emails and created a summary document in your Google Drive. The document contains 10 emails from today."
- For document creation: "I've created a document called 'Meeting Notes' and saved it both locally and to your Google Drive."

Generate a natural response:
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('❌ Error generating response:', error);
      return 'I found the information you requested, but had trouble formatting the response. Please check the raw data above.';
    }
  }

  /**
   * Generate suggested follow-up actions
   */
  public async generateSuggestedActions(context: UserContext, toolResult: any): Promise<string[]> {
    // Simple rule-based suggestions for now
    const suggestions: string[] = [];
    
    if (context.query.toLowerCase().includes('calendar') || context.query.toLowerCase().includes('meeting')) {
      suggestions.push('Would you like to see your schedule for tomorrow?');
      suggestions.push('Do you want to check for any conflicts?');
    }
    
    if (context.query.toLowerCase().includes('email')) {
      suggestions.push('Would you like me to check for any urgent emails?');
      suggestions.push('Do you want to see emails from specific people?');
    }
    
    return suggestions.slice(0, 2); // Limit to 2 suggestions
  }

  /**
   * Determine if we should chain to another tool based on the first tool's result
   */
  private shouldChainTool(selection: AIToolSelection, toolResult: any, context: UserContext): boolean {
    if (!toolResult.success || !toolResult.data) return false;
    
    const query = context.query.toLowerCase();
    
    // 1. Enhanced web search auto-chaining - automatically crawl multiple sites for comprehensive data
    if (selection.tool === 'searchWeb' && toolResult.data.results) {
      const results = toolResult.data.results;
      
      // Auto-crawl for these scenarios (make it more aggressive)
      const shouldAutoCrawl = 
        // Research and information gathering queries
        query.includes('research') ||
        query.includes('information about') ||
        query.includes('tell me about') ||
        query.includes('what is') ||
        query.includes('explain') ||
        query.includes('summarize') ||
        query.includes('analyze') ||
        query.includes('content of') ||
        query.includes('details') ||
        query.includes('learn about') ||
        query.includes('find out about') ||
        // Current events and news
        query.includes('news') ||
        query.includes('latest') ||
        query.includes('recent') ||
        query.includes('update') ||
        // Comparison and analysis
        query.includes('compare') ||
        query.includes('versus') ||
        query.includes('vs') ||
        // Any query that seems to want comprehensive information
        query.includes('comprehensive') ||
        query.includes('detailed') ||
        query.includes('complete') ||
        // Voice mode queries tend to be more conversational
        Boolean(context.preferences?.isVoiceQuery);
      
      // Auto-crawl if we have results and it's an information-seeking query
      return shouldAutoCrawl && results.length > 0;
    }
    
    // 2. If we retrieved emails/calendar/drive data and user wants to create a document
    const dataRetrievalTools = ['getEmails', 'getLastTenMails', 'getTodaysEvents', 'searchGoogleDrive', 'getGoogleDriveFile'];
    if (dataRetrievalTools.includes(selection.tool || '') && toolResult.data) {
      const wantsDocument = query.includes('create') && (query.includes('doc') || query.includes('document') || query.includes('summary') || query.includes('report'));
      return wantsDocument;
    }
    
    // 3. If we generated content and user wants to save it
    if (selection.tool === 'generateContentWithAI' && toolResult.data) {
      const wantsToSave = query.includes('save') || query.includes('create doc') || query.includes('write to');
      return wantsToSave;
    }
    
    // 4. If we processed a document and user wants to create a summary
    if (selection.tool === 'processDocument' && toolResult.data) {
      const wantsSummaryDoc = query.includes('summarize') && (query.includes('create') || query.includes('save'));
      return wantsSummaryDoc;
    }
    
    return false;
  }
  
  /**
   * Perform tool chaining - automatically use a second tool based on first tool's results
   */
  private async performToolChaining(
    firstSelection: AIToolSelection, 
    firstResult: any, 
    userId: string, 
    context: UserContext
  ): Promise<any> {
    try {
      console.log('🔗 Performing tool chaining after:', firstSelection.tool);
      
      const query = context.query.toLowerCase();
      
      // 1. Enhanced SearchWeb -> Multi-CrawlPage chaining
      if (firstSelection.tool === 'searchWeb' && firstResult.data.results) {
        console.log('🔗 Chaining to crawlPage for multiple URLs');
        
        const crawlTool = this.toolRegistry.getTool('crawlPage');
        if (crawlTool) {
          const results = firstResult.data.results;
          const crawledContent: any[] = [];
          
          // Determine how many sites to crawl based on query complexity
          const isComprehensiveQuery = query.includes('comprehensive') || 
                                      query.includes('detailed') || 
                                      query.includes('research') ||
                                      query.includes('compare') ||
                                      Boolean(context.preferences?.isVoiceQuery);
          
          const maxSitesToCrawl = isComprehensiveQuery ? 
            Math.min(results.length, 5) :  // Crawl up to 5 sites for comprehensive queries
            Math.min(results.length, 3);   // Crawl up to 3 sites for regular queries
          
          console.log(`🕷️ Auto-crawling ${maxSitesToCrawl} sites for comprehensive data`);
          
          // Crawl multiple sites concurrently for speed
          const crawlPromises = results.slice(0, maxSitesToCrawl).map(async (result: any, index: number) => {
            if (!result.url) return null;
            
            try {
              console.log(`🔗 Crawling site ${index + 1}: ${result.title}`);
              const crawlResult = await crawlTool.execute(userId, {
                url: result.url,
                extract_content: true,
                max_length: 2000 // Slightly smaller per site to fit more content
              });

              if (crawlResult.success) {
                return {
                  search_result: result,
                  content: crawlResult.data,
                  crawl_index: index + 1
                };
              }
              return null;
            } catch (error) {
              console.warn(`⚠️ Failed to crawl ${result.url}:`, error);
              return null;
            }
          });

          // Wait for all crawls to complete (with timeout)
          const crawlResults = await Promise.allSettled(crawlPromises);
          
          crawlResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              crawledContent.push(result.value);
            }
          });

          console.log(`✅ Successfully crawled ${crawledContent.length} out of ${maxSitesToCrawl} sites`);

          if (crawledContent.length > 0) {
            return {
              success: true,
              data: {
                search_results: firstResult.data,
                crawled_sites: crawledContent,
                total_sites_crawled: crawledContent.length,
                chained_tools: ['searchWeb', 'crawlPage'],
                auto_crawled: true,
                comprehensive_data: true
              }
            };
          }
        }
      }
      
      // 2. Data Retrieval -> Document Creation chaining
      const dataRetrievalTools = ['getEmails', 'getLastTenMails', 'getTodaysEvents', 'searchGoogleDrive', 'getGoogleDriveFile'];
      if (dataRetrievalTools.includes(firstSelection.tool || '') && firstResult.data) {
        console.log('🔗 Chaining to createDocument after data retrieval');
        
        // Generate content based on the retrieved data
        let content = '';
        let title = '';
        
        if (firstSelection.tool?.includes('Email')) {
          const emails = firstResult.data.emails || [];
          title = `Email Summary - ${new Date().toLocaleDateString()}`;
          content = `# Email Summary - ${new Date().toLocaleDateString()}\n\n`;
          content += `**Total Emails:** ${emails.length}\n\n`;
          
          emails.forEach((email: any, index: number) => {
            content += `## ${index + 1}. ${email.subject || 'No Subject'}\n`;
            content += `**From:** ${email.sender || 'Unknown'}\n`;
            content += `**Date:** ${email.date || 'Unknown'}\n`;
            content += `**Summary:** ${email.snippet || email.content?.substring(0, 200) || 'No content'}...\n\n`;
          });
        } else if (firstSelection.tool === 'getTodaysEvents') {
          const events = firstResult.data.events || [];
          title = `Calendar Summary - ${new Date().toLocaleDateString()}`;
          content = `# Calendar Summary - ${new Date().toLocaleDateString()}\n\n`;
          content += `**Total Events:** ${events.length}\n\n`;
          
          events.forEach((event: any, index: number) => {
            content += `## ${index + 1}. ${event.summary || 'No Title'}\n`;
            content += `**Time:** ${event.start?.dateTime || event.start?.date || 'Unknown'}\n`;
            if (event.description) content += `**Description:** ${event.description}\n`;
            content += `\n`;
          });
        } else if (firstSelection.tool?.includes('Drive')) {
          const files = firstResult.data.files || [firstResult.data];
          title = `Drive Files Summary - ${new Date().toLocaleDateString()}`;
          content = `# Google Drive Files Summary\n\n`;
          
          files.forEach((file: any, index: number) => {
            content += `## ${index + 1}. ${file.name || file.title || 'Untitled'}\n`;
            content += `**Type:** ${file.mimeType || file.type || 'Unknown'}\n`;
            if (file.size) content += `**Size:** ${Math.round(file.size / 1024)} KB\n`;
            if (file.content) content += `**Content Preview:** ${file.content.substring(0, 300)}...\n`;
            content += `\n`;
          });
        }
        
        // Create the document
        const createDocTool = this.toolRegistry.getTool('createDocument');
        if (createDocTool && content) {
          const docResult = await createDocTool.execute(userId, {
            title,
            content,
            type: 'markdown',
            destination: 'google_drive' // Save to Drive by default
          });
          
          if (docResult.success) {
            return {
              success: true,
              data: {
                original_data: firstResult.data,
                created_document: docResult.data,
                chained_tools: [firstSelection.tool, 'createDocument']
              }
            };
          }
        }
      }
      
      // 3. Generated Content -> Save Document chaining  
      if (firstSelection.tool === 'generateContentWithAI' && firstResult.data) {
        console.log('🔗 Chaining to createDocument after content generation');
        
        const createDocTool = this.toolRegistry.getTool('createDocument');
        if (createDocTool) {
          const title = `Generated Content - ${new Date().toLocaleDateString()}`;
          const content = firstResult.data.content || firstResult.data.text || '';
          
          const docResult = await createDocTool.execute(userId, {
            title,
            content,
            type: 'markdown',
            destination: 'both' // Save both locally and to Drive
          });
          
          if (docResult.success) {
            return {
              success: true,
              data: {
                generated_content: firstResult.data,
                saved_document: docResult.data,
                chained_tools: ['generateContentWithAI', 'createDocument']
              }
            };
          }
        }
      }
      
      // 4. Document Processing -> Summary Document chaining
      if (firstSelection.tool === 'processDocument' && firstResult.data) {
        console.log('🔗 Chaining to createDocument after document processing');
        
        const createDocTool = this.toolRegistry.getTool('createDocument');
        if (createDocTool && firstResult.data.summary) {
          const title = `Document Summary - ${new Date().toLocaleDateString()}`;
          const content = `# Document Summary\n\n**Original:** ${firstResult.data.fileName || 'Unknown'}\n\n**Summary:**\n${firstResult.data.summary}\n\n**Key Points:**\n${firstResult.data.keyPoints?.map((point: string) => `- ${point}`).join('\n') || 'None extracted'}`;
          
          const docResult = await createDocTool.execute(userId, {
            title,
            content,
            type: 'markdown',
            destination: 'both'
          });
          
          if (docResult.success) {
            return {
              success: true,
              data: {
                processed_document: firstResult.data,
                summary_document: docResult.data,
                chained_tools: ['processDocument', 'createDocument']
              }
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error in tool chaining:', error);
      return null;
    }
  }

  /**
   * Format available tools for the AI prompt
   */
  private formatToolsForPrompt(tools: AIToolMetadata[]): string {
    return tools.map(tool => `
Tool: ${tool.name}
Description: ${tool.description}
Category: ${tool.category}
Parameters: ${tool.parameters.map(p => `${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`).join(', ')}
Examples: ${tool.examples.map(e => `"${e.query}"`).join(', ')}
`).join('\n');
  }
}