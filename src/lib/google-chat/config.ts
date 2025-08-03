import { z } from 'zod';

export const GoogleChatConfigSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  serviceAccountKeyPath: z.string().optional(),
  serviceAccountKey: z.string().optional(),
  webhookUrl: z.string().url('Valid webhook URL is required'),
  botToken: z.string().min(1, 'Bot token is required'),
  defaultSpace: z.string().optional(),
});

export type GoogleChatConfig = z.infer<typeof GoogleChatConfigSchema>;

export interface ChatMessage {
  text: string;
  thread?: {
    name: string;
  };
  cards?: ChatCard[];
  actionResponse?: {
    type: 'DIALOG' | 'UPDATE_MESSAGE' | 'NEW_MESSAGE';
    dialogAction?: {
      dialog: {
        body: {
          sections: ChatSection[];
        };
      };
    };
  };
}

export interface ChatCard {
  header?: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    imageType?: 'CIRCLE' | 'SQUARE';
  };
  sections: ChatSection[];
}

export interface ChatSection {
  header?: string;
  widgets: ChatWidget[];
}

export interface ChatWidget {
  textParagraph?: {
    text: string;
  };
  keyValue?: {
    topLabel: string;
    content: string;
    contentMultiline?: boolean;
    bottomLabel?: string;
    icon?: string;
    button?: ChatButton;
  };
  image?: {
    imageUrl: string;
    onClick?: {
      openLink?: {
        url: string;
      };
    };
  };
  buttons?: ChatButton[];
  divider?: {};
}

export interface ChatButton {
  textButton: {
    text: string;
    onClick: {
      action?: {
        actionMethodName: string;
        parameters?: Array<{
          key: string;
          value: string;
        }>;
      };
      openLink?: {
        url: string;
      };
    };
  };
}

export interface ChatEvent {
  type: 'ADDED_TO_SPACE' | 'REMOVED_FROM_SPACE' | 'MESSAGE' | 'CARD_CLICKED';
  eventTime: string;
  message?: {
    name: string;
    sender: {
      name: string;
      displayName: string;
      email: string;
      type: 'HUMAN' | 'BOT';
    };
    text: string;
    thread: {
      name: string;
    };
    space: {
      name: string;
      type: 'ROOM' | 'DM';
      displayName?: string;
    };
    argumentText?: string;
    annotations?: Array<{
      type: 'USER_MENTION' | 'SLASH_COMMAND';
      startIndex: number;
      length: number;
      slashCommand?: {
        commandId: string;
      };
      userMention?: {
        user: {
          name: string;
          displayName: string;
        };
        type: 'ADD' | 'MENTION';
      };
    }>;
  };
  action?: {
    actionMethodName: string;
    parameters?: Array<{
      key: string;
      value: string;
    }>;
  };
  space?: {
    name: string;
    type: 'ROOM' | 'DM';
    displayName?: string;
  };
  user?: {
    name: string;
    displayName: string;
    email: string;
    type: 'HUMAN' | 'BOT';
  };
}

export const GOOGLE_CHAT_SCOPES = [
  'https://www.googleapis.com/auth/chat.bot',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.spaces',
];

export const getGoogleChatConfig = (): GoogleChatConfig => {
  const config = {
    projectId: process.env.GOOGLE_CHAT_PROJECT_ID || '',
    serviceAccountKeyPath: process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_KEY_PATH,
    serviceAccountKey: process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_KEY,
    webhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL || '',
    botToken: process.env.GOOGLE_CHAT_BOT_TOKEN || '',
    defaultSpace: process.env.GOOGLE_CHAT_DEFAULT_SPACE,
  };

  try {
    return GoogleChatConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingFields = error.errors.map(e => e.path.join('.')).join(', ');
      throw new Error(`Google Chat configuration error: ${missingFields}`);
    }
    throw error;
  }
};

export const validateChatConfig = (): { isValid: boolean; errors: string[] } => {
  try {
    getGoogleChatConfig();
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof Error) {
      return { isValid: false, errors: [error.message] };
    }
    return { isValid: false, errors: ['Unknown configuration error'] };
  }
};