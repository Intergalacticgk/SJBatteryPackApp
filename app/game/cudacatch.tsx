import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity, StatusBar, Animated, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../supabase';

const { width, height } = Dimensions.get('window');

const BUCKET_WIDTH = 80;

const BANNED_WORDS = ['FUCK', 'SHIT', 'DICK', 'COCK', 'PUSS', 'CUNT', 'ASS', 'BITCH', 'SLUT', 'HELL', 'DAMN', 'PISS', 'TITS', 'CRAP', 'FAG', 'TWAT', 'WANK', 'JISM'];

const validateInitials = (input: string): boolean => {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const word of BANNED_WORDS) {
    if (clean.includes(word)) return false;
  }
  return true;
};

export default function CudaCatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [bucketX, setBucketX] = useState((width - BUCKET_WIDTH) / 2);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);

  const itemY = useRef(new Animated.Value(-50)).current;
  const [itemX, setItemX] = useState(50);
  const [itemType, setItemType] = useState<'good' | 'bad'>('good');

  const [initials, setInitials] = useState('');
  const [saving, setSaving] = useState(false);

  const moveLeft = () => setBucketX(prev => Math.max(10, prev - 45));
  const moveRight = () => setBucketX(prev => Math.min(width - BUCKET_WIDTH - 10, prev + 45));

  useEffect(() => {
    if (!isPlaying) return;

    let anim: Animated.CompositeAnimation;

    const dropItem = () => {
      itemY.setValue(-50);
      setItemX(Math.random() * (width - 80));
      setItemType(Math.random() > 0.3 ? 'good' : 'bad');

      anim = Animated.timing(itemY, {
        toValue: height - 180,
        duration: 1600,
        useNativeDriver: true,
      });

      anim.start(({ finished }) => {
        if (finished && isPlaying) {
          dropItem();
        }
      });
    };

    dropItem();

    return () => itemY.stopAnimation();
  }, [isPlaying]);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    setIsPlaying(true);
  };

  const handleSaveScore = async () => {
    const clean = initials.trim().toUpperCase();
    if (clean.length < 2 || clean.length > 4 || !validateInitials(clean)) {
      Alert.alert("Invalid Initials", "Please enter 2-4 clean family-friendly letters.");
      return;
    }

    try {
      setSaving(true);
      await supabase.from('arcade_high_scores').insert([{ initials: clean, score, team_played: 'CATCH' }]);
      Alert.alert("Saved!", "Your catch score was uploaded.");
      setGameOver(false);
      router.back();
    } catch {
      Alert.alert("Error", "Could not save score.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
<StatusBar barStyle="light-content" backgroundColor="#002F35" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Menu</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🪸 THE GREAT CUDA CATCH</Text>
        <Text style={styles.scoreDisplay}>Score: {score} | ❤️ {lives}</Text>
      </View>

      <View style={styles.playArea}>
        {isPlaying && (
          <Animated.View style={[styles.fallingItem, { left: itemX, transform: [{ translateY: itemY }] }]}>
            <Text style={{ fontSize: 32 }}>{itemType === 'good' ? '🧦' : '❌'}</Text>
          </Animated.View>
        )}

        {/* Bucket / Net at bottom */}
        <View style={[styles.bucket, { left: bucketX }]}>
          <Text style={{ fontSize: 44 }}>🧺</Text>
        </View>
      </View>

      {/* Touch Sliders */}
      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom + 10, 20) }]}>
        <TouchableOpacity style={styles.controlBtn} onPress={moveLeft}>
          <Text style={styles.controlText}>◀ SLIDE LEFT</Text>
        </TouchableOpacity>
        {!isPlaying && (
          <TouchableOpacity style={[styles.controlBtn, styles.startBtn]} onPress={startGame}>
            <Text style={styles.controlText}>START GAME</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.controlBtn} onPress={moveRight}>
          <Text style={styles.controlText}>SLIDE RIGHT ▶</Text>
        </TouchableOpacity>
      </View>

      {/* Game Over Modal */}
      <Modal visible={gameOver} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>GAME OVER</Text>
            <Text style={styles.modalScore}>You caught {score} items!</Text>
            <TextInput
              style={styles.input}
              maxLength={4}
              placeholder="INITIALS"
              placeholderTextColor="#888"
              value={initials}
              onChangeText={setInitials}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveScore} disabled={saving}>
              <Text style={styles.saveText}>{saving ? "Saving..." : "Submit Score ➔"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#002F35' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#001E22' },
  backBtn: { backgroundColor: '#00434B', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  backText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  title: { color: '#FFB800', fontWeight: '900', fontSize: 13 },
  scoreDisplay: { color: '#00FFCC', fontWeight: '900', fontSize: 12 },
  playArea: { flex: 1, backgroundColor: '#FAFCFC', margin: 10, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  fallingItem: { position: 'absolute', width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  bucket: { position: 'absolute', bottom: 20, width: BUCKET_WIDTH, alignItems: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingTop: 10 },
  controlBtn: { backgroundColor: '#00434B', flex: 1, marginHorizontal: 6, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FFB800' },
  startBtn: { backgroundColor: '#FFB800' },
  controlText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', width: '90%', padding: 24, borderRadius: 16, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#266B73', marginBottom: 8 },
  modalScore: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 16 },
  input: { width: '80%', borderWidth: 2, borderColor: '#266B73', borderRadius: 8, padding: 10, fontSize: 18, fontWeight: '900', textAlign: 'center', backgroundColor: '#F4F6F9', marginBottom: 16 },
  saveBtn: { backgroundColor: '#DD8943', width: '80%', padding: 12, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#FFF', fontWeight: '900', fontSize: 14 }
});