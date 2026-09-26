import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../supabase';

// 1. Tell the app how to present alerts if received while the app is actively open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 2. Request permissions and upload token to Supabase
export async function registerForPushNotificationsAsync() {
  // Push notifications only work on real physical hardware (iOS/Android)
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  // Set up Android notification channels (Required for Android 8.0+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00788C',
    });
  }

  // Check existing permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Prompt the user if permission hasn't been granted yet
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token permission');
    return null;
  }

  try {
    // Fetch the Expo push token using your EAS project ID
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: 'd4824861-c576-4382-91d9-c7ef0f26cf5f',
    });

    const pushToken = tokenResponse.data;

    if (pushToken) {
      // Upsert into Supabase so we never store duplicates
      await supabase.from('push_tokens').upsert(
        {
          token: pushToken,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );
    }

    return pushToken;
  } catch (error) {
    console.warn('Error fetching or storing push token:', error);
    return null;
  }
}