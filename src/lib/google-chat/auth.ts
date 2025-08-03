import { GoogleAuth } from 'google-auth-library';
import { JWT } from 'google-auth-library/build/src/auth/jwtclient';
import { getGoogleChatConfig, GOOGLE_CHAT_SCOPES } from './config';

export class GoogleChatAuth {
  private auth: GoogleAuth;
  private jwtClient: JWT | null = null;

  constructor() {
    const config = getGoogleChatConfig();
    
    this.auth = new GoogleAuth({
      scopes: GOOGLE_CHAT_SCOPES,
      projectId: config.projectId,
      // Use service account key if provided
      ...(config.serviceAccountKey && {
        credentials: JSON.parse(config.serviceAccountKey),
      }),
      ...(config.serviceAccountKeyPath && {
        keyFile: config.serviceAccountKeyPath,
      }),
    });
  }

  /**
   * Get authenticated JWT client for Google Chat API
   */
  async getAuthClient(): Promise<JWT> {
    if (this.jwtClient) {
      return this.jwtClient;
    }

    try {
      const client = await this.auth.getClient();
      
      if (client instanceof JWT) {
        this.jwtClient = client;
        return this.jwtClient;
      }
      
      throw new Error('Failed to create JWT client for Google Chat');
    } catch (error) {
      console.error('Google Chat authentication error:', error);
      throw new Error('Google Chat authentication failed');
    }
  }

  /**
   * Get access token for API requests
   */
  async getAccessToken(): Promise<string> {
    try {
      const client = await this.getAuthClient();
      const tokenResponse = await client.getAccessToken();
      
      if (!tokenResponse.token) {
        throw new Error('No access token received');
      }
      
      return tokenResponse.token;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw new Error('Failed to get Google Chat access token');
    }
  }

  /**
   * Get project ID from configuration
   */
  getProjectId(): string {
    const config = getGoogleChatConfig();
    return config.projectId;
  }

  /**
   * Verify authentication by making a test API call
   */
  async verifyAuth(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAccessToken();
      
      // Make a simple API call to verify the token works
      const response = await fetch(
        `https://chat.googleapis.com/v1/spaces`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: `API call failed: ${response.status} ${errorData.error?.message || response.statusText}` 
        };
      }
    } catch (error) {
      console.error('Auth verification error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown verification error' 
      };
    }
  }

  /**
   * Create authenticated headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Clear cached authentication
   */
  clearAuth(): void {
    this.jwtClient = null;
  }
}

// Singleton instance
let authInstance: GoogleChatAuth | null = null;

export const getGoogleChatAuth = (): GoogleChatAuth => {
  if (!authInstance) {
    authInstance = new GoogleChatAuth();
  }
  return authInstance;
};

export const clearGoogleChatAuth = (): void => {
  if (authInstance) {
    authInstance.clearAuth();
    authInstance = null;
  }
};