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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { VoiceService } from '../services/voiceService';
import { useTheme } from '../contexts/ThemeContext';
import * as FileSystem from 'expo-file-system';

interface VoiceChatProps {
  sessionId?: string;
  onVoiceMessage?: (userText: string, aiText: string, audioData: ArrayBuffer) => void;
  onVoiceModeChange?: (enabled: boolean) => void;
  disabled?: boolean;
}

export function VoiceChat({ 
  sessionId, 
  onVoiceMessage, 
  onVoiceModeChange,
  disabled = false 
}: VoiceChatProps) {
  const { colors } = useTheme();
  const [isVoiceModeEnabled, setIsVoiceModeEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRehearing, setIsRehearing] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const voiceService = useRef<VoiceService>(new VoiceService());
  const recordingAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
    },
    voiceModeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isVoiceModeEnabled ? colors.primary + '20' : colors.surfaceVariant,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: isVoiceModeEnabled ? colors.primary : colors.border,
    },
    voiceModeText: {
      marginLeft: 6,
      fontSize: 12,
      fontWeight: '600',
      color: isVoiceModeEnabled ? colors.primary : colors.textSecondary,
    },
    recordButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    recordingButton: {
      backgroundColor: colors.error,
      shadowColor: colors.error,
    },
    idleRecordButton: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
    },
    processingButton: {
      backgroundColor: colors.warning,
      shadowColor: colors.warning,
    },
    playingButton: {
      backgroundColor: colors.success,
      shadowColor: colors.success,
    },
    disabledButton: {
      backgroundColor: colors.surfaceVariant,
      shadowOpacity: 0,
      elevation: 0,
    },
    statusContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusText: {
      fontSize: 14,
      color: colors.text,
      marginLeft: 8,
    },
    permissionContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.warning + '20',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.warning + '40',
    },
    permissionText: {
      fontSize: 12,
      color: colors.warning,
      marginLeft: 6,
    },
    voiceSettings: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 16,
      marginLeft: 8,
    },
    voiceSettingsText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginLeft: 4,
    },
    rehearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 12,
      marginLeft: 8,
    },
    rehearButtonText: {
      fontSize: 10,
      fontWeight: '600',
      marginLeft: 4,
    },
    testButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 3,
      backgroundColor: colors.warning + '20',
      borderRadius: 10,
      marginLeft: 8,
    },
    testButtonText: {
      fontSize: 9,
      fontWeight: '600',
      marginLeft: 3,
    },
    continuousButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.primary + '20',
      borderRadius: 16,
      marginLeft: 8,
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    continuousButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    continuousButtonText: {
      fontSize: 11,
      fontWeight: '700',
      marginLeft: 4,
    },
    sendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      marginLeft: 8,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    sendButtonText: {
      fontSize: 10,
      fontWeight: '600',
      marginLeft: 3,
    },
  });

  // Initialize voice service and check permissions
  useEffect(() => {
    initializeVoiceService();
  }, []);

  // Handle voice mode changes
  useEffect(() => {
    onVoiceModeChange?.(isVoiceModeEnabled);
  }, [isVoiceModeEnabled, onVoiceModeChange]);

  // Recording animation
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      recordingAnimation.setValue(0);
    }
  }, [isRecording]);

  // Pulse animation for processing
  useEffect(() => {
    if (isProcessing || isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isProcessing, isPlaying]);

  const initializeVoiceService = async () => {
    try {
      // Check microphone permissions
      const permission = await VoiceService.initialize();
      setHasPermission(permission);

      if (permission) {
        // Load available voices
        await loadAvailableVoices();
        
        // Check if user is already in conversation mode
        await checkConversationStatus();
      }
    } catch (error) {
      console.error('❌ Error initializing voice service:', error);
      setHasPermission(false);
    }
  };

  const loadAvailableVoices = async () => {
    try {
      const result = await VoiceService.getAvailableVoices();
      if (result.success && result.voices) {
        setAvailableVoices(result.voices);
        if (result.voices.length > 0 && !selectedVoice) {
          setSelectedVoice(result.voices[0].name);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load available voices:', error);
    }
  };

  const checkConversationStatus = async () => {
    try {
      const result = await VoiceService.getConversationStatus();
      if (result.success && result.conversationMode?.enabled) {
        setIsVoiceModeEnabled(true);
      }
    } catch (error) {
      console.warn('⚠️ Could not check conversation status:', error);
    }
  };

  const toggleVoiceMode = async () => {
    if (disabled) return;

    try {
      const newVoiceMode = !isVoiceModeEnabled;
      
      if (newVoiceMode) {
        // Auto-request permissions when enabling voice mode
        if (!hasPermission) {
          console.log('🎤 Auto-requesting microphone permissions...');
          const permissionGranted = await VoiceService.initialize();
          if (!permissionGranted) {
            Alert.alert(
              'Microphone Access Required',
              'Voice features need microphone access. Please enable it in your device settings and try again.',
              [{ text: 'OK', style: 'default' }]
            );
            return;
          }
          setHasPermission(true);
        }

        const result = await VoiceService.enableConversationMode(sessionId);
        if (result.success) {
          setIsVoiceModeEnabled(true);
          console.log('✅ Voice mode enabled successfully');
        } else {
          Alert.alert('Error', 'Failed to enable voice mode');
        }
      } else {
        // Disable continuous mode if it's active
        if (isContinuousMode) {
          await voiceService.current.stopContinuousMode();
          setIsContinuousMode(false);
          setIsListening(false);
        }

        const result = await VoiceService.disableConversationMode();
        if (result.success) {
          setIsVoiceModeEnabled(false);
          // Cancel any ongoing recording
          if (isRecording) {
            voiceService.current.cancelRecording();
            setIsRecording(false);
          }
          console.log('✅ Voice mode disabled successfully');
        } else {
          Alert.alert('Error', 'Failed to disable voice mode');
        }
      }
    } catch (error) {
      console.error('❌ Error toggling voice mode:', error);
      Alert.alert('Error', 'Failed to toggle voice mode');
    }
  };

  const toggleContinuousMode = async () => {
    if (disabled || !isVoiceModeEnabled) return;

    try {
      if (!isContinuousMode) {
        // Start continuous mode
        if (!sessionId) {
          Alert.alert('Error', 'Session ID is required for continuous mode');
          return;
        }

        await voiceService.current.startContinuousMode(sessionId, (message) => {
          console.log('📢 Continuous message received:', message);
          
          // Update UI to show the conversation
          if (onVoiceMessage) {
            onVoiceMessage(message.userText, message.aiText, message.audioData);
          }
        });

        setIsContinuousMode(true);
        setIsListening(true);
        
        // Start listening animation
        startListeningAnimation();
        
      } else {
        // Stop continuous mode
        await voiceService.current.stopContinuousMode();
        
        setIsContinuousMode(false);
        setIsListening(false);
        
        // Stop listening animation
        recordingAnimation.setValue(0);
      }
    } catch (error) {
      console.error('❌ Error toggling continuous mode:', error);
      Alert.alert('Error', 'Failed to toggle continuous mode');
      setIsContinuousMode(false);
      setIsListening(false);
    }
  };

  const startListeningAnimation = () => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(recordingAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(recordingAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
  };

  const startRecording = async () => {
    if (!isVoiceModeEnabled || disabled || isRecording || isProcessing) return;

    try {
      await voiceService.current.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      setIsRecording(false);
      setIsProcessing(true);

      const audioUri = await voiceService.current.stopRecording();
      
      // Process the voice message
      const result = await VoiceService.processVoiceMessage(audioUri);
      
      if (result.success && result.audioData && result.userText && result.aiText) {
        
        // Notify parent component
        onVoiceMessage?.(result.userText, result.aiText, result.audioData);
        
        // Play the AI response
        setIsPlaying(true);
        await VoiceService.playAudioResponse(result.audioData);
        setIsPlaying(false);


        // Clean up the temporary audio file
        if (Platform.OS !== 'web') {
          FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(console.warn);
        }
      } else {
        Alert.alert('Error', result.error || 'Voice processing failed');
      }
    } catch (error) {
      console.error('❌ Error processing voice:', error);
      Alert.alert('Error', 'Failed to process voice message');
    } finally {
      setIsProcessing(false);
      setIsPlaying(false);
    }
  };

  const changeVoice = async (voiceName: string) => {
    try {
      const result = await VoiceService.setVoice(voiceName);
      if (result.success) {
        setSelectedVoice(voiceName);
      }
    } catch (error) {
      console.warn('⚠️ Failed to change voice:', error);
    }
  };

  const rehearLastRecording = async () => {
    if (!voiceService.current.hasRecordingToRehear()) {
      Alert.alert('No Recording', 'No recording available to rehear');
      return;
    }

    try {
      setIsRehearing(true);
      await voiceService.current.rehearLastRecording();
    } catch (error) {
      console.error('❌ Error rehearing recording:', error);
      Alert.alert('Error', 'Failed to play back recording');
    } finally {
      setIsRehearing(false);
    }
  };

  const testAudioProcessing = async () => {
    if (!voiceService.current.hasRecordingToRehear()) {
      Alert.alert('No Recording', 'Please record something first to test audio processing');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await VoiceService.testAudioProcessing(voiceService.current.lastRecordingUri!);
      
      if (result.success) {
        const { results } = result;
        let message = 'Audio Test Results:\n\n';
        
        if (results.bufferStream) {
          message += `Buffer Stream: ${results.bufferStream.success ? 'SUCCESS' : 'FAILED'}\n`;
          if (results.bufferStream.success) {
            message += `Text: "${results.bufferStream.text}"\n`;
          } else {
            message += `Error: ${results.bufferStream.error}\n`;
          }
        }
        
        if (results.base64) {
          message += `\nBase64: ${results.base64.success ? 'SUCCESS' : 'FAILED'}\n`;
          if (results.base64.success) {
            message += `Text: "${results.base64.text}"\n`;
          } else {
            message += `Error: ${results.base64.error}\n`;
          }
        }
        
        Alert.alert('Audio Test Results', message);
      } else {
        Alert.alert('Test Failed', result.error || 'Audio test failed');
      }
    } catch (error) {
      console.error('❌ Error testing audio:', error);
      Alert.alert('Error', 'Failed to test audio processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const getRecordButtonStyle = () => {
    if (disabled || !isVoiceModeEnabled) return styles.disabledButton;
    if (isRecording) return styles.recordingButton;
    if (isProcessing) return styles.processingButton;
    if (isPlaying) return styles.playingButton;
    return styles.idleRecordButton;
  };

  const getRecordButtonIcon = () => {
    if (isProcessing) return 'hourglass-empty';
    if (isPlaying) return 'volume-up';
    if (isRecording) return 'stop';
    return 'mic';
  };

  const getStatusText = () => {
    if (!hasPermission) return 'Tap voice button to enable microphone';
    if (!isVoiceModeEnabled) return 'Tap voice button to start';
    if (isContinuousMode && isListening) return 'Listening... take your time, speak completely';
    if (isContinuousMode && !isListening) return 'Processing your complete message...';
    if (isRecording) return 'Recording... speak your full message';
    if (isProcessing) return 'AI is processing your complete message...';
    if (isPlaying) return 'Playing response...';
    if (isRehearing) return 'Playing your recording...';
    return 'Tap mic or use Auto Chat for hands-free conversation';
  };

  const getStatusIcon = () => {
    if (!hasPermission) return 'warning-amber';
    if (!isVoiceModeEnabled) return 'mic-off';
    if (isRecording) return 'mic';
    if (isProcessing) return 'animation';
    if (isPlaying) return 'volume-up';
    return 'mic-outline';
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.statusText, { marginLeft: 8 }]}>
          Initializing voice...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Voice Mode Toggle */}
      <TouchableOpacity 
        style={styles.voiceModeToggle}
        onPress={toggleVoiceMode}
        disabled={disabled}
      >
        <MaterialIcons
          name={isVoiceModeEnabled ? "mic" : "mic-off"}
          size={16}
          color={isVoiceModeEnabled ? colors.primary : colors.textSecondary}
        />
        <Text style={styles.voiceModeText}>
          {isVoiceModeEnabled ? 'Voice' : 'Voice'}
        </Text>
      </TouchableOpacity>

      {/* Record Button */}
      <Animated.View
        style={[
          { transform: [{ scale: pulseAnimation }] }
        ]}
      >
        <TouchableOpacity
          style={[styles.recordButton, getRecordButtonStyle()]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={disabled || !isVoiceModeEnabled || isProcessing || isPlaying}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialIcons
              name={getRecordButtonIcon()}
              size={20}
              color="white"
            />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Status Display */}
      {!hasPermission ? (
        <TouchableOpacity 
          style={styles.permissionContainer}
          onPress={initializeVoiceService}
        >
          <MaterialIcons name="mic-off" size={16} color={colors.warning} />
          <Text style={styles.permissionText}>Tap to enable microphone</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.statusContainer}>
          <MaterialIcons
            name={getStatusIcon()}
            size={16}
            color={
              isRecording ? colors.error :
              isProcessing ? colors.warning :
              isPlaying ? colors.success :
              isVoiceModeEnabled ? colors.primary :
              colors.textSecondary
            }
          />
          <Text style={styles.statusText}>
            {getStatusText()}
          </Text>
          
          {/* Recording Animation */}
          {isRecording && (
            <Animated.View
              style={{
                marginLeft: 8,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.error,
                opacity: recordingAnimation,
              }}
            />
          )}
        </View>
      )}


      {/* Manual Send Button - Show when in continuous mode and listening */}
      {isContinuousMode && isListening && (
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={async () => {
            // Manually trigger processing of current recording
            if (voiceService.current.getIsRecording()) {
              console.log('👆 User manually ended speech');
              // This will trigger the processContinuousRecording
              await voiceService.current.stopRecording();
            }
          }}
        >
          <MaterialIcons name="send" size={18} color={colors.primary} />
          <Text style={[styles.sendButtonText, { color: colors.primary }]}>
            Send
          </Text>
        </TouchableOpacity>
      )}

      {/* Continuous Mode Button */}
      {isVoiceModeEnabled && sessionId && (
        <TouchableOpacity 
          style={[
            styles.continuousButton,
            isContinuousMode && styles.continuousButtonActive
          ]}
          onPress={toggleContinuousMode}
          disabled={isRecording || isProcessing || isPlaying || isRehearing}
        >
          <MaterialIcons 
            name={isContinuousMode ? "stop" : "autorenew"} 
            size={18} 
            color={isContinuousMode ? colors.background : colors.primary} 
          />
          {isListening && (
            <Animated.View
              style={{
                marginLeft: 4,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: isContinuousMode ? colors.background : colors.success,
                opacity: recordingAnimation,
              }}
            />
          )}
          <Text style={[
            styles.continuousButtonText, 
            { color: isContinuousMode ? colors.background : colors.primary }
          ]}>
            {isContinuousMode ? 'Stop Auto' : 'Auto Chat'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

