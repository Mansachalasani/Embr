import { Platform } from 'react-native';
import { ChatService } from './chatService';

// Import platform-specific voice libraries
let Voice: any = null;
let Tts: any = null;

// For mobile
if (Platform.OS !== 'web') {
  try {
    Voice = require('@react-native-voice/voice').default;
    Tts = require('react-native-tts').default;
  } catch (error) {
    console.warn('Voice libraries not available:', error);
  }
}

export interface VoiceRecognitionResult {
  text: string;
  confidence?: number;
}

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  language?: string;
}

export interface ConversationCallbacks {
  onListening?: () => void;
  onResults?: (results: string[]) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: any) => void;
  onAIThinking?: () => void;
  onAIResponse?: (text: string) => void;
  onAISpeaking?: () => void;
  onConversationEnd?: () => void;
}

class RealtimeVoiceService {
  private isListening = false;
  private isSpeaking = false;
  private isWebSpeechSupported = false;
  private webRecognition: any = null;
  private webSynthesis: any = null;
  private sessionId: string | null = null;
  private callbacks: ConversationCallbacks = {};
  private conversationActive = false;
  private currentUtterance: any = null;
  private recognitionTimeoutId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private lastSpeechTime = 0;
  private speechTimeout: NodeJS.Timeout | null = null;
  private hasPermission = false;
  private hasTTSPermission = false;
  private userHasInteracted = false;

  constructor() {
    this.initializeAPIs();
  }

  private async initializeAPIs() {
    try {
      if (Platform.OS === 'web') {
        await this.initializeWebAPIs();
      } else {
        await this.initializeMobileAPIs();
      }
    } catch (error) {
      console.error('❌ Error initializing voice APIs:', error);
    }
  }

  private async initializeWebAPIs() {
    if (typeof window === 'undefined') return;

    // Check for Web Speech API support
    this.isWebSpeechSupported = !!(
      window.SpeechRecognition || window.webkitSpeechRecognition
    );

    if (this.isWebSpeechSupported) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.webRecognition = new SpeechRecognition();

      // Configure recognition settings
      this.webRecognition.continuous = true;
      this.webRecognition.interimResults = false; // Only final results
      this.webRecognition.lang = 'en-US';
      this.webRecognition.maxAlternatives = 1;

      // Set up event listeners
      this.webRecognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        this.isListening = true;
        this.callbacks.onListening?.();
      };

      this.webRecognition.onresult = (event: any) => {
        try {
          const results = Array.from(event.results);
          const lastResult = results[results.length - 1];

          if (lastResult && lastResult.isFinal) {
            const transcript = lastResult[0].transcript.trim();
            console.log('📝 Final speech result:', transcript);

            if (transcript && transcript.length > 0) {
              this.handleSpeechResult(transcript);
            }
          }
        } catch (error) {
          console.error('❌ Error processing speech result:', error);
        }
      };

      this.webRecognition.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        this.isListening = false;

        // Handle specific errors
        if (event.error === 'not-allowed') {
          this.callbacks.onError?.('Microphone permission denied. Please allow microphone access.');
        } else if (event.error === 'no-speech') {
          // Restart listening if no speech detected and conversation is active
          if (this.conversationActive && !this.isProcessing && !this.isSpeaking) {
            setTimeout(() => this.restartListening(), 1000);
          }
        } else {
          this.callbacks.onError?.(event.error);
        }
      };

      this.webRecognition.onend = () => {
        console.log('🛑 Speech recognition ended');
        this.isListening = false;
        this.callbacks.onSpeechEnd?.();

        // Auto-restart if conversation is active and not processing
        if (this.conversationActive && !this.isProcessing && !this.isSpeaking) {
          setTimeout(() => this.restartListening(), 500);
        }
      };

      // Initialize Web Speech Synthesis
      this.webSynthesis = window.speechSynthesis;

      // Test TTS availability and prepare for user interaction
      if (this.webSynthesis) {
        this.prepareTTSForUserInteraction();
      }
    }

    // Request microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.hasPermission = true;
      stream.getTracks().forEach(track => track.stop()); // Stop the stream
    } catch (error) {
      console.warn('⚠️ Microphone permission not granted:', error);
      this.hasPermission = false;
    }
  }

  private async initializeMobileAPIs() {
    if (!Voice || !Tts) return;

    try {
      // Initialize Voice Recognition
      Voice.onSpeechStart = () => {
        console.log('🗣️ User started speaking');
        this.callbacks.onSpeechStart?.();
      };

      Voice.onSpeechEnd = () => {
        console.log('🤐 User stopped speaking');
        this.isListening = false;
        this.callbacks.onSpeechEnd?.();
      };

      Voice.onSpeechError = (error: any) => {
        console.error('❌ Speech recognition error:', error);
        this.isListening = false;
        this.callbacks.onError?.(error.error?.message || 'Speech recognition error');
      };

      Voice.onSpeechResults = (event: any) => {
        try {
          const results = event.value || [];
          if (results.length > 0) {
            const transcript = results[0].trim();
            console.log('📝 Mobile speech result:', transcript);

            if (transcript && transcript.length > 0) {
              this.handleSpeechResult(transcript);
            }
          }
        } catch (error) {
          console.error('❌ Error processing mobile speech result:', error);
        }
      };

      // Initialize TTS
      Tts.addEventListener('tts-start', () => {
        console.log('🔊 TTS started');
        this.isSpeaking = true;
        this.callbacks.onAISpeaking?.();
      });

      Tts.addEventListener('tts-finish', () => {
        console.log('✅ TTS finished');
        this.isSpeaking = false;

        // Restart listening after TTS finishes
        if (this.conversationActive && !this.isProcessing) {
          setTimeout(() => this.restartListening(), 1000);
        }
      });

      Tts.addEventListener('tts-cancel', () => {
        console.log('🛑 TTS cancelled');
        this.isSpeaking = false;
      });

      this.hasPermission = true;
    } catch (error) {
      console.error('❌ Error initializing mobile voice APIs:', error);
      this.hasPermission = false;
    }
  }

  private prepareTTSForUserInteraction() {
    if (Platform.OS !== 'web' || !this.webSynthesis) return;

    // Add click listener to enable TTS on first user interaction
    const enableTTS = () => {
      if (!this.userHasInteracted) {
        console.log('🔊 Enabling TTS after user interaction');
        this.userHasInteracted = true;

        // Test TTS with a silent utterance to "prime" the system
        try {
          const testUtterance = new SpeechSynthesisUtterance('');
          testUtterance.volume = 0;
          testUtterance.onstart = () => {
            this.hasTTSPermission = true;
            console.log('✅ TTS permission granted');
          };
          testUtterance.onerror = (error) => {
            console.warn('⚠️ TTS test failed:', error);
            this.hasTTSPermission = false;
          };
          this.webSynthesis.speak(testUtterance);
        } catch (error) {
          console.warn('⚠️ TTS test error:', error);
          this.hasTTSPermission = false;
        }
      }
    };

    // Add listeners for user interaction
    if (typeof document !== 'undefined') {
      document.addEventListener('click', enableTTS, { once: true });
      document.addEventListener('keydown', enableTTS, { once: true });
      document.addEventListener('touchstart', enableTTS, { once: true });
    }
  }

  private async handleSpeechResult(text: string) {
    if (!text.trim() || !this.sessionId || this.isProcessing) {
      console.log('⚠️ Ignoring speech result:', { text: text.substring(0, 30), sessionId: !!this.sessionId, isProcessing: this.isProcessing });
      return;
    }

    console.log('🎯 Processing speech result:', text);
    this.callbacks.onResults?.([text]);

    // Stop listening while processing
    await this.stopListening();
    this.isProcessing = true;

    try {
      // Indicate AI is thinking
      this.callbacks.onAIThinking?.();

      // Process the message with AI
      console.log('🤔 Sending to AI:', text);
      const responses = await ChatService.processMessage(text, this.sessionId);

      if (responses.length > 0) {
        const aiResponse = responses[responses.length - 1];
        console.log('💬 AI response received:', aiResponse.content.substring(0, 50));

        this.callbacks.onAIResponse?.(aiResponse.content);

        // Speak the AI response
        await this.speak(aiResponse.content);
      } else {
        console.warn('⚠️ No AI response received');
        throw new Error('No response from AI');
      }
    } catch (error) {
      console.error('❌ Error processing voice message:', error);
      this.callbacks.onError?.(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      this.isProcessing = false;
    }
  }

  private async restartListening() {
    if (!this.conversationActive || this.isListening || this.isProcessing || this.isSpeaking) {
      return;
    }

    try {
      console.log('🔄 Restarting listening...');
      await this.startListening();
    } catch (error) {
      console.error('❌ Error restarting listening:', error);
    }
  }

  async startListening(): Promise<void> {
    if (this.isListening || this.isSpeaking || !this.hasPermission) {
      console.log('⚠️ Cannot start listening:', { isListening: this.isListening, isSpeaking: this.isSpeaking, hasPermission: this.hasPermission });
      return;
    }

    try {
      console.log('🎤 Starting speech recognition...');

      if (Platform.OS === 'web' && this.webRecognition) {
        this.webRecognition.start();
      } else if (Voice) {
        await Voice.start('en-US');
      }

      this.isListening = true;
      this.callbacks.onListening?.();
    } catch (error) {
      console.error('❌ Error starting speech recognition:', error);
      this.isListening = false;

      // Provide specific error messages
      if (error instanceof Error) {
        if (error.name === 'InvalidStateError') {
          // Recognition is already started, just update state
          this.isListening = true;
          this.callbacks.onListening?.();
          return;
        }
      }

      this.callbacks.onError?.(error instanceof Error ? error.message : 'Failed to start listening');
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    try {
      console.log('🛑 Stopping speech recognition...');

      if (Platform.OS === 'web' && this.webRecognition) {
        this.webRecognition.stop();
      } else if (Voice) {
        await Voice.stop();
      }

      this.isListening = false;
    } catch (error) {
      console.error('❌ Error stopping speech recognition:', error);
      this.isListening = false;
    }
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (this.isSpeaking) {
      await this.stopSpeaking();
    }

    if (!text.trim()) {
      console.warn('⚠️ Empty text provided for speech');
      return;
    }

    try {
      console.log('🔊 Speaking:', text.substring(0, 50));

      if (Platform.OS === 'web' && this.webSynthesis) {
        // Check if user has interacted and TTS is available
        if (!this.userHasInteracted) {
          console.warn('⚠️ TTS requires user interaction first. Skipping speech but continuing conversation.');
          // Continue the conversation without speech
          this.callbacks.onAISpeaking?.();
          setTimeout(() => {
            this.isSpeaking = false;
          }, 1000); // Simulate speech time
          return;
        }

        return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = options.rate || 0.9;
          utterance.pitch = options.pitch || 1;
          utterance.volume = options.volume || 0.8;
          utterance.lang = options.language || 'en-US';

          let hasStarted = false;

          utterance.onstart = () => {
            console.log('🔊 Web TTS started');
            hasStarted = true;
            this.isSpeaking = true;
            this.callbacks.onAISpeaking?.();
          };

          utterance.onend = () => {
            console.log('✅ Web TTS finished');
            this.isSpeaking = false;
            resolve();
          };

          utterance.onerror = (error) => {
            console.error('❌ Web TTS error:', error);
            this.isSpeaking = false;

            // Handle specific TTS errors
            if (error.error === 'not-allowed') {
              console.warn('🚫 TTS not allowed. Continuing without speech.');
              // Don't reject, just resolve to continue conversation
              resolve();
            } else if (error.error === 'network') {
              console.warn('🌐 TTS network error. Continuing without speech.');
              resolve();
            } else {
              reject(error);
            }
          };

          // Set a timeout to handle cases where TTS doesn't start
          const startTimeout = setTimeout(() => {
            if (!hasStarted) {
              console.warn('⏰ TTS start timeout. Continuing without speech.');
              this.isSpeaking = false;
              resolve();
            }
          }, 2000);

          utterance.onstart = () => {
            clearTimeout(startTimeout);
            console.log('🔊 Web TTS started');
            hasStarted = true;
            this.isSpeaking = true;
            this.callbacks.onAISpeaking?.();
          };

          this.currentUtterance = utterance;

          try {
            this.webSynthesis.speak(utterance);
          } catch (speakError) {
            clearTimeout(startTimeout);
            console.error('❌ Error calling speak():', speakError);
            this.isSpeaking = false;
            resolve(); // Continue without speech
          }
        });
      } else if (Tts) {
        this.isSpeaking = true;
        this.callbacks.onAISpeaking?.();

        await Tts.speak(text, {
          androidParams: {
            KEY_PARAM_PAN: -1,
            KEY_PARAM_VOLUME: options.volume || 0.8,
            KEY_PARAM_STREAM: 'STREAM_MUSIC',
          },
          iosVoiceId: 'com.apple.ttsbundle.Moira-compact',
          rate: options.rate || 0.5,
          pitch: options.pitch || 1.0,
        });
      } else {
        // No TTS available, just simulate speaking
        console.warn('⚠️ No TTS available. Continuing conversation without speech.');
        this.callbacks.onAISpeaking?.();
        setTimeout(() => {
          this.isSpeaking = false;
        }, Math.min(text.length * 50, 3000)); // Simulate reading time
      }
    } catch (error) {
      console.error('❌ Error speaking text:', error);
      this.isSpeaking = false;
      // Don't throw error, continue conversation
      console.warn('🔄 Continuing conversation despite TTS error');
    }
  }

  async stopSpeaking(): Promise<void> {
    if (!this.isSpeaking) return;

    try {
      console.log('🛑 Stopping speech...');

      if (Platform.OS === 'web' && this.webSynthesis) {
        this.webSynthesis.cancel();
        if (this.currentUtterance) {
          this.currentUtterance = null;
        }
      } else if (Tts) {
        await Tts.stop();
      }

      this.isSpeaking = false;
    } catch (error) {
      console.error('❌ Error stopping speech:', error);
      this.isSpeaking = false;
    }
  }

  async startConversation(sessionId: string, callbacks: ConversationCallbacks): Promise<void> {
    if (this.conversationActive) {
      console.log('⚠️ Conversation already active');
      return;
    }

    if (!this.hasPermission) {
      throw new Error('Microphone permission required');
    }

    this.sessionId = sessionId;
    this.callbacks = callbacks;
    this.conversationActive = true;
    this.isProcessing = false;

    console.log('🗣️ Starting real-time conversation mode');

    // Mark that user has interacted (starting conversation is a user action)
    this.userHasInteracted = true;

    // Try to enable TTS if on web
    if (Platform.OS === 'web' && this.webSynthesis && !this.hasTTSPermission) {
      try {
        // Test with a very short, quiet utterance
        const testUtterance = new SpeechSynthesisUtterance('test');
        testUtterance.volume = 0.01;
        testUtterance.rate = 10; // Very fast
        testUtterance.onstart = () => {
          this.hasTTSPermission = true;
          console.log('✅ TTS enabled for conversation');
        };
        testUtterance.onerror = () => {
          console.warn('⚠️ TTS not available, conversation will continue without speech');
          this.hasTTSPermission = false;
        };
        this.webSynthesis.speak(testUtterance);
      } catch (error) {
        console.warn('⚠️ Could not test TTS:', error);
        this.hasTTSPermission = false;
      }
    }

    // Start listening
    await this.startListening();
  }

  async stopConversation(): Promise<void> {
    if (!this.conversationActive) return;

    console.log('🛑 Stopping conversation mode');
    this.conversationActive = false;

    // Stop all activities
    await this.stopListening();
    await this.stopSpeaking();

    // Clear timeouts
    if (this.recognitionTimeoutId) {
      clearTimeout(this.recognitionTimeoutId);
      this.recognitionTimeoutId = null;
    }

    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }

    this.callbacks.onConversationEnd?.();
    this.callbacks = {};
    this.sessionId = null;
    this.isProcessing = false;
  }

  isConversationActive(): boolean {
    return this.conversationActive;
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  hasAudioPermission(): boolean {
    return this.hasPermission;
  }

  isSupported(): boolean {
    if (Platform.OS === 'web') {
      return this.isWebSpeechSupported && !!this.webSynthesis;
    }
    return !!(Voice && Tts);
  }

  async destroy(): Promise<void> {
    await this.stopConversation();

    if (Platform.OS !== 'web' && Voice) {
      try {
        await Voice.destroy();
      } catch (error) {
        console.warn('⚠️ Error destroying Voice:', error);
      }
    }
  }
}

export const realtimeVoiceService = new RealtimeVoiceService();
export { RealtimeVoiceService };