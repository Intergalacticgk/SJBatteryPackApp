import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Standalone colors (same palette as LiveScoresOptInModal) because this renders
// from the root layout, above the ThemeProvider.
const COLORS = {
  cardBg: '#001E22',
  text: '#FFFFFF',
  subText: '#80B3B8',
  accentGold: '#FFB800',
  borderColor: 'rgba(255,184,0,0.25)',
};

interface Props {
  visible: boolean;
  title: string;
  message: string;
  latestVersion: string;
  onUpdate: () => void;
  onLater: () => void;
}

export default function UpdateAvailableModal({ visible, title, message, latestVersion, onUpdate, onLater }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🚀</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>
          <Text style={styles.version}>Version {latestVersion} is ready</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={onUpdate} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Update Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onLater} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: COLORS.cardBg, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderColor, padding: 24, alignItems: 'center' },
  emoji: { fontSize: 36, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 14, color: COLORS.subText, textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  version: { fontSize: 12, color: COLORS.accentGold, fontWeight: '700', marginBottom: 18 },
  primaryButton: { backgroundColor: COLORS.accentGold, borderRadius: 10, paddingVertical: 12, width: '100%', alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: '#001417', fontWeight: '700', fontSize: 15 },
  secondaryButton: { paddingVertical: 10, width: '100%', alignItems: 'center' },
  secondaryButtonText: { color: COLORS.subText, fontSize: 14 },
});
