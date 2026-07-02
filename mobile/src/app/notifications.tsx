import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export default function NotificationsScreen() {
  const [activeTab, setActiveTab] = useState<'generales' | 'mis_alertas'>('generales');
  const [notificacionesGenerales, setNotificacionesGenerales] = useState<any[]>([]);
  const [misAlertas, setMisAlertas] = useState<any[]>([]);

  useEffect(() => {
    fetchData();

    // Suscripción a nuevos comunicados para lanzar Push y actualizar lista
    const channelName = 'comunicados_public_' + Date.now();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comunicados' }, async (payload) => {
        const nuevo = payload.new;
        setNotificacionesGenerales(prev => [nuevo, ...prev]);
        
        if (Platform.OS !== 'web') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: nuevo.severidad === 'peligro' ? `🚨 ${nuevo.titulo}` : `🔔 ${nuevo.titulo}`,
              body: nuevo.mensaje,
              sound: true,
            },
            trigger: null,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    // 1. Cargar Comunicados Oficiales
    const { data: comunicados } = await supabase
      .from('comunicados')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (comunicados) setNotificacionesGenerales(comunicados);

    // 2. Cargar Mis Alertas Históricas
    const socioId = await AsyncStorage.getItem('socioId');
    if (socioId) {
      const { data: alertas } = await supabase
        .from('alertas')
        .select('*')
        .eq('socio_id', socioId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (alertas) setMisAlertas(alertas);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />
      
      {/* Cabecera */}
      <View style={styles.header}>
        <Text style={styles.title}>Centro de Avisos</Text>
        <Text style={styles.subtitle}>Información oficial del cuartel</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
      </View>

      {/* Pestañas (Tabs) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'generales' && styles.activeTab]}
          onPress={() => setActiveTab('generales')}
        >
          <Text style={[styles.tabText, activeTab === 'generales' && styles.activeTabText]}>Avisos a la Comunidad</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'mis_alertas' && styles.activeTab]}
          onPress={() => setActiveTab('mis_alertas')}
        >
          <Text style={[styles.tabText, activeTab === 'mis_alertas' && styles.activeTabText]}>Mis Alertas</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Notificaciones */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        
        {activeTab === 'generales' && notificacionesGenerales.map(notif => (
          <View key={notif.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardType, notif.severidad === 'peligro' ? styles.textDanger : notif.severidad === 'precaucion' ? styles.textWarning : styles.textInfo]}>
                {notif.severidad === 'peligro' ? '🔴 PELIGRO INMINENTE' : notif.severidad === 'precaucion' ? '🟡 PRECAUCIÓN' : '🔵 INFORMATIVO'}
              </Text>
              <Text style={styles.cardDate}>{new Date(notif.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.cardTitle}>{notif.titulo}</Text>
            <Text style={styles.cardDetail}>{notif.mensaje}</Text>
            {notif.lat && notif.lng && (
              <TouchableOpacity 
                style={styles.locationBtn}
                onPress={() => {
                  const lat = notif.lat;
                  const lng = notif.lng;
                  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
                  const latLng = `${lat},${lng}`;
                  const label = 'Ubicación del Incidente';
                  const url = Platform.select({
                    ios: `${scheme}${label}@${latLng}`,
                    android: `${scheme}${latLng}(${label})`,
                    web: `https://www.google.com/maps/search/?api=1&query=${latLng}`
                  });
                  Linking.openURL(url as string);
                }}
              >
                <Text style={styles.locationBtnText}>📍 Ver Ubicación del Incidente</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {activeTab === 'mis_alertas' && misAlertas.map(alerta => (
          <View key={alerta.id} style={styles.card}>
             <View style={styles.cardHeader}>
              <Text style={styles.textWarning}>TÚ REPORTASTE</Text>
              <Text style={styles.cardDate}>{new Date(alerta.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.cardTitle}>EMERGENCIA: {alerta.tipo.toUpperCase()}</Text>
            <Text style={styles.cardDetail}>Ubicación enviada: {alerta.lat.toFixed(4)}, {alerta.lng.toFixed(4)}</Text>
            <View style={[styles.statusBadge, alerta.estado === 'Cerrado' && { backgroundColor: 'rgba(100,116,139,0.2)', borderColor: 'rgba(100,116,139,0.5)' }]}>
              <Text style={[styles.statusBadgeText, alerta.estado === 'Cerrado' && { color: '#94a3b8' }]}>
                ESTADO: {alerta.estado.toUpperCase()}
              </Text>
            </View>
          </View>
        ))}

        {(activeTab === 'generales' && notificacionesGenerales.length === 0) || 
         (activeTab === 'mis_alertas' && misAlertas.length === 0) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No hay novedades por aquí.</Text>
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: Platform.OS === 'web' ? 40 : 80,
    paddingBottom: 20,
    alignItems: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'web' ? 40 : 80,
    padding: 10,
  },
  backButtonText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#38bdf8',
  },
  tabText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#38bdf8',
  },
  listContainer: {
    padding: 20,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardType: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  textDanger: { color: '#ef4444' },
  textInfo: { color: '#3b82f6' },
  textWarning: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  cardDate: {
    color: '#64748b',
    fontSize: 12,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardDetail: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  locationBtn: {
    marginTop: 15,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  locationBtnText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusBadge: {
    marginTop: 15,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    marginTop: 50,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 16,
  },
});
