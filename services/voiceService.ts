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
  private lastRecordingUri: string | null = null;

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
  
      // Use specific options optimized for Azure Speech Recognition
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000, // Azure Speech optimal
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000, // Azure Speech optimal  
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
  
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
      
      // Store the last recording for rehear functionality
      this.lastRecordingUri = uri;
      
      // Get file info for debugging
      if (Platform.OS !== 'web') {
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          console.log('📁 File info:', {
            exists: fileInfo.exists,
            size: fileInfo.exists ? fileInfo.size : 'N/A',
            uri: uri
          });
        } catch (e) {
          console.warn('⚠️ Could not get file info:', e);
        }
      }
      
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
   * Play back the last recorded audio
   */
  async rehearLastRecording(): Promise<void> {
    if (!this.lastRecordingUri) {
      throw new Error('No recording available to rehear');
    }

    try {
      console.log('🔊 Playing back last recording:', this.lastRecordingUri);
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: this.lastRecordingUri },
        { shouldPlay: true, volume: 1.0 }
      );

      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              sound.unloadAsync().catch(console.error);
              resolve();
            }
          } else if (status.error) {
            console.error('❌ Rehear playback error:', status.error);
            sound.unloadAsync().catch(console.error);
            reject(new Error(status.error));
          }
        });
      });
    } catch (error) {
      console.error('❌ Error rehearing recording:', error);
      throw error;
    }
  }

  /**
   * Get whether there's a recording available to rehear
   */
  hasRecordingToRehear(): boolean {
    return !!this.lastRecordingUri;
  }

  /**
   * Test audio processing without full AI pipeline (for debugging)
   */
  static async testAudioProcessing(audioUri: string): Promise<{
    success: boolean;
    results?: any;
    fileInfo?: any;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      console.log('🧪 Testing audio processing...', audioUri);

      // Create FormData for file upload
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(audioUri);
        const audioBlob = await response.blob();
        formData.append('audio', audioBlob, 'test-recording.webm');
      } else {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (!fileInfo.exists) {
          throw new Error('Audio file not found');
        }
        
        const base64String = await FileSystem.readAsStringAsync(audioUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        formData.append('audio', {
          uri: audioUri,
          type: 'audio/m4a',
          name: 'test-recording.m4a',
        } as any);
        
        formData.append('base64String', base64String);
      }

      const response = await fetch(`${MCP_BASE_URL}/conversation/test-audio`, {
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

      const result = await response.json();
      console.log('🧪 Audio test results:', result);

      return {
        success: true,
        results: result.results,
        fileInfo: result.fileInfo,
      };
    } catch (error) {
      console.error('❌ Error testing audio processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audio test failed',
      };
    }
  }

// async convertBlobToWav(blob: Blob): Promise<Blob> {
//     const arrayBuffer = await blob.arrayBuffer();
//     const audioContext = new AudioContext();
//     const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
//     const channelData = [];
//     for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
//       channelData.push(audioBuffer.getChannelData(i));
//     }
  
//     const wavBuffer = await WavEncoder.encode({
//       sampleRate: audioBuffer.sampleRate,
//       channelData,
//     });
  
//     return new Blob([wavBuffer], { type: "audio/wav" });
//   }

//   async  convertToWav(inputUri: string): Promise<string> {
//     const outputUri = inputUri.replace(/\.m4a$/, ".wav");
  
//     await FFmpegKit.execute(
//       `-i ${inputUri} -ar 44100 -ac 2 -b:a 192k ${outputUri}`
//     );
  
//     return outputUri;
//   }
  
async speechToTextFromBase64(base64Audio: string): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const pushStream = sdk.AudioInputStream.createPushStream();

      // Convert base64 → Buffer → ArrayBuffer and push
      const audioBuffer = Buffer.from(base64Audio, "base64");
      pushStream.write(
        audioBuffer.buffer.slice(
          audioBuffer.byteOffset,
          audioBuffer.byteOffset + audioBuffer.byteLength
        )
      );
      pushStream.close();

      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
      const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

      recognizer.recognizeOnceAsync(
        (result) => {
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            console.log("🎤 Speech recognized:", result.text);
            resolve({ success: true, text: result.text });
          } else if (result.reason === sdk.ResultReason.NoMatch) {
            console.log("🎤 No speech could be recognized");
            resolve({ success: false, error: "No speech recognized" });
          } else {
            console.log("🎤 Speech recognition error:", result.errorDetails);
            resolve({ success: false, error: result.errorDetails });
          }
          recognizer.close();
        },
        (error) => {
          console.error("🎤 Speech recognition failed:", error);
          resolve({ success: false, error: error.toString() });
          recognizer.close();
        }
      );
    } catch (error) {
      console.error("🎤 Speech-to-text error:", error);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
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
        // For mobile platforms, read file as base64 and send both file and base64
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (!fileInfo.exists) {
          throw new Error('Audio file not found');
        }
        
        console.log('📁 Mobile file info:', {
          exists: fileInfo.exists,
          size: fileInfo.size,
          uri: audioUri
        });
        
        const base64String = await FileSystem.readAsStringAsync(audioUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('🔧 Base64 string length:', base64String.length);

        // Send the file for multer to handle (use proper format based on recording settings)
        formData.append('audio', {
          uri: audioUri,
          type: 'audio/wav',
          name: 'recording.wav',
        } as any);
        
        // Also send base64 string in the body
        formData.append('base64String', base64String);
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