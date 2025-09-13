import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { realtimeVoiceService, ConversationCallbacks } from '../services/realtimeVoiceService';
import { useTheme } from '../contexts/ThemeContext';

interface RealtimeVoiceChatProps {
  sessionId?: string;
  onVoiceMessage?: (userText: string, aiText: string, audioData: ArrayBuffer) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  autoRecording?: boolean;
  naturalConversation?: boolean;
  disabled?: boolean;
}

export function RealtimeVoiceChat({
  sessionId,
  onVoiceMessage,
  onRecordingStateChange,
  autoRecording,
  naturalConversation,
  disabled = false
}: RealtimeVoiceChatProps) {
  const { colors } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [conversationActive, setConversationActive] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState('');
  const [lastAIMessage, setLastAIMessage] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initializing...');

  const listeningAnimation = useRef(new Animated.Value(0)).current;
  const thinkingAnimation = useRef(new Animated.Value(1)).current;
  const speakingAnimation = useRef(new Animated.Value(1)).current;

  const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    voiceButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
    idleButton: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
    },
    listeningButton: {
      backgroundColor: '#4CAF50',
      shadowColor: '#4CAF50',
    },
    thinkingButton: {
      backgroundColor: colors.warning,
      shadowColor: colors.warning,
    },
    speakingButton: {
      backgroundColor: '#2196F3',
      shadowColor: '#2196F3',
    },
    disabledButton: {
      backgroundColor: colors.surfaceVariant,
      shadowOpacity: 0,
      elevation: 0,
    },
    statusText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      fontWeight: '500',
    },
    messagePreview: {
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 12,
      maxWidth: 300,
    },
    messageText: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    userMessageText: {
      color: colors.primary,
    },
    aiMessageText: {
      color: colors.success,
    },
    unsupportedContainer: {
      alignItems: 'center',
      padding: 20,
    },
    unsupportedText: {
      fontSize: 14,
      color: colors.error,
      textAlign: 'center',
      marginTop: 8,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      textAlign: 'center',
      marginTop: 4,
    },
  });

  // Initialize voice service
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🔧 Initializing RealtimeVoiceChat...');

        // Wait a bit for the service to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        const supported = realtimeVoiceService.isSupported();
        const permission = realtimeVoiceService.hasAudioPermission();

        console.log('🔍 Voice capabilities:', { supported, permission });

        setIsSupported(supported);
        setHasPermission(permission);

        if (!supported) {
          setStatusMessage('Voice features not supported');
        } else if (!permission) {
          setStatusMessage('Microphone permission required');
        } else {
          setStatusMessage('Ready to start conversation');
        }
      } catch (error) {
        console.error('❌ Error initializing realtime voice chat:', error);
        setIsSupported(false);
        setStatusMessage('Failed to initialize voice features');
      }
    };

    initialize();
  }, []);

  // Auto-start conversation if enabled
  useEffect(() => {
    if (autoRecording && isSupported && hasPermission && sessionId && !conversationActive && !disabled) {
      console.log('🎤 Auto-starting conversation mode...');
      setTimeout(() => {
        if (!conversationActive) {
          startConversation();
        }
      }, 1000);
    }
  }, [autoRecording, isSupported, hasPermission, sessionId, conversationActive, disabled]);

  // Handle natural conversation mode
  useEffect(() => {
    if (naturalConversation && isSupported && hasPermission && sessionId && !conversationActive && !disabled) {
      console.log('💬 Starting natural conversation mode...');
      setTimeout(() => {
        if (!conversationActive) {
          startConversation();
        }
      }, 500);
    }
  }, [naturalConversation, isSupported, hasPermission, sessionId, conversationActive, disabled]);

  // Animations
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(listeningAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(listeningAnimation, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      listeningAnimation.setValue(0);
    }
  }, [isListening]);

  useEffect(() => {
    if (isThinking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(thinkingAnimation, {
            toValue: 1.15,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(thinkingAnimation, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      thinkingAnimation.setValue(1);
    }
  }, [isThinking]);

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(speakingAnimation, {
            toValue: 1.08,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(speakingAnimation, {
            toValue: 0.95,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      speakingAnimation.setValue(1);
    }
  }, [isSpeaking]);

  // Update parent recording state
  useEffect(() => {
    onRecordingStateChange?.(isListening || isThinking || isSpeaking);
  }, [isListening, isThinking, isSpeaking, onRecordingStateChange]);

  const startConversation = async () => {
    if (!sessionId || !isSupported || !hasPermission || conversationActive || disabled) {
      console.log('⚠️ Cannot start conversation:', {
        sessionId: !!sessionId,
        isSupported,
        hasPermission,
        conversationActive,
        disabled
      });
      return;
    }

    try {
      console.log('🚀 Starting conversation...');
      setStatusMessage('Starting conversation...');

      const callbacks: ConversationCallbacks = {
        onListening: () => {
          console.log('🎤 Listening callback');
          setIsListening(true);
          setIsThinking(false);
          setIsSpeaking(false);
          setStatusMessage('Listening... speak naturally');
        },

        onResults: (results) => {
          console.log('📝 Speech results callback:', results);
          if (results.length > 0) {
            setLastUserMessage(results[0]);
          }
        },

        onSpeechStart: () => {
          console.log('🗣️ Speech start callback');
          setStatusMessage('Speaking detected...');
        },

        onSpeechEnd: () => {
          console.log('🤐 Speech end callback');
          setIsListening(false);
        },

        onAIThinking: () => {
          console.log('🤔 AI thinking callback');
          setIsListening(false);
          setIsThinking(true);
          setIsSpeaking(false);
          setStatusMessage('AI is processing...');
        },

        onAIResponse: (text) => {
          console.log('💬 AI response callback:', text.substring(0, 50));
          setLastAIMessage(text);
          setIsThinking(false);
          setStatusMessage('AI responding...');

          // Notify parent component with voice message
          onVoiceMessage?.(lastUserMessage || 'Voice input', text, new ArrayBuffer(0));
        },

        onAISpeaking: () => {
          console.log('🔊 AI speaking callback');
          setIsThinking(false);
          setIsSpeaking(true);
          setStatusMessage('AI is responding...');
        },

        onError: (error) => {
          console.error('❌ Conversation error callback:', error);
          setIsListening(false);
          setIsThinking(false);
          setIsSpeaking(false);
          setStatusMessage('Error: ' + error);

          Alert.alert('Voice Error', `${error}`);
        },

        onConversationEnd: () => {
          console.log('🏁 Conversation end callback');
          setConversationActive(false);
          setIsListening(false);
          setIsThinking(false);
          setIsSpeaking(false);
          setStatusMessage('Conversation ended');
        },
      };

      await realtimeVoiceService.startConversation(sessionId, callbacks);
      setConversationActive(true);
      setStatusMessage('Conversation active');

    } catch (error) {
      console.error('❌ Error starting conversation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start conversation';
      setStatusMessage('Error: ' + errorMessage);
      Alert.alert('Voice Error', errorMessage);
    }
  };

  const stopConversation = async () => {
    try {
      console.log('🛑 Stopping conversation...');
      setStatusMessage('Stopping conversation...');

      await realtimeVoiceService.stopConversation();

      setConversationActive(false);
      setIsListening(false);
      setIsThinking(false);
      setIsSpeaking(false);
      setStatusMessage('Conversation stopped');
    } catch (error) {
      console.error('❌ Error stopping conversation:', error);
      setStatusMessage('Error stopping conversation');
    }
  };

  const handleButtonPress = async () => {
    if (disabled || !isSupported) {
      console.log('⚠️ Button press ignored:', { disabled, isSupported });
      return;
    }

    if (!hasPermission) {
      Alert.alert(
        'Microphone Permission Required',
        'Please allow microphone access to use voice features.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!sessionId) {
      Alert.alert('Error', 'No active session available');
      return;
    }

    console.log('🔘 Button pressed, current state:', { conversationActive, isListening, isThinking, isSpeaking });

    if (conversationActive) {
      await stopConversation();
    } else {
      await startConversation();
    }
  };

  const getButtonStyle = () => {
    if (disabled || !isSupported || !hasPermission) return styles.disabledButton;
    if (isListening) return styles.listeningButton;
    if (isThinking) return styles.thinkingButton;
    if (isSpeaking) return styles.speakingButton;
    return styles.idleButton;
  };

  const getButtonIcon = () => {
    if (!isSupported || !hasPermission) return 'mic-off';
    if (isListening) return 'mic';
    if (isThinking) return 'psychology';
    if (isSpeaking) return 'volume-up';
    if (conversationActive) return 'stop';
    return 'mic';
  };

  const getAnimatedScale = () => {
    if (isListening) return listeningAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.1],
    });
    if (isThinking) return thinkingAnimation;
    if (isSpeaking) return speakingAnimation;
    return 1;
  };

  if (isSupported === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>Initializing voice...</Text>
      </View>
    );
  }

  if (!isSupported) {
    return (
      <View style={styles.unsupportedContainer}>
        <TouchableOpacity
          style={[styles.voiceButton, styles.disabledButton]}
          disabled
        >
          <MaterialIcons name="mic-off" size={32} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.unsupportedText}>
          {Platform.OS === 'web'
            ? 'Voice features are not supported in this browser. Try Chrome or Firefox.'
            : 'Voice features are not available on this device.'
          }
        </Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.unsupportedContainer}>
        <TouchableOpacity
          style={[styles.voiceButton, styles.disabledButton]}
          onPress={handleButtonPress}
        >
          <MaterialIcons name="mic-off" size={32} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.errorText}>
          Microphone permission required
        </Text>
        <Text style={styles.statusText}>
          Tap to enable microphone access
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          { transform: [{ scale: getAnimatedScale() }] }
        ]}
      >
        <TouchableOpacity
          style={[styles.voiceButton, getButtonStyle()]}
          onPress={handleButtonPress}
          disabled={disabled || !isSupported || !hasPermission}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={getButtonIcon()}
            size={32}
            color="white"
          />

          {/* Voice activity indicators */}
          {isListening && (
            <>
              {/* Listening wave effect */}
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 2,
                  borderColor: 'rgba(76, 175, 80, 0.5)',
                  opacity: listeningAnimation,
                }}
              />
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  borderWidth: 1,
                  borderColor: 'rgba(76, 175, 80, 0.3)',
                  opacity: listeningAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.6],
                  }),
                }}
              />
            </>
          )}

          {/* Thinking pulsing effect */}
          {isThinking && (
            <Animated.View
              style={{
                position: 'absolute',
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: 'rgba(255, 193, 7, 0.3)',
                transform: [{ scale: thinkingAnimation }],
              }}
            />
          )}

          {/* Speaking rhythm effect */}
          {isSpeaking && (
            <>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 95,
                  height: 95,
                  borderRadius: 47.5,
                  borderWidth: 2,
                  borderColor: 'rgba(33, 150, 243, 0.6)',
                  transform: [{ scale: speakingAnimation }],
                }}
              />
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.statusText}>
        {statusMessage}
      </Text>

      {/* Message previews */}
      {lastUserMessage && (
        <View style={styles.messagePreview}>
          <Text style={[styles.messageText, styles.userMessageText]}>
            You: {lastUserMessage.substring(0, 60)}{lastUserMessage.length > 60 ? '...' : ''}
          </Text>
        </View>
      )}

      {lastAIMessage && (
        <View style={styles.messagePreview}>
          <Text style={[styles.messageText, styles.aiMessageText]}>
            AI: {lastAIMessage.substring(0, 60)}{lastAIMessage.length > 60 ? '...' : ''}
          </Text>
        </View>
      )}

      {/* Debug info for development */}
      {__DEV__ && (
        <Text style={[styles.statusText, { fontSize: 10, color: colors.textSecondary, marginTop: 8 }]}>
          Debug: {JSON.stringify({ conversationActive, isListening, isThinking, isSpeaking })}
        </Text>
      )}
    </View>
  );
}