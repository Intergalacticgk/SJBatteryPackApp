// 🚀 REQUIRED FOR REACT NATIVE: Adds URL parsing so Supabase doesn't crash on startup!
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

const supabaseUrl = 'https://esagmbctmupjijkcexht.supabase.co';
const supabaseAnonKey = 'sb_publishable_6j3l7UH0gZhTP3WRbnjzTQ_ptN55BxS';

// 🛡️ SSR-Safe Storage Adapter (Prevents 'window is not defined' during static export)
const ExpoCustomStorage = {
  getItem: async (key) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return null;
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoCustomStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auto-refresh token when app returns to foreground
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

// 🏒 PROSPECT HUB DATA FETCHING
export const fetchProspectTrackerData = async () => {
  try {
    const { data, error } = await supabase
      .from('prospects')
      .select(`
        id,
        name,
        jersey_number,
        position,
        height,
        weight,
        shoots_catches,
        current_team,
        league,
        acquired,
        image_url,
        prospect_stats (
          games_played,
          goals,
          assists,
          points,
          pim
        )
      `);

    if (error) {
      console.error('Error querying Supabase pipeline tables:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected database execution failure:', err);
    return null;
  }
};