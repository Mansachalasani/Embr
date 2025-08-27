import { Linking, Alert } from 'react-native';

export interface DeepLinkAction {
  name: string;
  description: string;
  keywords: string[];
  execute: (query: string) => Promise<boolean>;
}

export class DeepLinkingService {
  private static actions: DeepLinkAction[] = [
    // Phone & Contacts
    {
      name: 'Make Phone Call',
      description: 'Make a phone call to a contact or number',
      keywords: ['call', 'phone', 'dial', 'ring'],
      execute: async (query: string) => {
        const phoneMatch = query.match(/(\+?\d[\d\s\-()]+)/);
        const phoneNumber = phoneMatch ? phoneMatch[1].replace(/[^\d+]/g, '') : null;
        
        if (phoneNumber) {
          const url = `tel:${phoneNumber}`;
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
            return true;
          }
        }
        return false;
      }
    },
    {
      name: 'Open Contacts',
      description: 'Open the contacts app',
      keywords: ['contacts', 'phonebook', 'address book'],
      execute: async (query: string) => {
        try {
          await Linking.openURL('contacts://');
          return true;
        } catch {
          // Fallback for different platforms
          try {
            await Linking.openURL('contact://');
            return true;
          } catch {
            return false;
          }
        }
      }
    },
    
    // Amazon Shopping
    {
      name: 'Amazon Search',
      description: 'Search for products on Amazon',
      keywords: ['amazon', 'shop', 'buy', 'purchase', 'order'],
      execute: async (query: string) => {
        // Extract search terms
        const searchMatch = query.match(/(?:amazon|shop|buy|purchase|order)\s+(.+?)(?:\s+under\s+|\s+below\s+|\s*$)/i);
        let searchTerm = searchMatch ? searchMatch[1] : '';
        
        // Extract price if mentioned
        const priceMatch = query.match(/under\s+(?:\$|₹|rs\.?\s*)?(\d+(?:k|,?\d{3})*)/i);
        if (priceMatch) {
          const price = priceMatch[1].replace(/k$/i, '000').replace(/,/g, '');
          searchTerm += ` under ${price}`;
        }
        
        if (!searchTerm.trim()) {
          // If no specific search term, extract from context
          const contextMatch = query.match(/show\s+me\s+(.+)|find\s+(.+)|(.+)\s+on\s+amazon/i);
          searchTerm = contextMatch ? (contextMatch[1] || contextMatch[2] || contextMatch[3]) : 'products';
        }
        
        const encodedSearch = encodeURIComponent(searchTerm.trim());
        const amazonUrl = `https://www.amazon.com/s?k=${encodedSearch}`;
        
        const canOpen = await Linking.canOpenURL(amazonUrl);
        if (canOpen) {
          await Linking.openURL(amazonUrl);
          return true;
        }
        return false;
      }
    },
    
    // Spotify Music
    {
      name: 'Spotify Play',
      description: 'Play music on Spotify',
      keywords: ['spotify', 'play', 'music', 'song', 'artist'],
      execute: async (query: string) => {
        // Extract song/artist name
        const musicMatch = query.match(/(?:play|song|music)\s+(.+?)(?:\s+on\s+spotify|\s*$)/i);
        let searchTerm = musicMatch ? musicMatch[1] : '';
        
        if (!searchTerm.trim()) {
          // Try different patterns
          const altMatch = query.match(/spotify\s+(.+)/i);
          searchTerm = altMatch ? altMatch[1] : 'music';
        }
        
        const encodedSearch = encodeURIComponent(searchTerm.trim());
        
        // Try to open in Spotify app first
        const spotifyAppUrl = `spotify:search:${encodedSearch}`;
        try {
          const canOpenApp = await Linking.canOpenURL(spotifyAppUrl);
          if (canOpenApp) {
            await Linking.openURL(spotifyAppUrl);
            return true;
          }
        } catch (error) {
          console.log('Spotify app not available, trying web version');
        }
        
        // Fallback to web version
        const spotifyWebUrl = `https://open.spotify.com/search/${encodedSearch}`;
        const canOpenWeb = await Linking.canOpenURL(spotifyWebUrl);
        if (canOpenWeb) {
          await Linking.openURL(spotifyWebUrl);
          return true;
        }
        
        return false;
      }
    },
    
    // Maps & Navigation
    {
      name: 'Open Maps',
      description: 'Open maps and navigate to a location',
      keywords: ['maps', 'navigate', 'directions', 'location', 'go to'],
      execute: async (query: string) => {
        const locationMatch = query.match(/(?:maps|navigate|directions|go to)\s+(.+)/i);
        const location = locationMatch ? locationMatch[1] : '';
        
        if (location.trim()) {
          const encodedLocation = encodeURIComponent(location.trim());
          const mapsUrl = `https://maps.google.com/maps?q=${encodedLocation}`;
          
          const canOpen = await Linking.canOpenURL(mapsUrl);
          if (canOpen) {
            await Linking.openURL(mapsUrl);
            return true;
          }
        }
        return false;
      }
    },
    
    // YouTube
    {
      name: 'YouTube Search',
      description: 'Search for videos on YouTube',
      keywords: ['youtube', 'video', 'watch', 'tutorial'],
      execute: async (query: string) => {
        const videoMatch = query.match(/(?:youtube|video|watch|tutorial)\s+(.+)/i);
        let searchTerm = videoMatch ? videoMatch[1] : '';
        
        if (!searchTerm.trim()) {
          searchTerm = 'videos';
        }
        
        const encodedSearch = encodeURIComponent(searchTerm.trim());
        const youtubeUrl = `https://www.youtube.com/results?search_query=${encodedSearch}`;
        
        const canOpen = await Linking.canOpenURL(youtubeUrl);
        if (canOpen) {
          await Linking.openURL(youtubeUrl);
          return true;
        }
        return false;
      }
    },
    
    // Messages
    {
      name: 'Send Message',
      description: 'Send a text message',
      keywords: ['message', 'text', 'sms', 'send'],
      execute: async (query: string) => {
        const phoneMatch = query.match(/(?:message|text|sms)\s+(\+?\d[\d\s\-()]+)/);
        const phoneNumber = phoneMatch ? phoneMatch[1].replace(/[^\d+]/g, '') : null;
        
        if (phoneNumber) {
          const url = `sms:${phoneNumber}`;
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
            return true;
          }
        } else {
          // Open messages app without specific number
          try {
            await Linking.openURL('sms:');
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }
    },
    
    // Email
    {
      name: 'Send Email',
      description: 'Send an email',
      keywords: ['email', 'mail', 'send email'],
      execute: async (query: string) => {
        const emailMatch = query.match(/(?:email|mail)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const email = emailMatch ? emailMatch[1] : '';
        
        const subjectMatch = query.match(/subject\s+(.+?)(?:\s+body|\s*$)/i);
        const subject = subjectMatch ? subjectMatch[1] : '';
        
        const bodyMatch = query.match(/body\s+(.+)/i);
        const body = bodyMatch ? bodyMatch[1] : '';
        
        let mailtoUrl = 'mailto:';
        if (email) {
          mailtoUrl += email;
        }
        
        const params = new URLSearchParams();
        if (subject) params.append('subject', subject);
        if (body) params.append('body', body);
        
        if (params.toString()) {
          mailtoUrl += '?' + params.toString();
        }
        
        const canOpen = await Linking.canOpenURL(mailtoUrl);
        if (canOpen) {
          await Linking.openURL(mailtoUrl);
          return true;
        }
        return false;
      }
    },
    
    // Settings
    {
      name: 'Open Settings',
      description: 'Open device settings',
      keywords: ['settings', 'preferences', 'config'],
      execute: async (query: string) => {
        try {
          await Linking.openSettings();
          return true;
        } catch {
          return false;
        }
      }
    }
  ];

  /**
   * Process a natural language query and execute appropriate deep link action
   */
  static async processDeepLinkQuery(query: string): Promise<{ success: boolean; action?: string; message?: string }> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Find matching actions
    const matches = this.actions.filter(action => 
      action.keywords.some(keyword => normalizedQuery.includes(keyword))
    );
    
    if (matches.length === 0) {
      return {
        success: false,
        message: 'No matching app or action found for your request.'
      };
    }
    
    // Try the best match first (most keywords matched)
    const bestMatch = matches.reduce((best, current) => {
      const bestScore = best.keywords.filter(k => normalizedQuery.includes(k)).length;
      const currentScore = current.keywords.filter(k => normalizedQuery.includes(k)).length;
      return currentScore > bestScore ? current : best;
    });
    
    try {
      const success = await bestMatch.execute(query);
      
      if (success) {
        return {
          success: true,
          action: bestMatch.name,
          message: `✅ Opened ${bestMatch.name}`
        };
      } else {
        return {
          success: false,
          action: bestMatch.name,
          message: `❌ Could not open ${bestMatch.name}. Make sure the app is installed.`
        };
      }
    } catch (error) {
      console.error('Deep link error:', error);
      return {
        success: false,
        action: bestMatch.name,
        message: `❌ Error opening ${bestMatch.name}: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Get all available deep link actions
   */
  static getAvailableActions(): DeepLinkAction[] {
    return this.actions;
  }

  /**
   * Check if a query might be a deep link request
   */
  static isDeepLinkQuery(query: string): boolean {
    const normalizedQuery = query.toLowerCase().trim();
    return this.actions.some(action => 
      action.keywords.some(keyword => normalizedQuery.includes(keyword))
    );
  }

  /**
   * Get suggestions for deep link actions
   */
  static getSuggestions(): string[] {
    return [
      "Call John at +1234567890",
      "Open contacts",
      "Show me shoes under $100 on Amazon",
      "Play some jazz music on Spotify",
      "Navigate to Central Park",
      "Watch cooking tutorials on YouTube",
      "Send a text to +1234567890",
      "Email john@example.com",
      "Open settings"
    ];
  }
}