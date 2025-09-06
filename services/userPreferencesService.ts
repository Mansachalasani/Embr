
import { supabase } from '../lib/supabase';
import { UserPersonalizationData, UserPreferenceUpdatePayload } from '../types/userPreferences';

const MCP_BASE_URL = process.env.EXPO_PUBLIC_MCP_BASE_URL || 'http://localhost:3001/api';

export class UserPreferencesService {
  /**
   * Get user preferences
   */
  static async getUserPreferences(): Promise<{
    success: boolean;
    preferences: UserPersonalizationData | null;
    onboarding_completed: boolean;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/user/preferences`, {
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

      const data = await response.json();
      return {
        success: true,
        preferences: data.preferences,
        onboarding_completed: data.onboarding_completed,
      };
    } catch (error) {
      console.error('❌ Error fetching user preferences:', error);
      return {
        success: false,
        preferences: null,
        onboarding_completed: false,
        error: error instanceof Error ? error.message : 'Failed to fetch preferences',
      };
    }
  }

  /**
   * Save user preferences
   */
  static async saveUserPreferences(
    preferences: UserPersonalizationData,
    onboardingCompleted: boolean = false
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/user/preferences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences,
          onboarding_completed: onboardingCompleted,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('❌ Error saving user preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save preferences',
      };
    }
  }

  /**
   * Update specific preference sections
   */
  static async updatePreferences(
    updates: UserPreferenceUpdatePayload
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/user/preferences`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('❌ Error updating preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update preferences',
      };
    }
  }

  /**
   * Complete onboarding
   */
  static async completeOnboarding(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/user/preferences/complete-onboarding`, {
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

      const data = await response.json();
      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete onboarding',
      };
    }
  }

  /**
   * Reset preferences (for testing)
   */
  static async resetPreferences(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/user/preferences`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('❌ Error resetting preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset preferences',
      };
    }
  }

  /**
   * Get AI context preferences
   */
  static async getAIContextPreferences(): Promise<{
    success: boolean;
    ai_context?: any;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${MCP_BASE_URL}/user/preferences/ai-context`, {
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

      const data = await response.json();
      return {
        success: true,
        ai_context: data.ai_context,
      };
    } catch (error) {
      console.error('❌ Error fetching AI context preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch AI context',
      };
    }
  }
}