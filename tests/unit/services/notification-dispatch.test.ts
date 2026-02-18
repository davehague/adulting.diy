import { describe, it, expect } from 'vitest';
import { NotificationService } from '@/server/services/NotificationService';
import type { NotificationPreferences } from '@/types/notification';
import { defaultNotificationPreferences } from '@/types/notification';

describe('getEnabledProviders', () => {
  const service = new NotificationService();

  // Access private method via any cast for testing
  const getProviders = (prefs: NotificationPreferences) =>
    (service as any).getEnabledProviders(prefs);

  it('returns only EmailProvider when channels.slack is false', () => {
    const prefs: NotificationPreferences = {
      ...defaultNotificationPreferences,
      channels: { email: true, slack: false },
      channelConfig: {},
    };
    const providers = getProviders(prefs);
    expect(providers).toHaveLength(1);
    expect(providers[0].channel).toBe('email');
  });

  it('returns both providers when slack is enabled with webhook URL', () => {
    const prefs: NotificationPreferences = {
      ...defaultNotificationPreferences,
      channels: { email: true, slack: true },
      channelConfig: { slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
    };
    const providers = getProviders(prefs);
    expect(providers).toHaveLength(2);
    expect(providers.map((p: any) => p.channel).sort()).toEqual(['email', 'slack']);
  });

  it('skips slack when enabled but no webhook URL', () => {
    const prefs: NotificationPreferences = {
      ...defaultNotificationPreferences,
      channels: { email: true, slack: true },
      channelConfig: {},
    };
    const providers = getProviders(prefs);
    expect(providers).toHaveLength(1);
    expect(providers[0].channel).toBe('email');
  });

  it('returns only SlackProvider when email is disabled', () => {
    const prefs: NotificationPreferences = {
      ...defaultNotificationPreferences,
      channels: { email: false, slack: true },
      channelConfig: { slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
    };
    const providers = getProviders(prefs);
    expect(providers).toHaveLength(1);
    expect(providers[0].channel).toBe('slack');
  });

  it('defaults to email-only when channels field is missing (backward compat)', () => {
    const legacyPrefs = { ...defaultNotificationPreferences } as any;
    delete legacyPrefs.channels;
    delete legacyPrefs.channelConfig;
    const providers = getProviders(legacyPrefs);
    expect(providers).toHaveLength(1);
    expect(providers[0].channel).toBe('email');
  });
});
