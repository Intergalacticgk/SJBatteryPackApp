import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { getActiveChatRoom } from '../utils/chatPresence';
import UpdateAvailableModal from '../components/UpdateAvailableModal';
import { checkForUpdate, UPDATE_DISMISSED_KEY, UpdateInfo } from '../utils/updateCheck';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Don't banner a chat message for the room the user is already reading.
    const data: any = notification.request.content.data;
    const viewingThisRoom = !!data?.roomId && data.roomId === getActiveChatRoom();
    return {
      shouldShowAlert: !viewingThisRoom,
      shouldPlaySound: !viewingThisRoom,
      shouldSetBadge: false,
      shouldShowBanner: !viewingThisRoom,
      shouldShowList: true,
    };
  },
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
const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Soft "new version available" prompt: checked on launch and whenever the app returns to the foreground.
  useEffect(() => {
    const run = async () => {
      const info = await checkForUpdate();
      if (info) setUpdateInfo(info);
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, []);

  const dismissUpdate = async () => {
    const v = updateInfo?.latestVersion;
    setUpdateInfo(null);
    if (v) await AsyncStorage.setItem(UPDATE_DISMISSED_KEY, v).catch(() => {});
  };

  const openStore = async () => {
    const url = updateInfo?.storeUrl;
    await dismissUpdate();
    if (url) Linking.openURL(url).catch((e) => console.warn('Could not open store:', e));
  };

  // Link this device's push token to the signed-in user so chat notifications
  // skip the sender's own device. Cleared on sign-out.
  useEffect(() => {
    if (!deviceToken) return;
    const link = async (userId: string | null) => {
      const { error } = await supabase
        .from('push_tokens')
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('token', deviceToken);
      if (error) console.warn('Error linking push token to user:', error.message);
    };
    supabase.auth.getSession().then(({ data: { session } }) => link(session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      link(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [deviceToken]);

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
              // explicitly via the opt-in prompt on the Schedule tab. Gameday reminders
              // and events/tabling alerts default ON.
              notify_live_scores: false,
              notify_gameday_reminders: true,
              notify_events: true,
              // Chat notifications are opt-in; the chat screen asks once.
              notify_chat_general: false,
              notify_chat_watch_parties: false,
              notify_chat_merch: false,
              notify_chat_sharks: false,
              updated_at: new Date().toISOString(),
            });
            if (error) console.warn('Supabase push_tokens insert error:', error.message);
          }
        } catch (tokenErr) {
          console.warn('Error syncing push_tokens:', tokenErr);
        }
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        if (data?.roomId) {
          router.push({ pathname: data.screen as any, params: { roomId: String(data.roomId) } });
        } else {
          router.push(data.screen as any);
        }
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
    <UpdateAvailableModal
      visible={!!updateInfo}
      title={updateInfo?.title ?? ''}
      message={updateInfo?.message ?? ''}
      latestVersion={updateInfo?.latestVersion ?? ''}
      onUpdate={openStore}
      onLater={dismissUpdate}
    />
  </View>
);
}