import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { supabase } from '../supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {

  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B00',
    });
  }

  if (Device.isDevice) {
    const permissionRes = await Notifications.getPermissionsAsync();
    let finalStatus = (permissionRes as any).status;
    if (finalStatus !== 'granted') {
      const requestRes = await Notifications.requestPermissionsAsync();
      finalStatus = (requestRes as any).status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permissions not granted!');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? 'd4824861-c576-4382-91d9-c7ef0f26cf5f';
    
    try {
      const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      token = pushTokenData.data;
      console.log('Expo Push Token retrieved:', token);
    } catch (e) {
      console.warn('Error fetching Expo push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export default function RootLayout() {
  const router = useRouter();
const notificationListener = useRef<Notifications.EventSubscription | null>(null);
const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    async function configureAudio() {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        });
      } catch (err) {
        console.warn('Audio config error:', err);
      }
    }
    configureAudio();

    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        try {
          const { error } = await supabase.from('push_tokens').upsert(
            {
              token,
              platform: Platform.OS,
              notify_live_scores: true,
              notify_gameday_reminders: true,
              notify_events: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'token' }
          );
          if (error) {
            console.warn('Supabase push_tokens upsert error:', error.message);
          } else {
            console.log('Push token successfully synced to Supabase!');
          }
        } catch (tokenErr) {
          console.warn('Error upserting to push_tokens:', tokenErr);
        }
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        router.push(data.screen as any);
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

return (
  <View style={{ flex: 1 }}>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(drawer)" />
      {/* Add more Stack.Screen rows here */}
    </Stack>
  </View>
);
}