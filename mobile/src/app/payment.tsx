import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

export default function PaymentScreen() {
  const [donationAmount, setDonationAmount] = useState('');

  const handleSubscription = () => {
    // TODO: Integrar SDK de MercadoPago (Suscripciones)
    console.log('Iniciando suscripción mensual con MercadoPago...');
    alert('Redirigiendo a MercadoPago...');
    router.replace('/');
  };

  const handleDonation = () => {
    if (!donationAmount || isNaN(Number(donationAmount)) || Number(donationAmount) <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }
    // TODO: Integrar SDK de MercadoPago (Pago único / Checkout Pro)
    console.log(`Iniciando donación de $${donationAmount} con MercadoPago...`);
    alert('Redirigiendo a MercadoPago...');
    router.replace('/');
  };

  const skipPayment = () => {
    // Opción para saltear el pago y registrarse igual (opcional)
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Asociarse a la Entidad</Text>
          <Text style={styles.subtitle}>Tu aporte salva vidas</Text>
        </View>

        {/* Tarjeta de Suscripción Mensual */}
        <View style={styles.card}>
          <LinearGradient colors={['rgba(37, 99, 235, 0.1)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.cardTitle}>Cuota Social Mensual</Text>
          <Text style={styles.cardDescription}>
            Colaborá con el cuartel mes a mes mediante débito automático con cualquier tarjeta. Podés cancelar cuando quieras.
          </Text>
          
          <View style={styles.priceContainer}>
            <Text style={styles.priceBadge}>Valor sugerido: $2.000 / mes</Text>
          </View>

          <TouchableOpacity style={styles.mpButton} onPress={handleSubscription}>
            <Text style={styles.mpButtonText}>Suscribirse con MercadoPago</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.orText}>- O -</Text>

        {/* Tarjeta de Donación Única */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Donación Única</Text>
          <Text style={styles.cardDescription}>
            Ingresá el monto con el que deseas colaborar por única vez.
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

          <TouchableOpacity style={styles.mpButtonOutline} onPress={handleDonation}>
            <Text style={styles.mpButtonOutlineText}>Donar con MercadoPago</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={skipPayment}>
          <Text style={styles.skipButtonText}>Omitir por ahora e ir al inicio</Text>
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
    paddingTop: Platform.OS === 'web' ? 40 : 80,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 8,
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
    overflow: 'hidden',
    alignItems: 'center',
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
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  priceContainer: {
    marginBottom: 20,
  },
  priceBadge: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  // MercadoPago azul característico
  mpButton: {
    backgroundColor: '#009EE3',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#009EE3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  mpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mpButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#009EE3',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  mpButtonOutlineText: {
    color: '#009EE3',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 20,
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
  skipButton: {
    marginTop: 30,
    padding: 10,
  },
  skipButtonText: {
    color: '#64748b',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
