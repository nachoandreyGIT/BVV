import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ngtghxjllqaelsiekyys.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_E_mADN0IBnA4xucfnst3_Q_8pjl4GKa';

// Adaptador personalizado para evitar el error "window is not defined" 
// al compilar Expo para la Web (que utiliza renderizado en servidor - SSR).
const ExpoStorage = {
  getItem: (key: string) => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
      }
      return AsyncStorage.getItem(key);
    } catch (e) {
      console.warn("Error leyendo AsyncStorage:", e);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      return AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn("Error guardando en AsyncStorage:", e);
    }
  },
  removeItem: (key: string) => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
        return;
      }
      return AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn("Error borrando de AsyncStorage:", e);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
