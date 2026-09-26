import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { supabase } from '../supabase';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator color="#FFB800" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera access is required to scan Win Stamps.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- CORE STAMP PROCESSING LOGIC ---
  const processStampClaim = async (qrRawData: string) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Please sign in to collect passport stamps.');
      }

      const { data: activeGame, error: configError } = await supabase
        .from('active_game_config')
        .select('*')
        .eq('id', 'current_game')
        .single();

      if (configError || !activeGame || !activeGame.is_active) {
        throw new Error('No active win stamp is available to claim at this moment.');
      }

      let parsedStampType = activeGame.stamp_type || 'cudawin1';
      try {
        const parsed = JSON.parse(qrRawData);
        if (parsed.stamp_type) parsedStampType = parsed.stamp_type;
      } catch {
        if (qrRawData.includes('frenzyhead')) parsedStampType = 'frenzyhead';
        else if (qrRawData.includes('cudawin1')) parsedStampType = 'cudawin1';
      }

      const { data: existingStamps } = await supabase
        .from('passport_stamps')
        .select('id')
        .eq('user_id', user.id)
        .eq('game_name', activeGame.game_name);

      if (existingStamps && existingStamps.length > 0) {
        Alert.alert('Already Claimed! 🏒', `You already collected the stamp for ${activeGame.game_name}.`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }

      const { error: insertError } = await supabase
        .from('passport_stamps')
        .insert({
          user_id: user.id,
          stamp_type: parsedStampType,
          game_name: activeGame.game_name,
          opponent: activeGame.opponent,
          score: activeGame.score,
          game_date: activeGame.game_date,
        });

      if (insertError) throw insertError;

      Alert.alert(
        'Stamp Claimed! 🦈🎉', 
        `${activeGame.game_name}\nvs ${activeGame.opponent} (${activeGame.score})\nhas been recorded in your Passport!`, 
        [{ text: 'View Passport', onPress: () => router.back() }]
      );

    } catch (err: any) {
      Alert.alert('Stamp Verification Failed', err.message || 'Could not verify stamp.', [
        { text: 'Try Again', onPress: () => setScanned(false) }
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const handleLiveCameraBarcode = ({ data }: { data: string }) => {
    processStampClaim(data);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const imageUri = result.assets[0].uri;
      setProcessing(true);

      const scannedCodes = await scanFromURLAsync(imageUri, ['qr']);

      if (scannedCodes && scannedCodes.length > 0) {
        processStampClaim(scannedCodes[0].data);
      } else {
        Alert.alert('No QR Code Found', 'We could not detect a valid QR code in that photo. Please ensure the code is clear and unblurred.');
        setProcessing(false);
      }
    } catch (err: any) {
      Alert.alert('Image Scan Error', err.message || 'Failed to scan image.');
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleLiveCameraBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Targeting Overlay */}
      <View style={styles.overlay}>
        <View style={styles.scanTarget} />
        <Text style={styles.overlayText}>Point camera at the Win QR Code</Text>
        {processing && (
          <ActivityIndicator size="large" color="#FFB800" style={{ marginTop: 20 }} />
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.actionButton} onPress={handlePickImage} disabled={processing}>
          <Text style={styles.actionButtonIcon}>🖼️</Text>
          <Text style={styles.actionButtonText}>Upload from Photos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>✕ Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#FFF', fontSize: 16, textAlign: 'center', marginHorizontal: 30, marginBottom: 20 },
  button: { backgroundColor: '#FFB800', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  buttonText: { color: '#002F35', fontWeight: 'bold', fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanTarget: { width: 240, height: 240, borderWidth: 3, borderColor: '#FFB800', borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.1)' },
  overlayText: { color: '#FFF', marginTop: 18, fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(0,47,53,0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  bottomBar: { position: 'absolute', bottom: 35, width: '100%', alignItems: 'center', gap: 12 },
  actionButton: { backgroundColor: '#DD8943', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  actionButtonIcon: { fontSize: 16, marginRight: 8 },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  cancelButton: { backgroundColor: 'rgba(0,30,34,0.85)', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)' },
  cancelButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});