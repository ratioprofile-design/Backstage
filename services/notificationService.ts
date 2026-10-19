// ============================================================================
// Backstage Global Notification & Alert Service
// Provides subtle, decent, animated top-right notification cards
// ============================================================================

export type NotificationType = 'success' | 'info' | 'warning' | 'error' | 'cloud' | 'trash';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface NotificationItem {
  id: string;
  title?: string;
  message: string;
  type: NotificationType;
  duration: number; // in milliseconds, 0 = persistent
  timestamp: number;
  action?: NotificationAction;
}

export interface NotifyOptions {
  title?: string;
  type?: NotificationType;
  duration?: number;
  action?: NotificationAction;
}

const NOTIFICATION_EVENT = 'backstage_notification';

/**
 * Infer notification type and clean message from common symbols
 */
function parseNotificationPayload(
  messageOrOptions: string | (NotifyOptions & { message: string }),
  fallbackType: NotificationType = 'info',
  fallbackDuration = 4000
): Omit<NotificationItem, 'id' | 'timestamp'> {
  let rawMessage = '';
  let rawTitle: string | undefined;
  let type: NotificationType = fallbackType;
  let duration = fallbackDuration;
  let action: NotificationAction | undefined;

  if (typeof messageOrOptions === 'string') {
    rawMessage = messageOrOptions;
  } else {
    rawMessage = messageOrOptions.message || '';
    rawTitle = messageOrOptions.title;
    if (messageOrOptions.type) type = messageOrOptions.type;
    if (typeof messageOrOptions.duration === 'number') duration = messageOrOptions.duration;
    if (messageOrOptions.action) action = messageOrOptions.action;
  }

  let cleanMsg = rawMessage.trim();

  // Smart Detection based on leading symbols or keywords if type wasn't explicitly overridden
  if (type === fallbackType) {
    if (
      cleanMsg.startsWith('✓') ||
      cleanMsg.startsWith('✅') ||
      cleanMsg.includes('Saved') ||
      cleanMsg.includes('Downloaded') ||
      cleanMsg.includes('Exported') ||
      cleanMsg.includes('Created') ||
      cleanMsg.includes('Restored')
    ) {
      type = 'success';
      if (!rawTitle) rawTitle = 'Success';
      cleanMsg = cleanMsg.replace(/^[✓✅]\s*/, '');
    } else if (
      cleanMsg.startsWith('🗑️') ||
      cleanMsg.includes('Deleted') ||
      cleanMsg.includes('Permanently deleted')
    ) {
      type = 'trash';
      if (!rawTitle) rawTitle = 'Deleted';
      cleanMsg = cleanMsg.replace(/^🗑️\s*/, '');
    } else if (cleanMsg.startsWith('🗄️') || cleanMsg.includes('Archived')) {
      type = 'info';
      if (!rawTitle) rawTitle = 'Vault Archive';
      cleanMsg = cleanMsg.replace(/^🗄️\s*/, '');
    } else if (
      cleanMsg.startsWith('⚡') ||
      cleanMsg.includes('Cloud Synced') ||
      cleanMsg.includes('Synchronized') ||
      cleanMsg.includes('Connecting to Supabase')
    ) {
      type = 'cloud';
      if (!rawTitle) rawTitle = 'Cloud Sync';
      cleanMsg = cleanMsg.replace(/^[⚡☁️]\s*/, '');
    } else if (
      cleanMsg.startsWith('⚠️') ||
      cleanMsg.includes('Warning') ||
      cleanMsg.includes('Cannot delete') ||
      cleanMsg.includes('Select 2 or more') ||
      cleanMsg.includes('Tip:') ||
      cleanMsg.includes('Notice')
    ) {
      type = 'warning';
      if (!rawTitle) rawTitle = 'Notice';
      cleanMsg = cleanMsg.replace(/^⚠️\s*/, '');
    } else if (
      cleanMsg.startsWith('❌') ||
      cleanMsg.toLowerCase().includes('failed') ||
      cleanMsg.toLowerCase().includes('error')
    ) {
      type = 'error';
      if (!rawTitle) rawTitle = 'Error';
      cleanMsg = cleanMsg.replace(/^[❌]\s*/, '');
    }
  }

  return {
    title: rawTitle,
    message: cleanMsg,
    type,
    duration,
    action,
  };
}

/**
 * Dispatch a notification across the entire application
 */
export function notify(
  messageOrOptions: string | (NotifyOptions & { message: string }),
  type?: NotificationType,
  duration?: number
): string {
  const parsed = parseNotificationPayload(messageOrOptions, type || 'info', duration ?? 4000);
  const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: NotificationItem = {
    id,
    ...parsed,
    timestamp: Date.now(),
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_EVENT, {
        detail: item,
      })
    );
  }

  return id;
}

notify.success = (message: string, title = 'Success', duration = 4000) => {
  return notify({ message, title, type: 'success', duration });
};

notify.info = (message: string, title = 'Info', duration = 4000) => {
  return notify({ message, title, type: 'info', duration });
};

notify.warning = (message: string, title = 'Warning', duration = 5000) => {
  return notify({ message, title, type: 'warning', duration });
};

notify.error = (message: string, title = 'Error', duration = 6000) => {
  return notify({ message, title, type: 'error', duration });
};

notify.cloud = (message: string, title = 'Cloud Sync', duration = 4000) => {
  return notify({ message, title, type: 'cloud', duration });
};

notify.trash = (message: string, title = 'Deleted', duration = 4500) => {
  return notify({ message, title, type: 'trash', duration });
};

export function subscribeToNotifications(callback: (item: NotificationItem) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<NotificationItem>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(NOTIFICATION_EVENT, handler);
  return () => {
    window.removeEventListener(NOTIFICATION_EVENT, handler);
  };
}
