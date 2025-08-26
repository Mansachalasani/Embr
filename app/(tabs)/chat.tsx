import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../types/chat';
import { ChatService } from '../../services/chatService';

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: '👋 **Welcome to MCP Chat!**\n\nI can help you access your Google Workspace data.\n\n**First time here?**\n1. Use `/connect` to link your Google account\n2. Then try `/calendar` or `/emails`\n3. Type `/help` to see all commands\n\n**Quick start:** Type `/connect` to begin!',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (inputText.trim() === '' || isLoading) return;

    const userMessage = ChatService.createMessage('user', inputText.trim());
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      const responses = await ChatService.processMessage(currentInput);
      setMessages(prev => [...prev, ...responses]);
    } catch (error) {
      const errorMessage = ChatService.createMessage(
        'assistant',
        `❌ **Error:** ${error instanceof Error ? error.message : 'Something went wrong'}`,
        { error: true }
      );
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }

    // Auto-scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.type === 'user';
    const isSystem = item.type === 'system';
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.assistantMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : isSystem ? styles.systemBubble : styles.assistantBubble
        ]}>
          {!isUser && (
            <View style={styles.messageHeader}>
              <Ionicons 
                name={isSystem ? 'settings-outline' : 'chatbubble-outline'} 
                size={14} 
                color={isSystem ? '#6c757d' : '#4285F4'} 
              />
              <Text style={styles.messageRole}>
                {isSystem ? 'System' : 'Assistant'}
              </Text>
              {item.metadata?.loading && (
                <View style={styles.loadingDot}>
                  <Text>•••</Text>
                </View>
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
              <Ionicons name="construct-outline" size={12} color="#6c757d" />
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

  const suggestedCommands = ['/connect', '/status', '/help', '/calendar'];

  return (
    <SafeAreaView style={styles.container}>
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
        />
        
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
            <Ionicons 
              name={isLoading ? "hourglass-outline" : "send"} 
              size={20} 
              color={(!inputText.trim() || isLoading) ? '#8e8e93' : '#4285F4'} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#f1f3f4',
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  systemBubble: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
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
  loadingDot: {
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
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(108, 117, 125, 0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  toolText: {
    fontSize: 10,
    color: '#6c757d',
    marginLeft: 2,
    fontWeight: '500',
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
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
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
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 6,
  },
  suggestionText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});