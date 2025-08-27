import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ChatMessage } from '../../types/chat';
import { ChatService } from '../../services/chatService';
import { SessionService } from '../../services/sessionService';
import { Session, Message } from '../../types/session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionList } from '../../components/SessionList';
import { ThinkingAnimation } from '../../components/ThinkingAnimation';
import { StreamingMessage } from '../../components/StreamingMessage';
import { StreamingCallbacks } from '../../services/streamingService';

const CURRENT_SESSION_KEY = 'current_session_id';
const { width: screenWidth } = Dimensions.get('window');

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [showSessions, setShowSessions] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState('');
  const [streamingMessage, setStreamingMessage] = useState<{
    id: string;
    content: string;
    isStreaming: boolean;
    toolName?: string;
    toolStatus?: string;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const messageCache = useRef<Map<string, ChatMessage[]>>(new Map());

  // Initialize session on component mount
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      // Check for existing session
      const savedSessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
      
      if (savedSessionId) {
        try {
          const session = await SessionService.getSession(savedSessionId);
          setCurrentSession(session);
          await loadSessionMessages(savedSessionId);
        } catch (error) {
          console.log('Previous session not found, creating new one');
          await createNewSession();
        }
      } else {
        await createNewSession();
      }
    } catch (error) {
      console.error('❌ Error initializing session:', error);
      // Fallback to local mode without sessions
      setMessages([{
        id: '1',
        type: 'assistant',
        content: '👋 **Welcome to MCP Chat!**\n\nI can help you access your Google Workspace data.\n\n**First time here?**\n1. Use `/connect` to link your Google account\n2. Then try `/calendar` or `/emails`\n3. Type `/help` to see all commands\n\n**Quick start:** Type `/connect` to begin!',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsSessionLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      const session = await SessionService.createSession({
        title: `Chat - ${new Date().toLocaleDateString()}`,
        description: 'MCP Assistant conversation'
      });
      
      setCurrentSession(session);
      await AsyncStorage.setItem(CURRENT_SESSION_KEY, session.id);
      
      // Add welcome message to session
      const welcomeContent = '👋 **Welcome to MCP Chat!**\n\nI can help you access your Google Workspace data.\n\n**First time here?**\n1. Use `/connect` to link your Google account\n2. Then try `/calendar` or `/emails`\n3. Type `/help` to see all commands\n\n**Quick start:** Type `/connect` to begin!';
      
      await SessionService.addMessage(session.id, 'assistant', welcomeContent, {
        isWelcome: true
      });
      
      setMessages([{
        id: '1',
        type: 'assistant',
        content: welcomeContent,
        timestamp: new Date().toISOString(),
      }]);
      
    } catch (error) {
      console.error('❌ Error creating session:', error);
      throw error;
    }
  };

  const loadSessionMessages = async (sessionId: string, useCache: boolean = true) => {
    try {
      // Check cache first
      if (useCache && messageCache.current.has(sessionId)) {
        const cachedMessages = messageCache.current.get(sessionId)!;
        setMessages(cachedMessages);
        return;
      }

      const sessionMessages = await SessionService.getSessionMessages(sessionId);
      
      const chatMessages: ChatMessage[] = sessionMessages.map((msg: Message) => ({
        id: msg.id,
        type: msg.role as ChatMessage['type'],
        content: msg.content,
        timestamp: msg.created_at,
        metadata: msg.metadata
      }));
      
      // Cache the messages
      messageCache.current.set(sessionId, chatMessages);
      setMessages(chatMessages);
    } catch (error) {
      console.error('❌ Error loading session messages:', error);
      throw error;
    }
  };

  const handleSend = async () => {
    if (inputText.trim() === '' || isLoading || !currentSession) return;

    const userMessage = ChatService.createMessage('user', inputText.trim());
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    const currentInput = inputText.trim();
    setInputText('');
    setIsLoading(true);
    
    // Save user message to session (async, don't wait)
    SessionService.addMessage(currentSession.id, 'user', currentInput).catch(console.error);
    
    // Initialize streaming message
    const streamingId = ChatService.generateId();
    setStreamingMessage({
      id: streamingId,
      content: '',
      isStreaming: true,
    });

    // Define streaming callbacks
    const streamingCallbacks: StreamingCallbacks = {
      onStart: (data) => {
        console.log('🚀 Stream started:', data);
        if (data.cached) {
          setThinkingMessage('Using cached response...');
        } else if (data.isCommand) {
          setThinkingMessage('Processing command...');
        } else if (data.fallback) {
          setThinkingMessage('Processing your request...');
        } else {
          setThinkingMessage('Analyzing your request...');
        }
      },
      
      onToolSelection: (data) => {
        console.log('🎯 Tool selection:', data);
        if (data.status === 'analyzing') {
          setStreamingMessage(prev => prev ? {
            ...prev,
            toolStatus: 'analyzing'
          } : null);
          setThinkingMessage('Understanding your request...');
        } else if (data.status === 'selected') {
          setStreamingMessage(prev => prev ? {
            ...prev,
            toolName: data.tool,
            toolStatus: 'selected'
          } : null);
          setThinkingMessage(`Selected: ${data.tool}`);
        }
      },
      
      onToolExecution: (data) => {
        console.log('🔧 Tool execution:', data);
        if (data.status === 'executing') {
          setStreamingMessage(prev => prev ? {
            ...prev,
            toolName: data.tool,
            toolStatus: 'executing'
          } : null);
          setThinkingMessage(data.message || `Executing ${data.tool}...`);
        } else if (data.status === 'completed') {
          setThinkingMessage('Generating response...');
        }
      },
      
      onResponseChunk: (data) => {
        console.log('📝 Response chunk received:', { status: data.status, chunkLength: data.chunk?.length, isComplete: data.isComplete });
        
        if (data.status === 'generating') {
          setThinkingMessage('Generating response...');
          return;
        }
        
        // Update streaming message with new chunk
        setStreamingMessage(prev => {
          const newState = prev ? {
            ...prev,
            content: data.chunk,
            isStreaming: !data.isComplete,
            toolStatus: undefined // Clear tool status when response starts
          } : null;
          console.log('📝 Updated streaming message:', newState);
          return newState;
        });
        
        // Auto-scroll as content is being typed
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
      },
      
      onComplete: (data) => {
        console.log('✅ Stream completed:', data);
        console.log('🔍 StreamingMessage state:', streamingMessage);
        console.log('🔍 UpdatedMessages length:', updatedMessages.length);
        
        // Use responses from data if available, fallback to streamingMessage content
        let finalMessages = [...updatedMessages];
        
        if (data.responses && data.responses.length > 0) {
          // Use the actual responses from the completion data
          console.log('✅ Using responses from data:', data.responses.length, 'responses');
          finalMessages = [...updatedMessages, ...data.responses];
        } else if (streamingMessage && streamingMessage.content) {
          console.log('✅ Using streamingMessage content:', streamingMessage.content.length, 'chars');
          // Fallback to streaming message content
          const finalMessage = ChatService.createMessage(
            'assistant',
            streamingMessage.content,
            {
              toolName: data.toolUsed,
              toolData: data.rawData,
              reasoning: data.reasoning
            }
          );
          finalMessages = [...updatedMessages, finalMessage];
        }
        
        // Update messages in UI
        console.log('🎯 Setting final messages:', finalMessages.length, 'total messages');
        setMessages(finalMessages);
        
        // Update cache
        messageCache.current.set(currentSession.id, finalMessages);
        
        // Save messages to session (async)
        const responsesToSave = data.responses || (streamingMessage?.content ? [
          ChatService.createMessage('assistant', streamingMessage.content, {
            toolName: data.toolUsed,
            toolData: data.rawData,
            reasoning: data.reasoning
          })
        ] : []);
        
        for (const response of responsesToSave) {
          SessionService.addMessage(
            currentSession.id,
            response.type as 'user' | 'assistant' | 'system',
            response.content,
            response.metadata
          ).catch(console.error);
        }
        
        // Add suggested actions if available
        if (data.suggestedActions && data.suggestedActions.length > 0) {
          const suggestionsMessage = ChatService.createMessage(
            'system',
            `💡 **Suggestions:**\n${data.suggestedActions.map((action: string) => `• ${action}`).join('\n')}`,
            { toolName: 'suggestions' }
          );
          
          const messagesWithSuggestions = [...finalMessages, suggestionsMessage];
          setMessages(messagesWithSuggestions);
          messageCache.current.set(currentSession.id, messagesWithSuggestions);
          
          SessionService.addMessage(
            currentSession.id,
            'system',
            suggestionsMessage.content,
            suggestionsMessage.metadata
          ).catch(console.error);
        }
        
        // Clear streaming state
        setStreamingMessage(null);
        setIsLoading(false);
        setThinkingMessage('');
      },
      
      onError: (error) => {
        console.error('❌ Streaming error:', error);
        
        const errorMessage = ChatService.createMessage(
          'assistant',
          `❌ **Error:** ${error}`,
          { error: true }
        );
        
        const finalMessages = [...updatedMessages, errorMessage];
        setMessages(finalMessages);
        
        // Update cache
        messageCache.current.set(currentSession.id, finalMessages);
        
        // Save error message
        SessionService.addMessage(
          currentSession.id,
          'assistant',
          errorMessage.content,
          errorMessage.metadata
        ).catch(console.error);
        
        // Clear streaming state
        setStreamingMessage(null);
        setIsLoading(false);
        setThinkingMessage('');
      }
    };

    try {
      // Start streaming
      await ChatService.processMessageWithStreaming(currentInput, streamingCallbacks);
    } catch (error) {
      console.error('❌ Streaming failed, falling back to regular processing:', error);
      
      // Fallback to regular processing
      setStreamingMessage(null);
      setThinkingMessage('Processing request...');
      
      try {
        const responses = await ChatService.processMessage(currentInput);
        const finalMessages = [...updatedMessages, ...responses];
        setMessages(finalMessages);
        
        // Update cache
        messageCache.current.set(currentSession.id, finalMessages);
        
        // Save responses to session
        for (const response of responses) {
          SessionService.addMessage(
            currentSession.id,
            response.type as Message['role'],
            response.content,
            response.metadata
          ).catch(console.error);
        }
        
      } catch (fallbackError) {
        const errorMessage = ChatService.createMessage(
          'assistant',
          `❌ **Error:** ${fallbackError instanceof Error ? fallbackError.message : 'Something went wrong'}`,
          { error: true }
        );
        
        const finalMessages = [...updatedMessages, errorMessage];
        setMessages(finalMessages);
        messageCache.current.set(currentSession.id, finalMessages);
        
        SessionService.addMessage(
          currentSession.id,
          'assistant',
          errorMessage.content,
          errorMessage.metadata
        ).catch(console.error);
      }
      
      setIsLoading(false);
      setThinkingMessage('');
    }
  };

  const handleNewSession = async () => {
    try {
      setIsSessionLoading(true);
      await createNewSession();
    } catch (error) {
      Alert.alert('Error', 'Failed to create new session');
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      setIsSessionLoading(true);
      const session = await SessionService.getSession(sessionId);
      setCurrentSession(session);
      await AsyncStorage.setItem(CURRENT_SESSION_KEY, sessionId);
      await loadSessionMessages(sessionId);
      setShowSessions(false); // Close sessions sidebar
    } catch (error) {
      Alert.alert('Error', 'Failed to load session');
      console.error('❌ Error selecting session:', error);
    } finally {
      setIsSessionLoading(false);
    }
  };

  const getMessageIcon = (type: ChatMessage['type'], metadata?: any) => {
    if (metadata?.loading) return 'hourglass-outline';
    if (metadata?.error) return 'alert-circle-outline';
    
    switch (type) {
      case 'user': return 'person-outline';
      case 'assistant': return 'chatbubble-ellipses-outline';
      case 'system': return 'settings-outline';
      case 'tool': return 'construct-outline';
      default: return 'chatbubble-outline';
    }
  };

  const getMessageColor = (type: ChatMessage['type'], metadata?: any) => {
    if (metadata?.error) return '#dc3545';
    if (metadata?.loading) return '#ffc107';
    
    switch (type) {
      case 'user': return '#fff';
      case 'assistant': return '#4285F4';
      case 'system': return '#6c757d';
      case 'tool': return '#28a745';
      default: return '#4285F4';
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.type === 'user';
    const isSystem = item.type === 'system';
    const isTool = item.type === 'tool';
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.assistantMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : 
          isSystem ? styles.systemBubble : 
          isTool ? styles.toolBubble : 
          styles.assistantBubble
        ]}>
          {!isUser && (
            <View style={styles.messageHeader}>
              <Ionicons 
                name={getMessageIcon(item.type, item.metadata)} 
                size={16} 
                color={getMessageColor(item.type, item.metadata)} 
              />
              <Text style={[
                styles.messageRole,
                { color: getMessageColor(item.type, item.metadata) }
              ]}>
                {isSystem ? 'System' : isTool ? 'Tool' : 'Assistant'}
              </Text>
              {item.metadata?.loading && (
                <ActivityIndicator size="small" color="#ffc107" style={styles.loadingSpinner} />
              )}
            </View>
          )}
          
          <Text style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
            item.metadata?.error && styles.errorText
          ]}>
            {item.content}
          </Text>
          
          {item.metadata?.toolName && (
            <View style={styles.toolBadge}>
              <MaterialIcons name="build" size={12} color="#28a745" />
              <Text style={styles.toolText}>{item.metadata.toolName}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    );
  };

  const suggestedCommands = ['/connect', '/status', '/help', '/calendar', '/emails'];

  if (isSessionLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Initializing chat session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with session info and controls */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.sessionsToggle} 
          onPress={() => setShowSessions(!showSessions)}
        >
          <MaterialIcons 
            name={showSessions ? "close" : "menu"} 
            size={24} 
            color="#4285F4" 
          />
        </TouchableOpacity>
        <View style={styles.sessionInfo}>
          <MaterialIcons name="chat" size={20} color="#4285F4" />
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {currentSession?.title || 'Chat Session'}
          </Text>
        </View>
        <TouchableOpacity style={styles.newChatButton} onPress={handleNewSession}>
          <Ionicons name="add" size={20} color="#4285F4" />
        </TouchableOpacity>
      </View>
      
      {/* Sessions Sidebar */}
      {showSessions && (
        <View style={styles.sessionsOverlay}>
          <TouchableOpacity 
            style={styles.overlay} 
            onPress={() => setShowSessions(false)}
          />
          <View style={styles.sessionsSidebar}>
            <SessionList
              onSelectSession={handleSelectSession}
              currentSessionId={currentSession?.id}
              onNewSession={handleNewSession}
            />
          </View>
        </View>
      )}
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={20}
          windowSize={10}
        />
        
        {/* Streaming Message */}
        {streamingMessage && (
          <StreamingMessage
            content={streamingMessage.content}
            isStreaming={streamingMessage.isStreaming}
            toolName={streamingMessage.toolName}
            toolStatus={streamingMessage.toolStatus}
            onStreamComplete={() => {
              // Auto-scroll when streaming completes
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
          />
        )}
        
        {/* Thinking Animation */}
        <ThinkingAnimation visible={isLoading && !!thinkingMessage} message={thinkingMessage} />
        
        {messages.length <= 1 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>💡 Quick Commands:</Text>
            <View style={styles.suggestionsRow}>
              {suggestedCommands.map((cmd) => (
                <TouchableOpacity
                  key={cmd}
                  style={styles.suggestionChip}
                  onPress={() => setInputText(cmd)}
                >
                  <Text style={styles.suggestionText}>{cmd}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message or /command..."
            placeholderTextColor="#8e8e93"
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <MaterialIcons 
                name="send" 
                size={20} 
                color={(!inputText.trim() || isLoading) ? '#8e8e93' : '#4285F4'} 
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
  },
  sessionsToggle: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    marginRight: 12,
  },
  newChatButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
  },
  // Sessions Sidebar Styles
  sessionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sessionsSidebar: {
    width: Math.min(screenWidth * 0.85, 350),
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  keyboardAvoid: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  assistantMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: '#4285F4',
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8eaed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  systemBubble: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  toolBubble: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginLeft: 4,
  },
  loadingSpinner: {
    marginLeft: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#202124',
  },
  errorText: {
    color: '#dc3545',
  },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  toolText: {
    fontSize: 11,
    color: '#28a745',
    marginLeft: 4,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
    color: '#8e8e93',
    marginTop: 4,
    marginHorizontal: 4,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  suggestionChip: {
    backgroundColor: '#e8f4fd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  suggestionText: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#f1f3f4',
    shadowOpacity: 0,
    elevation: 0,
  },
});