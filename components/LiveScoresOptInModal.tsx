import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Standalone colors (not ThemeContext) because this modal renders from the
// root layout, above where ThemeProvider wraps the (drawer) tree — matches
// the app's dark theme palette from context/ThemeContext.tsx.
const COLORS = {
  bg: '#001417',
  cardBg: '#001E22',
  text: '#FFFFFF',
  subText: '#80B3B8',
  accentGold: '#FFB800',
  borderColor: 'rgba(255,184,0,0.25)',
};

interface Props {
  visible: boolean;
  onChoice: (turnOn: boolean) => void;
}

export default function LiveScoresOptInModal({ visible, onChoice }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🚨</Text>
          <Text style={styles.title}>Live Goals & Score Updates</Text>
          <Text style={styles.body}>
            Want a push alert the instant the Barracuda score, plus final scores and period
            summaries? You can turn this on now, or leave it off and switch it on anytime later
            from Settings → Account → Notification Preferences.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => onChoice(true)} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Turn On Live Goals & Scores</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => onChoice(false)} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    padding: 24,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: COLORS.subText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.accentGold,
    borderRadius: 10,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#001417',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.subText,
    fontWeight: '600',
    fontSize: 14,
  },
});
