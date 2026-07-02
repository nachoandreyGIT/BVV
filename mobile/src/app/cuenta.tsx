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
  const [mesesDeuda, setMesesDeuda] = useState(0);
  const [deudaTotal, setDeudaTotal] = useState(0);
  
  const [donationAmount, setDonationAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

      // 3. Calcular Meses Transcurridos
      const fechaRegistro = new Date(socioData.created_at);
      const hoy = new Date();
      const diffAños = hoy.getFullYear() - fechaRegistro.getFullYear();
      const diffMeses = hoy.getMonth() - fechaRegistro.getMonth();
      let totalMesesHistoricos = diffAños * 12 + diffMeses + 1; // +1 por el mes de alta

      // 4. Obtener Pagos Aprobados / Perdonados
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

  const handlePagarDeuda = async () => {
    if (mesesDeuda === 0) return;
    setIsProcessing(true);
    
    // Calcular qué meses faltan (Ej: simplificamos mandando la cantidad de meses y monto total)
    // Para simplificar, enviaremos un arreglo de strings ficticios para los meses.
    const meses = Array.from({length: mesesDeuda}).map((_, i) => `Cuota-${i}`);
    
    try {
      const res = await fetch('http://localhost:3000/api/mercadopago/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: socio.id,
          monto: deudaTotal,
          tipo: 'cuota',
          meses: meses
        })
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
      const res = await fetch('http://localhost:3000/api/mercadopago/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: socio.id,
          monto: Number(donationAmount),
          tipo: 'donacion'
        })
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
        <Text style={styles.title}>Mi Cuenta</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Alerta de Deuda No Bloqueante */}
        {mesesDeuda > 0 ? (
          <View style={styles.warningAlert}>
            <Text style={styles.warningTitle}>🔔 Tienes {mesesDeuda} mes(es) pendiente(s)</Text>
            <Text style={styles.warningText}>
              El uso de la aplicación y la atención a tus emergencias está 100% garantizada siempre, sin importar tus pagos. 
              Sin embargo, tu aporte mensual es vital para el cuartel. ¡Gracias por apoyarnos!
            </Text>
            <TouchableOpacity style={styles.payDebtButton} onPress={handlePagarDeuda} disabled={isProcessing}>
              <Text style={styles.payDebtButtonText}>{isProcessing ? 'Procesando...' : `Ponerse al Día ($${deudaTotal})`}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.successAlert}>
            <Text style={styles.successTitle}>✅ ¡Estás al día!</Text>
            <Text style={styles.successText}>Gracias por tu aporte continuo a Bomberos Voluntarios.</Text>
          </View>
        )}

        {/* Tarjeta de Donación Libre */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hacer una Donación Única</Text>
          <Text style={styles.cardDescription}>
            Si deseas colaborar de forma extraordinaria con equipamiento y gastos operativos.
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
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
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
});
