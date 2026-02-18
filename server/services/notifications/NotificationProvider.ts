// server/services/notifications/NotificationProvider.ts
import type { NotificationEventType, NotificationContext } from '../NotificationService';

export interface NotificationRecipient {
  userId: string;
  name: string;
  email: string;
  channelConfig: Record<string, string>;
}

export interface NotificationProvider {
  readonly channel: 'email' | 'slack';

  send(
    recipient: NotificationRecipient,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void>;
}
