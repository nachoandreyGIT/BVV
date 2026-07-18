import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RegisterScreen() {
  const [isLogin, setIsLogin] = useState(true); // Por defecto mostrar Iniciar Sesión
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    homeDescription: '',
    vehicleDescription: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!formData.phone || !formData.password) {
      alert('Por favor, ingresa tu teléfono y contraseña.');
      return;
    }

    setLoading(true);
    
    // Buscar socio por teléfono y contraseña
    const { data, error } = await supabase
      .from('socios')
      .select('id, nombre')
      .eq('telefono', formData.phone.trim())
      .eq('password', formData.password.trim())
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      console.error('Error al iniciar sesión:', error);
      alert(`Error: ${error?.message || 'Usuario no encontrado'}. Verifica tus credenciales.`);
      return;
    }

    // Iniciar sesión guardando el ID
    await AsyncStorage.setItem('socioId', data.id.toString());
    router.replace('/');
  };

  const handleRegister = async () => {
    if (!formData.fullName || !formData.email || !formData.phone || !formData.password || !formData.homeDescription) {
      alert('Por favor, completa los campos requeridos marcados con (*)');
      return;
    }

    setLoading(true);
    
    const { data, error } = await supabase.from('socios').insert([{
      nombre: formData.fullName,
      email: formData.email,
      telefono: formData.phone,
      password: formData.password,
      direccion: formData.homeDescription,
      vehiculo: formData.vehicleDescription
    }]).select();

    setLoading(false);

    if (error) {
      console.error('Error al registrar:', error);
      alert('Hubo un error al registrar: ' + error.message);
      return;
    }

    if (data && data[0]) {
      // Guardar el ID del socio localmente para poder enviar alertas luego
      await AsyncStorage.setItem('socioId', data[0].id.toString());
      // Después de registrarse, podríamos mandarlo a payment, pero por ahora lo mandamos a inicio para no trabarlo
      router.replace('/payment');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Bomberos Voluntarios</Text>
          <Text style={styles.subtitle}>de Verónica</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, isLogin && styles.activeTab]}
            onPress={() => setIsLogin(true)}
          >
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>INICIAR SESIÓN</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, !isLogin && styles.activeTab]}
            onPress={() => setIsLogin(false)}
          >
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>SOY NUEVO</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          {isLogin ? (
            <>
              <Text style={styles.sectionTitle}>Acceso Vecinos</Text>
              <Text style={styles.helpText}>
                Ingresa el número de teléfono con el que te registraste para entrar.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Teléfono Celular"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(t) => setFormData({ ...formData, phone: t })}
              />
              
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { marginBottom: 0 }]}
                  placeholder="Contraseña"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(t) => setFormData({ ...formData, password: t })}
                />
                <TouchableOpacity 
                  style={styles.eyeButton} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, loading && { opacity: 0.5 }]} 
                onPress={handleLogin}
                disabled={loading}
              >
                <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.buttonGradient}>
                  <Text style={styles.submitButtonText}>{loading ? 'INGRESANDO...' : 'ENTRAR'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Datos Personales</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Nombre Completo (*)"
                placeholderTextColor="#64748b"
                value={formData.fullName}
                onChangeText={(t) => setFormData({ ...formData, fullName: t })}
              />

              <TextInput
                style={styles.input}
                placeholder="Correo Electrónico (*)"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(t) => setFormData({ ...formData, email: t })}
              />

              <TextInput
                style={styles.input}
                placeholder="Teléfono Celular (*)"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(t) => setFormData({ ...formData, phone: t })}
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { marginBottom: 0 }]}
                  placeholder="Contraseña (*)"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(t) => setFormData({ ...formData, password: t })}
                />
                <TouchableOpacity 
                  style={styles.eyeButton} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Datos de Logística</Text>
              <Text style={styles.helpText}>
                Esta información ayudará al cuartel a identificar su vivienda rápidamente.
              </Text>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Dirección y Descripción de Vivienda (*)&#10;(Ej: Calle 125 bis entre 20 y 21, casa de dos pisos)"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={4}
                value={formData.homeDescription}
                onChangeText={(t) => setFormData({ ...formData, homeDescription: t })}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Descripción de Vehículo (Opcional)&#10;(Ej: Ford Fiesta Blanco patente AB123CD)"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={2}
                value={formData.vehicleDescription}
                onChangeText={(t) => setFormData({ ...formData, vehicleDescription: t })}
              />

              <TouchableOpacity 
                style={[styles.submitButton, loading && { opacity: 0.5 }]} 
                onPress={handleRegister}
                disabled={loading}
              >
                <LinearGradient colors={['#059669', '#047857']} style={styles.buttonGradient}>
                  <Text style={styles.submitButtonText}>{loading ? 'REGISTRANDO...' : 'COMPLETAR REGISTRO'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

        </View>
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
    marginBottom: 20,
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
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 500,
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
  },
  formCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 5,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 5,
  },
  helpText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 15,
    lineHeight: 18,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    color: '#fff',
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 15,
    justifyContent: 'center',
  },
  eyeButton: {
    position: 'absolute',
    right: 15,
    padding: 10,
  },
  eyeText: {
    fontSize: 20,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
