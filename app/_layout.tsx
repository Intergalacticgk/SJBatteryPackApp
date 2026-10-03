import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import LiveScoresOptInModal from '../components/LiveScoresOptInModal';

const LIVE_SCORES_PROMPT_KEY = 'liveScoresPromptShown';

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
const [deviceToken, setDeviceToken] = useState<string | null>(null);
const [showLiveScoresPrompt, setShowLiveScoresPrompt] = useState(false);

const handleLiveScoresChoice = async (turnOn: boolean) => {
  setShowLiveScoresPrompt(false);
  await AsyncStorage.setItem(LIVE_SCORES_PROMPT_KEY, '1');
  if (turnOn && deviceToken) {
    const { error } = await supabase
      .from('push_tokens')
      .update({ notify_live_scores: true, updated_at: new Date().toISOString() })
      .eq('token', deviceToken);
    if (error) console.warn('Error enabling live scores:', error.message);
  }
};

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
        setDeviceToken(token);
        try {
          // Only set the notify_* defaults on first INSERT for this token.
          // A plain upsert with onConflict would overwrite the user's saved
          // preferences back to their defaults every time the app restarts
          // or the OS refreshes the push token.
          const { data: existing } = await supabase
            .from('push_tokens')
            .select('token')
            .eq('token', token)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('push_tokens')
              .update({ platform: Platform.OS, updated_at: new Date().toISOString() })
              .eq('token', token);
            if (error) console.warn('Supabase push_tokens update error:', error.message);
          } else {
            const { error } = await supabase.from('push_tokens').insert({
              token,
              platform: Platform.OS,
              // Live Goals & Score Updates default OFF — the user is asked
              // explicitly via the opt-in prompt below. Gameday reminders
              // and events/tabling alerts default ON.
              notify_live_scores: false,
              notify_gameday_reminders: true,
              notify_events: true,
              updated_at: new Date().toISOString(),
            });
            if (error) console.warn('Supabase push_tokens insert error:', error.message);
          }

          const alreadyPrompted = await AsyncStorage.getItem(LIVE_SCORES_PROMPT_KEY);
          if (!alreadyPrompted) {
            setShowLiveScoresPrompt(true);
          }
        } catch (tokenErr) {
          console.warn('Error syncing push_tokens:', tokenErr);
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
    <LiveScoresOptInModal visible={showLiveScoresPrompt} onChoice={handleLiveScoresChoice} />
  </View>
);
}