import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const socioId = await AsyncStorage.getItem('socioId');
        const inAuthScreen = segments[0] === 'register';

        if (!socioId && !inAuthScreen) {
          // Si no hay usuario y no estoy en la pantalla de registro -> al registro
          router.replace('/register');
        } else if (socioId && inAuthScreen) {
          // Si hay usuario y estoy en la pantalla de registro -> al inicio
          router.replace('/');
        }
      } catch (error) {
        console.error('Error verificando sesión:', error);
      } finally {
        setIsReady(true);
      }
    };
    
    // Solo verificar cuando cambian los segmentos de la ruta
    checkAuth();
  }, [segments]);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
