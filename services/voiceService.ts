import { supabase } from '../lib/supabase';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';

const MCP_BASE_URL = 'http://localhost:3001/api';

export interface VoiceResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface ConversationStatus {
  enabled: boolean;
  sessionId?: string;
  userId: string;
}

export class VoiceService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private isRecording = false;
  private isInitialized = false;

  /**
   * Initialize voice service and request microphone permissions
   */
  static async initialize(): Promise<boolean> {
    try {
      // Request microphone permissions
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status === 'granted') {
        // Set audio mode for recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        
        console.log('🎤 Audio permissions granted and mode set');
        return true;
      } else {
        console.error('❌ Microphone access denied:', permission);
        return false;
      }
    } catch (error) {
      console.error('❌ Error initializing audio:', error);
      return false;
    }
  }

  /**
   * Enable conversational mode
   */
  static async enableConversationMode(sessionId?: string): Promise<VoiceResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/enable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error enabling conversation mode:', error);
      throw error;
    }
  }

  /**
   * Disable conversational mode
   */
  static async disableConversationMode(): Promise<VoiceResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error disabling conversation mode:', error);
      throw error;
    }
  }

  /**
   * Get conversational mode status
   */
  static async getConversationStatus(): Promise<{ success: boolean; conversationMode: ConversationStatus | null; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error getting conversation status:', error);
      return { success: false, conversationMode: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Start recording audio
   */
  
  async startRecording(): Promise<void> {
    try {
      if (this.isRecording) return;
  
      if (!this.isInitialized) {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        this.isInitialized = true;
      }
  
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
  
      this.recording = recording;
      this.isRecording = true;
      console.log("🎤 Started recording");
    } catch (error) {
      console.error("❌ Error starting recording:", error);
      throw error;
    }
  }

  /**
   * Stop recording audio and return file URI
   */
  async stopRecording(): Promise<string> {
    try {
      if (!this.isRecording || !this.recording) {
        throw new Error('Not currently recording');
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      this.isRecording = false;
      
      if (!uri) {
        throw new Error('Recording failed - no URI available');
      }
      
      console.log('🎤 Stopped recording, file URI:', uri);
      
      // Clean up the recording object
      this.recording = null;
      
      return uri;
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      this.isRecording = false;
      this.recording = null;
      throw error;
    }
  }

  /**
   * Clean up recording resources
   */
  private cleanup(): void {
    this.isRecording = false;
    if (this.recording) {
      this.recording.stopAndUnloadAsync().catch(console.error);
      this.recording = null;
    }
    if (this.sound) {
      this.sound.unloadAsync().catch(console.error);
      this.sound = null;
    }
  }

  /**
   * Cancel current recording
   */
  cancelRecording(): void {
    if (this.isRecording) {
      this.cleanup();
      console.log('🎤 Recording canceled');
    }
  }

  /**
   * Send audio file to backend and get response
   */
  static async processVoiceMessage(audioUri: string): Promise<{
    success: boolean;
    audioData?: ArrayBuffer;
    userText?: string;
    aiText?: string;
    toolUsed?: string;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      console.log('🎤 Sending audio for processing...', audioUri);

      // Create FormData for file upload
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        // For web, we need to read the blob from the URI
        const response = await fetch(audioUri);
        const audioBlob = await response.blob();
        formData.append('audio', audioBlob, 'recording.webm');
      } else {
        // For mobile platforms, use the file URI directly
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (!fileInfo.exists) {
          throw new Error('Audio file not found');
        }

        formData.append('audio', {
          uri: audioUri,
          type: 'audio/m4a',
          name: 'recording.m4a',
        } as any);
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/speak`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const audioData = await response.arrayBuffer();
      const userText = response.headers.get('X-User-Text') || '';
      const aiText = response.headers.get('X-AI-Text') || '';
      const toolUsed = response.headers.get('X-Tool-Used') || '';

      console.log('🔊 Received audio response:', audioData.byteLength, 'bytes');
      console.log('🎤 User said:', userText);
      console.log('🧠 AI responded:', aiText);

      return {
        success: true,
        audioData,
        userText,
        aiText,
        toolUsed,
      };
    } catch (error) {
      console.error('❌ Error processing voice message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Voice processing failed',
      };
    }
  }

  /**
   * Play audio response using Expo AV
   */
  static async playAudioResponse(audioData: ArrayBuffer): Promise<void> {
    try {
      console.log('🔊 Playing audio response');
      
      // Convert ArrayBuffer to base64 for mobile platforms
      const base64Audio = Buffer.from(audioData).toString('base64');
      const audioUri = `data:audio/wav;base64,${base64Audio}`;
      
      // Create and play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 }
      );
      
      // Wait for playback to complete
      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              sound.unloadAsync().catch(console.error);
              resolve();
            }
          } else if (status.error) {
            console.error('❌ Audio playback error:', status.error);
            sound.unloadAsync().catch(console.error);
            reject(new Error(status.error));
          }
        });
      });
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech
   */
  static async textToSpeech(text: string): Promise<ArrayBuffer | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/tts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('❌ Error in text-to-speech:', error);
      return null;
    }
  }

  /**
   * Process text query in conversational mode
   */
  static async processTextMessage(query: string, sessionId?: string): Promise<VoiceResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error processing text message:', error);
      throw error;
    }
  }

  /**
   * Get available voices
   */
  static async getAvailableVoices(): Promise<{ success: boolean; voices?: Array<{name: string; displayName: string}>; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/voices`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error getting voices:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Set voice for TTS
   */
  static async setVoice(voiceName: string): Promise<VoiceResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ voiceName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error setting voice:', error);
      throw error;
    }
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }
}