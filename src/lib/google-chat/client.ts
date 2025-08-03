import { getGoogleChatAuth } from './auth';
import { ChatMessage, ChatEvent, getGoogleChatConfig } from './config';

export interface Space {
  name: string;
  type: 'ROOM' | 'DM';
  displayName?: string;
  spaceType?: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE';
  createTime?: string;
  singleUserBotDm?: boolean;
  threaded?: boolean;
}

export interface User {
  name: string;
  displayName: string;
  email: string;
  type: 'HUMAN' | 'BOT';
  domainId?: string;
}

export interface Message {
  name: string;
  sender: User;
  createTime: string;
  text: string;
  thread?: {
    name: string;
  };
  space: Space;
  argumentText?: string;
  matchedUrl?: {
    url: string;
  };
}

export class GoogleChatClient {
  private auth = getGoogleChatAuth();
  private baseUrl = 'https://chat.googleapis.com/v1';

  /**
   * Send a message to a specific space
   */
  async sendMessage(spaceName: string, message: ChatMessage): Promise<Message> {
    try {
      const headers = await this.auth.getAuthHeaders();
      
      const response = await fetch(
        `${this.baseUrl}/spaces/${spaceName}/messages`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(message),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to send message: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending Chat message:', error);
      throw error;
    }
  }

  /**
   * Send a direct message to a user by email
   */
  async sendDirectMessage(userEmail: string, message: ChatMessage): Promise<Message> {
    try {
      // For DMs, we need to create or find the DM space first
      const spaceName = await this.getOrCreateDirectMessageSpace(userEmail);
      return await this.sendMessage(spaceName, message);
    } catch (error) {
      console.error('Error sending direct message:', error);
      throw error;
    }
  }

  /**
   * Get or create a direct message space with a user
   */
  private async getOrCreateDirectMessageSpace(userEmail: string): Promise<string> {
    try {
      const headers = await this.auth.getAuthHeaders();
      
      // Try to find existing DM space
      const spacesResponse = await fetch(
        `${this.baseUrl}/spaces?filter=spaceType="DIRECT_MESSAGE"`,
        {
          headers,
        }
      );

      if (spacesResponse.ok) {
        const spacesData = await spacesResponse.json();
        const spaces = spacesData.spaces || [];
        
        // Look for existing DM with the user
        for (const space of spaces) {
          if (space.singleUserBotDm) {
            // This is a DM space, check if it's with the target user
            const membersResponse = await fetch(
              `${this.baseUrl}/spaces/${space.name}/members`,
              { headers }
            );
            
            if (membersResponse.ok) {
              const membersData = await membersResponse.json();
              const members = membersData.memberships || [];
              const hasTargetUser = members.some((member: any) => 
                member.member?.email === userEmail
              );
              
              if (hasTargetUser) {
                return space.name;
              }
            }
          }
        }
      }

      // If no existing DM found, we'll use a space name format
      // Note: In practice, you might need to handle space creation differently
      return `spaces/DIRECT_MESSAGE_${userEmail.replace('@', '_AT_').replace('.', '_DOT_')}`;
    } catch (error) {
      console.error('Error getting/creating DM space:', error);
      // Fallback to a constructed space name
      return `spaces/DIRECT_MESSAGE_${userEmail.replace('@', '_AT_').replace('.', '_DOT_')}`;
    }
  }

  /**
   * List spaces the bot has access to
   */
  async listSpaces(): Promise<Space[]> {
    try {
      const headers = await this.auth.getAuthHeaders();
      
      const response = await fetch(
        `${this.baseUrl}/spaces`,
        {
          headers,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to list spaces: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.spaces || [];
    } catch (error) {
      console.error('Error listing spaces:', error);
      throw error;
    }
  }

  /**
   * Get space information
   */
  async getSpace(spaceName: string): Promise<Space> {
    try {
      const headers = await this.auth.getAuthHeaders();
      
      const response = await fetch(
        `${this.baseUrl}/spaces/${spaceName}`,
        {
          headers,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get space: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting space:', error);
      throw error;
    }
  }

  /**
   * List members of a space
   */
  async listSpaceMembers(spaceName: string): Promise<User[]> {
    try {
      const headers = await this.auth.getAuthHeaders();
      
      const response = await fetch(
        `${this.baseUrl}/spaces/${spaceName}/members`,
        {
          headers,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to list members: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const memberships = data.memberships || [];
      return memberships.map((membership: any) => membership.member).filter(Boolean);
    } catch (error) {
      console.error('Error listing space members:', error);
      throw error;
    }
  }

  /**
   * Update a message
   */
  async updateMessage(messageName: string, message: Partial<ChatMessage>): Promise<Message> {
    try {
      const headers = await this.auth.getAuthHeaders();
      
      const response = await fetch(
        `${this.baseUrl}/messages/${messageName}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(message),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to update message: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageName: string): Promise<void> {
    try {
      const headers = await this.auth.getAuthHeaders();
      
      const response = await fetch(
        `${this.baseUrl}/messages/${messageName}`,
        {
          method: 'DELETE',
          headers,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to delete message: ${response.status} ${errorData.error?.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Test the connection to Google Chat API
   */
  async testConnection(): Promise<{ success: boolean; error?: string; spaces?: number }> {
    try {
      const spaces = await this.listSpaces();
      return { 
        success: true, 
        spaces: spaces.length 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Singleton instance
let clientInstance: GoogleChatClient | null = null;

export const getGoogleChatClient = (): GoogleChatClient => {
  if (!clientInstance) {
    clientInstance = new GoogleChatClient();
  }
  return clientInstance;
};

export const clearGoogleChatClient = (): void => {
  clientInstance = null;
};