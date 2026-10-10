import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

export const UPDATE_DISMISSED_KEY = 'updatePromptDismissedVersion';

export interface UpdateInfo {
  latestVersion: string;
  storeUrl: string;
  title: string;
  message: string;
}

// True when a is older than b ("2.1.9" < "2.1.21").
export function isOlderVersion(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

// nativeAppVersion is the version of the installed store binary. expoConfig.version
// can change with an OTA update, so it is only a fallback.
export function getInstalledVersion(): string | null {
  return Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null;
}

// Returns update info only if the installed binary is older than the store's latest
// AND the user has not already dismissed this version. Never throws.
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
    const installed = getInstalledVersion();
    if (!installed) return null;

    const { data, error } = await supabase
      .from('app_update_config')
      .select('latest_version, store_url, title, message')
      .eq('platform', Platform.OS)
      .maybeSingle();
    if (error || !data?.latest_version || !data.store_url) return null;
    if (!isOlderVersion(installed, data.latest_version)) return null;

    const dismissed = await AsyncStorage.getItem(UPDATE_DISMISSED_KEY).catch(() => null);
    if (dismissed === data.latest_version) return null;

    return {
      latestVersion: data.latest_version,
      storeUrl: data.store_url,
      title: data.title,
      message: data.message,
    };
  } catch {
    return null;
  }
}
