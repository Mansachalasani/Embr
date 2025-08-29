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
  const [availableVoices, setAvailableVoices] = useState<Array<{name: string; displayName: string}>>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

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
      if (!hasPermission) {
        Alert.alert(
          'Microphone Permission Required',
          'Please enable microphone access to use voice features.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: initializeVoiceService }
          ]
        );
        return;
      }

      const newVoiceMode = !isVoiceModeEnabled;
      
      if (newVoiceMode) {
        const result = await VoiceService.enableConversationMode(sessionId);
        if (result.success) {
          setIsVoiceModeEnabled(true);
        } else {
          Alert.alert('Error', 'Failed to enable voice mode');
        }
      } else {
        const result = await VoiceService.disableConversationMode();
        if (result.success) {
          setIsVoiceModeEnabled(false);
          // Cancel any ongoing recording
          if (isRecording) {
            voiceService.current.cancelRecording();
            setIsRecording(false);
          }
        } else {
          Alert.alert('Error', 'Failed to disable voice mode');
        }
      }
    } catch (error) {
      console.error('❌ Error toggling voice mode:', error);
      Alert.alert('Error', 'Failed to toggle voice mode');
    }
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
        // Play the AI response
        setIsPlaying(true);
        await VoiceService.playAudioResponse(result.audioData);
        setIsPlaying(false);

        // Notify parent component
        onVoiceMessage?.(result.userText, result.aiText, result.audioData);

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

  const getRecordButtonStyle = () => {
    if (disabled || !isVoiceModeEnabled) return styles.disabledButton;
    if (isRecording) return styles.recordingButton;
    if (isProcessing) return styles.processingButton;
    if (isPlaying) return styles.playingButton;
    return styles.idleRecordButton;
  };

  const getRecordButtonIcon = () => {
    if (isProcessing) return 'hourglass-outline';
    if (isPlaying) return 'volume-high-outline';
    if (isRecording) return 'stop';
    return 'mic';
  };

  const getStatusText = () => {
    if (!hasPermission) return 'Microphone access required';
    if (!isVoiceModeEnabled) return 'Voice mode disabled';
    if (isRecording) return 'Listening...';
    if (isProcessing) return 'Processing your message...';
    if (isPlaying) return 'Playing AI response...';
    return 'Tap to speak';
  };

  const getStatusIcon = () => {
    if (!hasPermission) return 'warning-outline';
    if (!isVoiceModeEnabled) return 'mic-off-outline';
    if (isRecording) return 'mic';
    if (isProcessing) return 'cog-outline';
    if (isPlaying) return 'volume-high-outline';
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
        <Ionicons
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
            <Ionicons
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
          <Ionicons
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

      {/* Voice Settings */}
      {isVoiceModeEnabled && availableVoices.length > 0 && (
        <TouchableOpacity 
          style={styles.voiceSettings}
          onPress={() => {
            // Cycle through available voices
            const currentIndex = availableVoices.findIndex(v => v.name === selectedVoice);
            const nextIndex = (currentIndex + 1) % availableVoices.length;
            changeVoice(availableVoices[nextIndex].name);
          }}
        >
          <MaterialIcons name="record-voice-over" size={12} color={colors.primary} />
          <Text style={styles.voiceSettingsText}>
            {availableVoices.find(v => v.name === selectedVoice)?.displayName || 'Voice'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}