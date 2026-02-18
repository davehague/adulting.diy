import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackProvider } from '@/server/services/notifications/SlackProvider';
import type { NotificationRecipient } from '@/server/services/notifications/NotificationProvider';
import type { NotificationContext } from '@/server/services/NotificationService';

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

const recipient: NotificationRecipient = {
  userId: 'user-1',
  name: 'Alice',
  email: 'alice@test.com',
  channelConfig: { slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
};

const baseContext: NotificationContext = {
  user: { id: 'user-1', name: 'Alice', email: 'alice@test.com' } as any,
  task: { id: 't1', name: 'Clean Kitchen', description: 'Wipe counters', category: { name: 'Cleaning' } } as any,
  occurrence: { id: 'o1', dueDate: new Date('2026-03-01'), assigneeIds: ['user-1'] } as any,
  actionUser: { id: 'user-2', name: 'Bob' } as any,
  household: { id: 'h1', name: 'Test House' },
};

describe('SlackProvider', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('has channel "slack"', () => {
    const provider = new SlackProvider();
    expect(provider.channel).toBe('slack');
  });

  it('sends POST to the webhook URL', async () => {
    const provider = new SlackProvider();
    await provider.send(recipient, 'task_created', baseContext);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/xxx',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('includes task name in the payload', async () => {
    const provider = new SlackProvider();
    await provider.send(recipient, 'task_created', baseContext);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const text = JSON.stringify(body.blocks);
    expect(text).toContain('Clean Kitchen');
  });

  it('includes a View link for occurrence events', async () => {
    const provider = new SlackProvider();
    await provider.send(recipient, 'occurrence_assigned', baseContext);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const text = JSON.stringify(body.blocks);
    expect(text).toContain('/occurrences/o1');
  });

  it('throws when webhook URL is missing', async () => {
    const provider = new SlackProvider();
    const noWebhook = { ...recipient, channelConfig: {} };

    await expect(provider.send(noWebhook, 'task_created', baseContext))
      .rejects.toThrow('Slack webhook URL not configured');
  });

  it('throws when Slack API returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
    const provider = new SlackProvider();

    await expect(provider.send(recipient, 'task_created', baseContext))
      .rejects.toThrow('Slack webhook failed');
  });

  it('formats task_reminder with overdue info when timing is after', async () => {
    const provider = new SlackProvider();
    const overdueContext = {
      ...baseContext,
      reminderEntry: { days: 3, timing: 'after' as const },
    };
    await provider.send(recipient, 'task_reminder', overdueContext);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const text = JSON.stringify(body.blocks);
    expect(text).toContain('Overdue');
    expect(text).toContain('Clean Kitchen');
  });

  it('handles context with no occurrence gracefully', async () => {
    const provider = new SlackProvider();
    const noOccContext = { ...baseContext, occurrence: undefined };
    await provider.send(recipient, 'task_created', noOccContext);

    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
