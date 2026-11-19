import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Linking, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CuentaScreen() {
  const [loading, setLoading] = useState(true);
  const [socio, setSocio] = useState<any>(null);
  const [cuotaValor, setCuotaValor] = useState(1500);
  const [esSocioAportante, setEsSocioAportante] = useState(false);
  const [mesesDeuda, setMesesDeuda] = useState(0);
  const [deudaTotal, setDeudaTotal] = useState(0);

  const [donationAmount, setDonationAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSubscribeConfirm, setShowSubscribeConfirm] = useState(false);
  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false);

  useEffect(() => {
    cargarEstadoCuenta();
  }, []);

  const cargarEstadoCuenta = async () => {
    try {
      const socioId = await AsyncStorage.getItem('socioId');
      if (!socioId) {
        router.replace('/register');
        return;
      }

      // 1. Obtener Socio
      const { data: socioData } = await supabase.from('socios').select('*').eq('id', socioId).single();
      setSocio(socioData);

      // 2. Obtener Valor Cuota
      const { data: config } = await supabase.from('configuraciones').select('valor').eq('clave', 'cuota_mensual').single();
      const cuota = config ? Number(config.valor) : 1500;
      setCuotaValor(cuota);

      // 3. Verificar si el vecino está adherido voluntariamente a cuota mensual
      const aportante = Boolean(socioData?.es_socio_aportante);
      setEsSocioAportante(aportante);

      if (!aportante) {
        // Vecino con cuenta comunitaria gratuita: nunca se le calcula deuda
        setMesesDeuda(0);
        setDeudaTotal(0);
        return;
      }

      // 4. Calcular Meses Transcurridos desde la fecha de adhesión a la cuota (no desde el alta en la app)
      const fechaBase = socioData?.fecha_adhesion_socio
        ? new Date(socioData.fecha_adhesion_socio)
        : new Date(socioData.created_at);
      const hoy = new Date();
      const diffAños = hoy.getFullYear() - fechaBase.getFullYear();
      const diffMeses = hoy.getMonth() - fechaBase.getMonth();
      const totalMesesHistoricos = Math.max(1, diffAños * 12 + diffMeses + 1);

      // 5. Obtener Pagos Aprobados / Perdonados
      const { data: pagos } = await supabase
        .from('pagos')
        .select('*')
        .eq('socio_id', socioId)
        .eq('tipo', 'cuota')
        .in('estado', ['aprobado', 'perdonado']);

      const mesesPagados = pagos ? pagos.length : 0;
      let deudaCount = totalMesesHistoricos - mesesPagados;
      if (deudaCount < 0) deudaCount = 0;

      setMesesDeuda(deudaCount);
      setDeudaTotal(deudaCount * cuota);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAsociarse = async () => {
    if (!socio) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('socios')
        .update({
          es_socio_aportante: true,
          fecha_adhesion_socio: new Date().toISOString(),
        })
        .eq('id', socio.id);

      if (error) {
        console.error('Error al asociarse:', error);
        alert('No se pudo registrar la adhesión en este momento. Intenta nuevamente más tarde.');
        return;
      }

      setShowSubscribeConfirm(false);
      await cargarEstadoCuenta();
      alert('¡Gracias por sumarte como Socio Aportante de Bomberos Voluntarios de Verónica!');
    } catch (error) {
      console.error(error);
      alert('Error de conexión.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmBajaCuota = async () => {
    if (!socio) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('socios')
        .update({
          es_socio_aportante: false,
          fecha_adhesion_socio: null,
        })
        .eq('id', socio.id);

      if (error) {
        console.error('Error al dar de baja cuota:', error);
        alert('No se pudo actualizar tu preferencia en este momento.');
        return;
      }

      setShowUnsubscribeConfirm(false);
      await cargarEstadoCuenta();
      alert('Se dio de baja tu adhesión a la cuota mensual. Tu cuenta comunitaria de emergencias continúa 100% activa y gratuita.');
    } catch (error) {
      console.error(error);
      alert('Error de conexión.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePagarDeuda = async () => {
    if (!esSocioAportante || mesesDeuda === 0) return;
    setIsProcessing(true);

    // Calcular qué meses faltan (Ej: simplificamos mandando la cantidad de meses y monto total)
    const meses = Array.from({ length: mesesDeuda }).map((_, i) => `Cuota-${i}`);

    try {
      const baseUrl = 'https://bomberos-veronica.vercel.app';
      const res = await fetch(`${baseUrl}/api/mercadopago/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: socio.id,
          monto: deudaTotal,
          tipo: 'cuota',
          meses: meses,
        }),
      });
      const data = await res.json();
      if (data.url) {
        Linking.openURL(data.url); // Abre MercadoPago
      } else {
        alert('Error al conectar con MercadoPago');
      }
    } catch (error) {
      alert('Error de conexión.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDonacion = async () => {
    if (!donationAmount || Number(donationAmount) <= 0) return;
    setIsProcessing(true);
    try {
      const baseUrl = 'https://bomberos-veronica.vercel.app';
      const res = await fetch(`${baseUrl}/api/mercadopago/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: socio.id,
          monto: Number(donationAmount),
          tipo: 'donacion',
        }),
      });
      const data = await res.json();
      if (data.url) {
        Linking.openURL(data.url);
        setDonationAmount('');
      }
    } catch (error) {
      alert('Error de conexión.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View style={styles.headerTopBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{Platform.OS === 'ios' ? 'Estado de Socio' : 'Mi Cuenta'}</Text>
        <Text style={styles.subtitle}>Bomberos Voluntarios de Verónica</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Estado según si el vecino se adhirió voluntariamente a cuota mensual o usa la cuenta gratuita */}
        {!esSocioAportante ? (
          <>
            <View style={styles.freeAccountCard}>
              <Text style={styles.freeAccountTitle}>🛡️ Cuenta Comunitaria Gratuita</Text>
              <Text style={styles.freeAccountText}>
                Tu acceso a la aplicación, el botón de emergencias SOS y los avisos oficiales son 100% gratuitos las 24 hs. No tienes ninguna cuota mensual asociada ni deudas pendientes.
              </Text>
            </View>

            {Platform.OS !== 'ios' && (
              <View style={[styles.card, { marginBottom: 20 }]}>
                <Text style={styles.cardTitle}>🤝 ¿Querés asociarte al Cuartel?</Text>
                <Text style={styles.cardDescription}>
                  Si lo deseás, podés adherirte de forma totalmente voluntaria a la cuota social mensual (${cuotaValor}/mes) para colaborar con el mantenimiento de autobombas y equipamiento. Podés darte de baja en cualquier momento.
                </Text>

                {!showSubscribeConfirm ? (
                  <TouchableOpacity
                    style={styles.subscribeOutlineButton}
                    onPress={() => setShowSubscribeConfirm(true)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.subscribeOutlineButtonText}>
                      Asociarme con Cuota Mensual (${cuotaValor}/mes)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmTitle}>Confirmar adhesión voluntaria</Text>
                    <Text style={styles.confirmDesc}>
                      Al confirmar, tu cuenta pasará a figurar como Socio Aportante voluntario (${cuotaValor}/mes a partir de hoy). La atención ante emergencias sigue siendo siempre gratuita.
                    </Text>
                    <View style={styles.confirmActions}>
                      <TouchableOpacity
                        style={styles.confirmCancelBtn}
                        onPress={() => setShowSubscribeConfirm(false)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.confirmCancelBtnText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmAcceptBtn}
                        onPress={handleConfirmAsociarse}
                        disabled={isProcessing}
                      >
                        <Text style={styles.confirmAcceptBtnText}>
                          {isProcessing ? 'Guardando...' : 'Sí, asociarme'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>
                ⭐ SOCIO APORTANTE ACTIVO
                {socio?.fecha_adhesion_socio
                  ? ` • Desde ${new Date(socio.fecha_adhesion_socio).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>

            {/* Alerta de Deuda No Bloqueante (Solo para socios adheridos voluntariamente) */}
            {mesesDeuda > 0 ? (
              <View style={styles.warningAlert}>
                <Text style={styles.warningTitle}>🔔 Tienes {mesesDeuda} cuota(s) pendiente(s)</Text>
                <Text style={styles.warningText}>
                  El uso de la aplicación y la atención a tus emergencias está 100% garantizada siempre, sin importar el estado administrativo de tu ficha de socio.
                </Text>
                {Platform.OS !== 'ios' && (
                  <TouchableOpacity style={styles.payDebtButton} onPress={handlePagarDeuda} disabled={isProcessing}>
                    <Text style={styles.payDebtButtonText}>
                      {isProcessing ? 'Procesando...' : `Ponerse al Día ($${deudaTotal})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.successAlert}>
                <Text style={styles.successTitle}>✅ ¡Estás al día!</Text>
                <Text style={styles.successText}>Gracias por tu apoyo mensual a Bomberos Voluntarios de Verónica.</Text>
              </View>
            )}
          </>
        )}

        {/* Tarjeta de Donación Libre (Android/Web) o Información Administrativa (iOS) */}
        {Platform.OS !== 'ios' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hacer una Donación Única</Text>
            <Text style={styles.cardDescription}>
              Si deseas colaborar de forma extraordinaria sin compromiso mensual con equipamiento y gastos operativos.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={donationAmount}
                onChangeText={setDonationAmount}
              />
            </View>

            <TouchableOpacity style={styles.mpButton} onPress={handleDonacion} disabled={isProcessing}>
              <Text style={styles.mpButtonText}>{isProcessing ? 'Procesando...' : 'Donar vía MercadoPago'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Información del Padrón de Socios</Text>
            <Text style={styles.cardDescription}>
              Esta sección es de carácter exclusivamente informativo sobre el estado administrativo de tu ficha en el padrón de la Asociación de Bomberos Voluntarios de Verónica.
              {'\n\n'}
              La asistencia ante emergencias mediante el botón SOS es un servicio público 100% gratuito para toda la comunidad las 24 horas. Cualquier consulta o gestión administrativa sobre el padrón de socios se realiza directamente ante la secretaría de la institución.
            </Text>
          </View>
        )}

        {/* Opción para darse de baja de la cuota social (solo si está adherido y no es iOS) */}
        {esSocioAportante && Platform.OS !== 'ios' && (
          <View style={styles.unsubscribeWrapper}>
            {!showUnsubscribeConfirm ? (
              <TouchableOpacity
                style={styles.unsubscribeTrigger}
                onPress={() => setShowUnsubscribeConfirm(true)}
                disabled={isProcessing}
              >
                <Text style={styles.unsubscribeTriggerText}>Dejar de estar adherido a la cuota social mensual</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>¿Dar de baja la cuota mensual?</Text>
                <Text style={styles.confirmDesc}>
                  Dejarás de acumular cuotas mensuales y tu cuenta pasará a Cuenta Comunitaria Gratuita. Seguirás teniendo acceso completo al botón SOS y a todos los avisos.
                </Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={styles.confirmCancelBtn}
                    onPress={() => setShowUnsubscribeConfirm(false)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.confirmCancelBtnText}>Mantener cuota</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmDangerBtn}
                    onPress={handleConfirmBajaCuota}
                    disabled={isProcessing}
                  >
                    <Text style={styles.confirmAcceptBtnText}>
                      {isProcessing ? 'Procesando...' : 'Sí, dar de baja'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
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
    paddingTop: Platform.OS === 'web' ? 20 : 54,
    paddingBottom: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  backButtonText: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  freeAccountCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    marginBottom: 20,
  },
  freeAccountTitle: {
    color: '#34d399',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  freeAccountText: {
    color: '#d1fae5',
    fontSize: 14,
    lineHeight: 21,
  },
  memberBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  memberBadgeText: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  warningAlert: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    marginBottom: 20,
  },
  warningTitle: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  warningText: {
    color: '#fcd34d',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15,
  },
  payDebtButton: {
    backgroundColor: '#009EE3', // MercadoPago Blue
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  payDebtButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  successAlert: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    marginBottom: 20,
    alignItems: 'center',
  },
  successTitle: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  successText: {
    color: '#a7f3d0',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardDescription: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  subscribeOutlineButton: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  subscribeOutlineButtonText: {
    color: '#7dd3fc',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confirmBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 14,
    padding: 16,
  },
  confirmTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  confirmDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 'bold',
  },
  confirmAcceptBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#0284c7',
    alignItems: 'center',
  },
  confirmDangerBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
  },
  confirmAcceptBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  currencySymbol: {
    color: '#94a3b8',
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: 15,
  },
  mpButton: {
    backgroundColor: '#009EE3',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  mpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  unsubscribeWrapper: {
    width: '100%',
    maxWidth: 500,
    marginTop: 20,
  },
  unsubscribeTrigger: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  unsubscribeTriggerText: {
    color: '#94a3b8',
    fontSize: 13,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
