import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    // Escondemos el splash después de que se monte el layout
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (
      lastNotificationResponse &&
      lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const url = lastNotificationResponse.notification.request.content.data?.url as string | undefined;
      if (url) {
        // Redirigimos a la url si viene en la notificacion (ej: '/notifications')
        setTimeout(() => {
          router.push(url as any);
        }, 500);
      }
    }
  }, [lastNotificationResponse]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
