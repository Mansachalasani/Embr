import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { AzureSpeechService } from '../services/azureSpeechService';
import { AIService } from '../services/aiService';
import { SessionService } from '../services/sessionService';
import { UserContext } from '../types/aiTools';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files including common mobile formats
    const allowedMimeTypes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/m4a',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'application/octet-stream' // Sometimes mobile uploads come as this
    ];
    
    if (file.mimetype.startsWith('audio/') || allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Audio file type not supported: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`));
    }
  },
});

const speechService = AzureSpeechService.getInstance();
const aiService = new AIService();

/**
 * Enable conversational mode for a user
 * POST /api/conversation/enable
 */
router.post('/enable', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const { sessionId } = req.body;
    
    speechService.enableConversationMode(req.user.id, sessionId);
    
    res.json({
      success: true,
      message: 'Conversational mode enabled',
      userId: req.user.id,
      sessionId,
    });
    
    console.log(`🗣️ Conversational mode enabled for user: ${req.user.email}`);
    
  } catch (error) {
    console.error('❌ Error enabling conversational mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable conversational mode',
    });
  }
});

/**
 * Disable conversational mode for a user
 * POST /api/conversation/disable
 */
router.post('/disable', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    speechService.disableConversationMode(req.user.id);
    
    res.json({
      success: true,
      message: 'Conversational mode disabled',
      userId: req.user.id,
    });
    
    console.log(`🔇 Conversational mode disabled for user: ${req.user.email}`);
    
  } catch (error) {
    console.error('❌ Error disabling conversational mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable conversational mode',
    });
  }
});

/**
 * Get conversational mode status
 * GET /api/conversation/status
 */
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const isEnabled = speechService.isConversationMode(req.user.id);
    const mode = speechService.getConversationMode(req.user.id);
    
    res.json({
      success: true,
      conversationMode: {
        enabled: isEnabled,
        ...mode,
      },
    });
    
  } catch (error) {
    console.error('❌ Error getting conversation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation status',
    });
  }
});

/**
 * Process speech-to-text and return AI response with text-to-speech
 * POST /api/conversation/speak
 */
router.post('/speak', authenticateToken, upload.single('audio'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required',
      });
    }

    console.log(`🎤 Processing speech for user: ${req.user.email}`);

    // Convert audio to text
    const audioBuffer = req.file.buffer;
    const audioStream = require('stream').Readable.from(audioBuffer);
    
    const speechResult = await speechService.speechToText(audioStream);
    
    if (!speechResult.success || !speechResult.text) {
      return res.status(400).json({
        success: false,
        error: speechResult.error || 'Failed to recognize speech',
      });
    }

    console.log(`🎤 Speech recognized: "${speechResult.text}"`);

    // Get conversation mode info
    const conversationMode = speechService.getConversationMode(req.user.id);
    
    // Process AI query with conversation context
    const context: UserContext = {
      query: speechResult.text,
      timestamp: new Date().toISOString(),
      timezone: req.headers['x-timezone'] as string || 'UTC',
      sessionId: conversationMode?.sessionId,
      preferences: {
        responseStyle: 'conversational',
        includeActions: false, // Disable suggested actions in voice mode
      },
    };

    const aiResponse = await aiService.processQuery(context, req.user.id);
    
    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        error: aiResponse.error || 'AI processing failed',
      });
    }

    console.log(`🧠 AI response: "${aiResponse.naturalResponse}"`);

    // Convert AI response to speech
    const ttsResult = await speechService.textToSpeech(aiResponse.naturalResponse);
    
    if (!ttsResult.success || !ttsResult.audioData) {
      return res.status(500).json({
        success: false,
        error: ttsResult.error || 'Failed to synthesize speech',
      });
    }

    // Save conversation to session if session ID is provided
    if (conversationMode?.sessionId) {
      try {
        await SessionService.addMessage({
          session_id: conversationMode.sessionId,
          role: 'user',
          content: speechResult.text,
          metadata: { isVoice: true }
        });
        
        await SessionService.addMessage({
          session_id: conversationMode.sessionId,
          role: 'assistant',
          content: aiResponse.naturalResponse,
          metadata: { 
            isVoice: true,
            toolUsed: aiResponse.toolUsed,
            reasoning: aiResponse.reasoning,
          }
        });
      } catch (sessionError) {
        console.warn('⚠️ Failed to save conversation to session:', sessionError);
      }
    }

    console.log(`🔊 Speech synthesis completed, returning ${ttsResult.audioData.length} bytes`);

    // Return audio response
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': ttsResult.audioData.length.toString(),
      'X-User-Text': speechResult.text,
      'X-AI-Text': aiResponse.naturalResponse,
      'X-Tool-Used': aiResponse.toolUsed || '',
    });

    res.send(ttsResult.audioData);

  } catch (error) {
    console.error('❌ Error in speech processing:', error);
    res.status(500).json({
      success: false,
      error: 'Speech processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Process text query in conversational mode (returns clean text without formatting)
 * POST /api/conversation/text
 */
router.post('/text', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const { query, sessionId } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string',
      });
    }

    console.log(`💬 Processing text query in conversation mode: "${query}"`);

    // Process AI query with conversational formatting
    const context: UserContext = {
      query: query.trim(),
      timestamp: new Date().toISOString(),
      timezone: req.headers['x-timezone'] as string || 'UTC',
      sessionId: sessionId || speechService.getConversationMode(req.user.id)?.sessionId,
      preferences: {
        responseStyle: 'conversational',
        includeActions: false, // No suggested actions in conversation mode
      },
    };

    const aiResponse = await aiService.processQuery(context, req.user.id);

    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        error: aiResponse.error || 'AI processing failed',
      });
    }

    // Clean response for conversational mode
    const cleanResponse = speechService['cleanTextForSpeech'](aiResponse.naturalResponse);

    res.json({
      success: true,
      data: {
        query: context.query,
        response: cleanResponse,
        originalResponse: aiResponse.naturalResponse,
        toolUsed: aiResponse.toolUsed,
        reasoning: aiResponse.reasoning,
        chainedTools: aiResponse.chainedTools,
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`💬 Conversational text response: "${cleanResponse}"`);

  } catch (error) {
    console.error('❌ Error in conversational text processing:', error);
    res.status(500).json({
      success: false,
      error: 'Conversational text processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Text-to-speech endpoint
 * POST /api/conversation/tts
 */
router.post('/tts', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string',
      });
    }

    console.log(`🔊 Converting text to speech: "${text.substring(0, 50)}..."`);

    const ttsResult = await speechService.textToSpeech(text);
    
    if (!ttsResult.success || !ttsResult.audioData) {
      return res.status(500).json({
        success: false,
        error: ttsResult.error || 'Failed to synthesize speech',
      });
    }

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': ttsResult.audioData.length.toString(),
    });

    res.send(ttsResult.audioData);

  } catch (error) {
    console.error('❌ Error in text-to-speech:', error);
    res.status(500).json({
      success: false,
      error: 'Text-to-speech failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get available voices
 * GET /api/conversation/voices
 */
router.get('/voices', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const voices = speechService.getAvailableVoices();
    
    res.json({
      success: true,
      voices: voices.map(voice => ({
        name: voice,
        displayName: voice.replace('en-US-', '').replace('Neural', '').replace('Multilingual', ''),
      })),
    });

  } catch (error) {
    console.error('❌ Error getting voices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available voices',
    });
  }
});

/**
 * Set voice for TTS
 * POST /api/conversation/voice
 */
router.post('/voice', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const { voiceName } = req.body;

    if (!voiceName || typeof voiceName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Voice name is required and must be a string',
      });
    }

    speechService.setVoice(voiceName);
    
    res.json({
      success: true,
      message: `Voice changed to ${voiceName}`,
      voiceName,
    });

  } catch (error) {
    console.error('❌ Error setting voice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set voice',
    });
  }
});

export default router;