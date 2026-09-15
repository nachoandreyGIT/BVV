import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router, ErrorBoundaryProps } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>¡Ups! Algo salió mal</Text>
      <Text style={styles.errorText}>
        La aplicación encontró un error inesperado. Por favor toma una captura de pantalla y envíala a soporte.
      </Text>
      <Text style={styles.errorDetails}>{props.error.message}</Text>
      <Text style={styles.retryText} onPress={props.retry}>Toca aquí para intentar de nuevo</Text>
    </View>
  );
}

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

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    color: '#FF4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorDetails: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryText: {
    color: '#208AEF',
    fontSize: 18,
    fontWeight: 'bold',
    padding: 12,
  }
});
