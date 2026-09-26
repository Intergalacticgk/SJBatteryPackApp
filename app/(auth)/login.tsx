import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { supabase } from '../../supabase';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  
  // Form State
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');

  // 1️⃣ SEND THE SMS CODE
  const handleSendCode = async () => {
    if (!phone) {
      Alert.alert('Missing Field', 'Please enter your phone number.');
      return;
    }

    if (isSignUp && (!fullName || !birthMonth || !birthDay)) {
      Alert.alert('Missing Fields', 'Please fill out your name and birthday so we can celebrate you!');
      return;
    }

    let formattedPhone = phone.replace(/\D/g, ''); 
    if (formattedPhone.length === 10) {
      formattedPhone = `+1${formattedPhone}`;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+${formattedPhone}`;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          data: isSignUp ? {
            full_name: fullName,
            birthday: `${birthMonth}/${birthDay}`,
          } : undefined,
        }
      });

      if (error) throw error;
      
      setIsCodeSent(true);
      Alert.alert('Code Sent! 🦈', 'Check your text messages for the 6-digit code.');
      
    } catch (error: any) {
      Alert.alert('Error Sending Code', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2️⃣ VERIFY THE SMS CODE
  const handleVerifyCode = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your phone.');
      return;
    }

    let formattedPhone = phone.replace(/\D/g, ''); 
    if (formattedPhone.length === 10) formattedPhone = `+1${formattedPhone}`;
    else if (!formattedPhone.startsWith('+')) formattedPhone = `+${formattedPhone}`;

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: 'sms',
      });

      if (error) throw error;
    } catch (error: any) {
      Alert.alert('Verification Error', 'That code is incorrect or expired. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
      >
        {/* Header / Logo */}
        <View style={styles.headerContainer}>
          <Image
            source={require('../../assets/images/Logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>SJ BATTERY PACK</Text>
          <Text style={styles.subtitle}>Official Fan App & Digital Passport</Text>
        </View>

        {/* Card Container */}
        <View style={styles.cardContainer}>
          {isCodeSent ? (
            <>
              <Text style={styles.welcomeText}>Verify Your Number</Text>
              <Text style={styles.instructionsText}>We sent a 6-digit code to {phone}</Text>

              <TextInput
                style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 5 }]}
                placeholder="000000"
                placeholderTextColor="#80B3B8"
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onChangeText={setOtpCode}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyCode} disabled={loading}>
                {loading ? <ActivityIndicator color="#002F35" /> : <Text style={styles.primaryButtonText}>Verify & Enter</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsCodeSent(false)}>
                <Text style={styles.toggleText}>Wrong number? Go back.</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.welcomeText}>
                {isSignUp ? 'Join the Section 108 Pack' : 'Welcome to the Reef 🏒🪸'}
              </Text>

              {isSignUp && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name / Fan Name"
                    placeholderTextColor="#80B3B8"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 5 }]}
                      placeholder="Birth Month (e.g. 10)"
                      placeholderTextColor="#80B3B8"
                      keyboardType="number-pad"
                      maxLength={2}
                      value={birthMonth}
                      onChangeText={setBirthMonth}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, marginLeft: 5 }]}
                      placeholder="Birth Day (e.g. 24)"
                      placeholderTextColor="#80B3B8"
                      keyboardType="number-pad"
                      maxLength={2}
                      value={birthDay}
                      onChangeText={setBirthDay}
                    />
                  </View>
                </>
              )}

              <TextInput
                style={styles.input}
                placeholder="Phone Number (10 digits)"
                placeholderTextColor="#80B3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleSendCode} disabled={loading}>
                {loading ? <ActivityIndicator color="#002F35" /> : <Text style={styles.primaryButtonText}>Send SMS Code</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                <Text style={styles.toggleText}>
                  {isSignUp
                    ? 'Already in the Pack? Sign In'
                    : "New to the Pack? Create an Account"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, backgroundColor: '#002F35' },
  scrollContent: { paddingHorizontal: 24, paddingVertical: 20, justifyContent: 'center', flexGrow: 1 },
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 100, height: 100, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5, textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#80B3B8', marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardContainer: { backgroundColor: '#001E22', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 184, 0, 0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  welcomeText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16, textAlign: 'center' },
  instructionsText: { fontSize: 14, color: '#80B3B8', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#002F35', color: '#FFFFFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#00424A' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  primaryButton: { backgroundColor: '#FFB800', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  primaryButtonText: { color: '#002F35', fontSize: 16, fontWeight: '800' },
  toggleText: { color: '#80B3B8', fontSize: 13, textAlign: 'center', marginVertical: 4, textDecorationLine: 'underline' },
});