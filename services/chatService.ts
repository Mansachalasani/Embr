import { ChatMessage, AVAILABLE_COMMANDS } from '../types/chat';
import { MCPService } from './mcpService';
import { MCPTestService } from './mcpTest';
import { TokenDebugger } from './debugTokens';
import { AIService } from './aiService';

export class ChatService {
  static generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2);
  }

  static createMessage(
    type: ChatMessage['type'], 
    content: string, 
    metadata?: ChatMessage['metadata']
  ): ChatMessage {
    return {
      id: this.generateId(),
      type,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  static async processMessage(userMessage: string): Promise<ChatMessage[]> {
    const responses: ChatMessage[] = [];
    
    // Check if it's a command
   
    if (userMessage.startsWith('/')) {
      const command = userMessage.trim().toLowerCase();
      
      switch (command) {
        case '/help':
          responses.push(this.createMessage('assistant', this.getHelpMessage()));
          break;
          
        case '/calendar':
          responses.push(this.createMessage('system', 'Fetching your calendar events...', { loading: true }));
          const calendarResult = await MCPService.getTodaysEvents();
          responses.push(this.processCalendarResponse(calendarResult));
          break;
          
        case '/emails':
          responses.push(this.createMessage('system', 'Fetching your latest emails...', { loading: true }));
          const emailResult = await MCPService.getLastTenMails();
          responses.push(this.processEmailResponse(emailResult));
          break;
          
        case '/status':
          responses.push(this.createMessage('system', 'Checking backend status...', { loading: true }));
          const statusResult = await MCPService.getAuthStatus();
          responses.push(this.processStatusResponse(statusResult));
          break;
          
        case '/test':
          responses.push(this.createMessage('system', 'Testing MCP backend connection...', { loading: true }));
          const testResult = await MCPTestService.testConnection();
          responses.push(this.createMessage(
            'assistant',
            `🔍 **Connection Test**\n\n${testResult.success ? '✅' : '❌'} ${testResult.message}`,
            { 
              error: !testResult.success,
              toolName: 'connectionTest',
              toolData: testResult.details
            }
          ));
          break;
          
        case '/debug':
          responses.push(this.createMessage('system', 'Running token debug...', { loading: true }));
          const debugResult = await TokenDebugger.testBackendAuth();
          responses.push(this.createMessage(
            'assistant',
            `🔧 **Token Debug**\n\n${debugResult.success ? '✅' : '❌'} ${debugResult.message}\n\nCheck console for detailed logs.`,
            { 
              error: !debugResult.success,
              toolName: 'tokenDebug',
              toolData: debugResult.details
            }
          ));
          break;
          
        case '/connect':
          responses.push(this.createMessage('system', 'Checking Google Workspace connection...', { loading: true }));
          const connectStatusResult = await MCPService.getAuthStatus();
          console.log(connectStatusResult,'meoww')
          
          if (connectStatusResult.success && connectStatusResult.data.googleWorkspace.connected) {
            responses.push(this.createMessage(
              'assistant',
              `🔗 **Google Workspace Connection**\n\n✅ Already connected and ready!\n\nYou can use \`/calendar\` and \`/emails\` commands.`,
              { toolName: 'googleConnect' }
            ));
          } else {
            responses.push(this.createMessage(
              'assistant',
              `🔗 **Google Workspace Connection**\n\n❌ Not connected\n\nTo connect:\n1. Sign out of the app\n2. Sign in again with Google\n3. Try \`/connect\` again\n\nThe Google tokens should be automatically saved during sign-in.`,
              { error: true, toolName: 'googleConnect' }
            ));
          }
          break;
          
        default:
          responses.push(this.createMessage(
            'assistant', 
            `Unknown command: ${command}. Type /help to see available commands.`,
            { error: true }
          ));
      }
    } else {
      // Handle regular chat messages with AI
      console.log('🤖 Processing natural language query:', userMessage);
      responses.push(this.createMessage('system', 'Processing your request...', { loading: true }));
      
      try {
        // Check if AI is available
        console.log('🔍 Checking AI availability...');
        const aiAvailable = await AIService.checkAIAvailability();
        console.log('🔍 AI Available:', aiAvailable);
        
        if (aiAvailable) {
          // Use AI to process natural language query
          console.log('🧠 Sending query to AI service...');
          const aiResponse = await AIService.processQuery({
            query: userMessage,
            preferences: {
              responseStyle: 'conversational',
              includeActions: true
            }
          });
          
          console.log('🧠 AI Response:', aiResponse);
          
          if (aiResponse.success && aiResponse.data) {
            responses.push(this.createMessage(
              'assistant',
              aiResponse.data.response,
              {
                toolName: aiResponse.data.toolUsed,
                toolData: aiResponse.data.rawData
              }
            ));
            
            // Add suggested actions if available
            if (aiResponse.data.suggestedActions && aiResponse.data.suggestedActions.length > 0) {
              responses.push(this.createMessage(
                'system',
                `💡 **Suggestions:**\n${aiResponse.data.suggestedActions.map(action => `• ${action}`).join('\n')}`,
                { toolName: 'suggestions' }
              ));
            }
          } else {
            // AI failed, fall back to simple response
            console.log('❌ AI query failed:', aiResponse.error);
            responses.push(this.createMessage(
              'assistant',
              `I received your message: "${userMessage}". I can help you with your calendar and emails using commands like /calendar or /emails. Type /help for more options.`
            ));
          }
        } else {
          // AI not available, use fallback
          responses.push(this.createMessage(
            'assistant',
            `I received your message: "${userMessage}". I can help you with your calendar and emails using commands like /calendar or /emails. Type /help for more options.`
          ));
        }
      } catch (error) {
        console.error('❌ AI processing error:', error);
        console.error('❌ Error details:', error.message);
        // Fall back to simple response on error
        responses.push(this.createMessage(
          'assistant',
          `I received your message: "${userMessage}". I can help you with your calendar and emails using commands like /calendar or /emails. Type /help for more options.`
        ));
      }
    }
    
    return responses;
  }

  private static getHelpMessage(): string {
    let helpText = "🤖 **Available Commands:**\n\n";
    
    AVAILABLE_COMMANDS.forEach(cmd => {
      helpText += `**${cmd.command}** - ${cmd.description}\n`;
      helpText += `Example: \`${cmd.example}\`\n\n`;
    });
    
    helpText += "🤖 **Natural Language Queries:**\n";
    helpText += "You can also ask me questions naturally! Try:\n";
    helpText += "• \"What meetings do I have today?\"\n";
    helpText += "• \"Do I have any meetings after lunch?\"\n";
    helpText += "• \"Check my latest emails\"\n";
    helpText += "• \"Any urgent messages?\"\n\n";
    
    helpText += "💡 **Tips:**\n";
    helpText += "• Commands start with `/`\n";
    helpText += "• Natural language works without `/`\n";
    helpText += "• Make sure your Google Workspace is connected\n";
    helpText += "• Check /status if commands aren't working\n";
    
    return helpText;
  }

  private static processCalendarResponse(result: any): ChatMessage {
    if (!result.success) {
      return this.createMessage(
        'assistant',
        `❌ **Calendar Error:** ${result.error}\n\nMake sure your Google Calendar is connected and try again.`,
        { error: true, toolName: 'getTodaysEvents' }
      );
    }

    const { events, summary, date } = result.data;
    
    if (events.length === 0) {
      return this.createMessage(
        'assistant',
        `📅 **No events today** (${date})\n\nYour calendar is clear for today!`,
        { toolName: 'getTodaysEvents', toolData: result.data }
      );
    }

    let response = `📅 **Today's Calendar** (${date})\n\n`;
    response += `**Summary:** ${summary.total} events, ${summary.upcoming} upcoming\n\n`;
    
    events.slice(0, 5).forEach((event: any) => {
      const startTime = event.start.dateTime 
        ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'All day';
      
      response += `🕐 **${startTime}** - ${event.summary}\n`;
      if (event.location) response += `📍 ${event.location}\n`;
      if (event.description) response += `📝 ${event.description.substring(0, 100)}...\n`;
      response += '\n';
    });

    if (events.length > 5) {
      response += `... and ${events.length - 5} more events`;
    }

    return this.createMessage(
      'assistant',
      response,
      { toolName: 'getTodaysEvents', toolData: result.data }
    );
  }

  private static processEmailResponse(result: any): ChatMessage {
    if (!result.success) {
      return this.createMessage(
        'assistant',
        `❌ **Email Error:** ${result.error}\n\nMake sure your Gmail is connected and try again.`,
        { error: true, toolName: 'getLastTenMails' }
      );
    }

    const { messages, summary } = result.data;
    
    if (messages.length === 0) {
      return this.createMessage(
        'assistant',
        `📧 **No recent emails found**\n\nYour inbox appears to be empty.`,
        { toolName: 'getLastTenMails', toolData: result.data }
      );
    }

    let response = `📧 **Latest Emails**\n\n`;
    response += `**Summary:** ${summary.total} messages, ${summary.unread} unread\n\n`;
    
    messages.slice(0, 5).forEach((email: any) => {
      const date = new Date(email.date).toLocaleDateString();
      const unreadIcon = email.unread ? '🔵 ' : '';
      
      response += `${unreadIcon}**${email.subject}**\n`;
      response += `👤 ${email.from}\n`;
      response += `📅 ${date}\n`;
      response += `💬 ${email.snippet}\n\n`;
    });

    if (messages.length > 5) {
      response += `... and ${messages.length - 5} more messages`;
    }

    return this.createMessage(
      'assistant',
      response,
      { toolName: 'getLastTenMails', toolData: result.data }
    );
  }

  private static processStatusResponse(result: any): ChatMessage {
    if (!result.success) {
      return this.createMessage(
        'assistant',
        `❌ **Status Check Failed:** ${result.error}`,
        { error: true, toolName: 'status' }
      );
    }

    const { user, googleWorkspace } = result.data;
    
    let response = `🔍 **Backend Status**\n\n`;
    response += `✅ **Connected** to MCP Backend\n`;
    response += `👤 **User:** ${user.email}\n`;
    response += `🔗 **Google Workspace:** ${googleWorkspace.connected ? '✅ Connected' : '❌ Not Connected'}\n`;
    
    if (googleWorkspace.connected) {
      response += `📋 **Scopes:** ${googleWorkspace.scopes.join(', ')}\n`;
    } else {
      response += `\n⚠️ Connect your Google Workspace to use calendar and email commands.`;
    }

    return this.createMessage(
      'assistant',
      response,
      { toolName: 'status', toolData: result.data }
    );
  }
}