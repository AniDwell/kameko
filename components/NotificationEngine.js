import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { DeviceEventEmitter } from 'react-native';

// 1. Create the invisible background channel required by Android
export async function setupNotificationChannel() {
  return await notifee.createChannel({
    id: 'hls_downloads',
    name: 'Offline Video Downloads',
    importance: AndroidImportance.LOW, // Low importance = silent progress bar without annoying popups
  });
}

// 2. Render the Live Progress Bar
export async function showProgressNotification(notifId, title, percent) {
  const channelId = await setupNotificationChannel();

  await notifee.displayNotification({
    id: notifId, // Keeping the same ID overwrites the existing notification instead of making a new one
    title: `Downloading: ${title}`,
    body: `${percent}% complete...`,
    android: {
      channelId,
      onlyAlertOnce: true, // Prevents vibrating on every 1% update
      ongoing: true, // Makes it un-swipeable while downloading
      autoCancel: false,
      progress: {
        max: 100,
        current: percent,
      },
      actions: [
        {
          title: '❌ Cancel',
          pressAction: { id: 'cancel_dl' },
        }
      ]
    },
  });
}

// 3. Render Completion State
export async function showCompletionNotification(notifId, title) {
  const channelId = await setupNotificationChannel();

  await notifee.displayNotification({
    id: notifId,
    title: 'Download Complete ✅',
    body: `${title} is ready to watch offline.`,
    android: {
      channelId,
      ongoing: false, // User can now swipe it away
      autoCancel: true,
    },
  });
}

// 4. Render Error State
export async function showErrorNotification(notifId, title) {
  const channelId = await setupNotificationChannel();

  await notifee.displayNotification({
    id: notifId,
    title: 'Download Failed ❌',
    body: `Could not finish saving ${title}.`,
    android: {
      channelId,
      ongoing: false,
      autoCancel: true,
    },
  });
}

// 5. Dismiss Notification entirely
export async function clearNotification(notifId) {
  await notifee.cancelNotification(notifId);
}

// 6. Global Event Listener for Native Buttons
export function registerNotificationListener() {
  // Handles clicks when app is open
  notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction.id === 'cancel_dl') {
      DeviceEventEmitter.emit('CANCEL_DOWNLOAD', detail.notification.id);
    }
  });

  // Handles clicks when app is closed/in background
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction.id === 'cancel_dl') {
      DeviceEventEmitter.emit('CANCEL_DOWNLOAD', detail.notification.id);
    }
  });
}
