import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  KeyboardAvoidingView,
  Linking,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaymentScreen() {
  const [showDonationSection, setShowDonationSection] = useState(false);
  const [donationAmount, setDonationAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const goToHomeFree = () => {
    router.replace('/');
  };

  const handleSubscription = async () => {
    setIsProcessing(true);
    try {
      const socioId = await AsyncStorage.getItem('socioId');
      const baseUrl = 'https://bomberos-veronica.vercel.app';
      
      const res = await fetch(`${baseUrl}/api/mercadopago/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: socioId || 0,
          monto: 2000,
          tipo: 'cuota',
          meses: ['Cuota-Alta']
        })
      });
      const data = await res.json();
      if (data.url) {
        Linking.openURL(data.url);
      } else {
        Linking.openURL('https://www.mercadopago.com.ar');
      }
    } catch (e) {
      Linking.openURL('https://www.mercadopago.com.ar');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDonation = async () => {
    if (!donationAmount || isNaN(Number(donationAmount)) || Number(donationAmount) <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }
    setIsProcessing(true);
    try {
      const socioId = await AsyncStorage.getItem('socioId');
      const baseUrl = 'https://bomberos-veronica.vercel.app';
      
      const res = await fetch(`${baseUrl}/api/mercadopago/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: socioId || 0,
          monto: Number(donationAmount),
          tipo: 'donacion'
        })
      });
      const data = await res.json();
      if (data.url) {
        Linking.openURL(data.url);
      } else {
        Linking.openURL('https://www.mercadopago.com.ar');
      }
    } catch (e) {
      Linking.openURL('https://www.mercadopago.com.ar');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Cabecera de Bienvenida */}
        <View style={styles.header}>
          <View style={styles.badgeSuccess}>
            <Text style={styles.badgeSuccessText}>✓ REGISTRO COMPLETADO</Text>
          </View>
          <Text style={styles.title}>¡Bienvenido a Bomberos Verónica!</Text>
          <Text style={styles.subtitle}>
            Tu cuenta comunitaria está activa. Te explicamos cómo funciona el servicio y cómo podés colaborar.
          </Text>
        </View>

        {/* Cuadro de Gratuidad y Garantía de Auxilio (Clave para Google Play y Vecinos) */}
        <View style={styles.freeGuaranteeCard}>
          <LinearGradient 
            colors={['rgba(16, 185, 129, 0.15)', 'rgba(5, 150, 105, 0.05)']} 
            style={StyleSheet.absoluteFill} 
          />
          <View style={styles.guaranteeHeader}>
            <Text style={styles.guaranteeIcon}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.guaranteeTitle}>Servicio 100% Gratuito y Público</Text>
              <Text style={styles.guaranteeSubtitle}>Garantizado para toda la comunidad</Text>
            </View>
          </View>
          <Text style={styles.guaranteeBody}>
            El uso de esta aplicación y la asistencia ante emergencias (incendios, siniestros viales y rescates) son un bien público sin costo alguno las 24 horas.
            {'\n\n'}
            <Text style={{ fontWeight: 'bold', color: '#6ee7b7' }}>
              No se requiere ningún pago ni membresía para recibir el auxilio inmediato del cuartel.
            </Text>
          </Text>

          {/* Botón Principal Destacado: Usar Gratis */}
          <TouchableOpacity 
            style={styles.primaryFreeButton} 
            onPress={goToHomeFree}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#10b981', '#059669']} style={styles.primaryFreeGradient}>
              <Text style={styles.primaryFreeButtonText}>COMENZAR A USAR LA APP (GRATIS)</Text>
              <Text style={styles.primaryFreeButtonSubtext}>Ir a la pantalla de Ayuda y SOS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Pasarela Informativa: ¿Cómo funciona la App? */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionHeaderTitle}>📲 FUNCIONALIDADES DE LA APP</Text>
          
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🚨</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Botón Central de Ayuda</Text>
              <Text style={styles.featureDesc}>
                Mantén presionado el botón de alerta ante una urgencia real. El cuartel recibirá tu posición GPS precisa y tus datos al instante.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🔔</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Avisos a la Comunidad</Text>
              <Text style={styles.featureDesc}>
                Recibirás notificaciones oficiales sobre prevención climática, cortes de vías y situaciones de siniestros en la zona.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>📍</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Ficha de Logística</Text>
              <Text style={styles.featureDesc}>
                La dirección y descripción de vivienda cargadas guían a las dotaciones de bomberos para llegar directamente sin demoras.
              </Text>
            </View>
          </View>
        </View>

        {/* Cuadro de Aporte Comunitario Voluntario (Asociarse) */}
        <View style={styles.donationToggleCard}>
          <Text style={styles.donationToggleTitle}>🤝 Apoyo Solidario al Cuartel (Opcional)</Text>
          <Text style={styles.donationToggleDesc}>
            Bomberos Voluntarios es una entidad sin fines de lucro. Los vecinos que lo deseen pueden asociarse aportando una cuota social mensual voluntaria para ayudar con el combustible de las autobombas y el equipamiento de protección.
          </Text>

          {!showDonationSection ? (
            <TouchableOpacity 
              style={styles.showDonationButton} 
              onPress={() => setShowDonationSection(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.showDonationButtonText}>💳 Quiero colaborar o asociarme con MercadoPago</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.donationOptionsContainer}>
              
              {/* Opción 1: Cuota Mensual */}
              <View style={styles.optionBox}>
                <Text style={styles.optionBoxTitle}>Cuota Social Mensual</Text>
                <Text style={styles.optionBoxDesc}>
                  Aporte mensual automático con cualquier tarjeta. Podés pausar o cancelar cuando quieras.
                </Text>
                <Text style={styles.priceBadge}>Valor sugerido: $2.000 / mes</Text>
                <TouchableOpacity 
                  style={styles.mpButton} 
                  onPress={handleSubscription}
                  disabled={isProcessing}
                >
                  <Text style={styles.mpButtonText}>
                    {isProcessing ? 'Conectando...' : 'Suscribirse con MercadoPago'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.orDividerText}>— O —</Text>

              {/* Opción 2: Donación Única */}
              <View style={styles.optionBox}>
                <Text style={styles.optionBoxTitle}>Donación Única Libre</Text>
                <Text style={styles.optionBoxDesc}>
                  Ingresá el monto con el que deseás colaborar por única vez.
                </Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Monto a donar"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={donationAmount}
                    onChangeText={setDonationAmount}
                  />
                </View>

                <TouchableOpacity 
                  style={styles.mpOutlineButton} 
                  onPress={handleDonation}
                  disabled={isProcessing}
                >
                  <Text style={styles.mpOutlineButtonText}>
                    {isProcessing ? 'Conectando...' : 'Donar con MercadoPago'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.hideDonationButton} 
                onPress={() => setShowDonationSection(false)}
              >
                <Text style={styles.hideDonationButtonText}>Ocultar opciones de pago</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Botón Inferior de Cierre */}
        <TouchableOpacity style={styles.bottomFreeLink} onPress={goToHomeFree}>
          <Text style={styles.bottomFreeLinkText}>← Continuar a la pantalla principal sin pagar</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 40 : 70,
    paddingBottom: 60,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
    maxWidth: 550,
    width: '100%',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgeSuccessText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Cuadro de Gratuidad
  freeGuaranteeCard: {
    width: '100%',
    maxWidth: 550,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    overflow: 'hidden',
    marginBottom: 30,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  guaranteeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  guaranteeIcon: {
    fontSize: 34,
    marginRight: 14,
  },
  guaranteeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  guaranteeSubtitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  guaranteeBody: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  primaryFreeButton: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  primaryFreeGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryFreeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  primaryFreeButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 3,
    textAlign: 'center',
  },

  // Pasarela Informativa
  infoSection: {
    width: '100%',
    maxWidth: 550,
    marginBottom: 30,
  },
  sectionHeaderTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 14,
    paddingLeft: 4,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  featureIcon: {
    fontSize: 26,
    marginRight: 14,
    marginTop: 2,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  featureDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },

  // Sección de Donación / Cuota
  donationToggleCard: {
    width: '100%',
    maxWidth: 550,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  donationToggleTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  donationToggleDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  showDonationButton: {
    backgroundColor: 'rgba(0, 158, 227, 0.15)',
    borderWidth: 1.5,
    borderColor: '#009EE3',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  showDonationButtonText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  donationOptionsContainer: {
    marginTop: 10,
  },
  optionBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  optionBoxTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  optionBoxDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  priceBadge: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 14,
  },
  mpButton: {
    backgroundColor: '#009EE3',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  mpButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  orDividerText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    width: '100%',
    marginBottom: 14,
    paddingHorizontal: 15,
  },
  currencySymbol: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    paddingVertical: 12,
  },
  mpOutlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#009EE3',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  mpOutlineButtonText: {
    color: '#009EE3',
    fontSize: 15,
    fontWeight: 'bold',
  },
  hideDonationButton: {
    marginTop: 15,
    alignItems: 'center',
    padding: 8,
  },
  hideDonationButtonText: {
    color: '#64748b',
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  // Link inferior
  bottomFreeLink: {
    marginTop: 15,
    padding: 12,
    alignItems: 'center',
  },
  bottomFreeLinkText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
