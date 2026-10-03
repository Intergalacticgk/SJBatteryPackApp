import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  Modal,
  TextInput,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { supabase } from '../../supabase';
import { validateInitials } from '../../utils/initialsFilter';

const { width, height } = Dimensions.get('window');

const FRENZY_GOALIE = require('../../assets/images/8-bit-frenzy-goalie.png');
const RINK_BACKGROUND = require('../../assets/images/penalty-shot-background.jpeg');

const BGM_AUDIO = require('../../assets/audio/frenzyshot-bgm.mp3');
const CLANG_AUDIO = require('../../assets/audio/post-clang.mp3');
const HORN_AUDIO = require('../../assets/audio/goal-horn.mp3');
const GOAL_AUDIO = require('../../assets/audio/goal-cheer.mp3');
const SAVE_AUDIO = require('../../assets/audio/glove-save.mp3');

const INNER_POST_LIMIT = width * 0.28;
const POST_THICKNESS = 18;

export type DifficultyLevel = 'ECHL' | 'AHL' | 'NHL';

const DIFFICULTY_CONFIG = {
  ECHL: { label: 'ECHL (Rookie)', goalieDuration: 440, trackingMultiplier: 0.65, saveThreshold: 42, ptsMultiplier: 1.0 },
  AHL: { label: 'AHL (Pro)', goalieDuration: 350, trackingMultiplier: 0.82, saveThreshold: 48, ptsMultiplier: 1.25 },
  NHL: { label: 'NHL (All-Star)', goalieDuration: 250, trackingMultiplier: 0.95, saveThreshold: 54, ptsMultiplier: 1.5 },
};


export default function PenaltyShotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [hasSelectedDifficulty, setHasSelectedDifficulty] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('AHL');

  const [score, setScore] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(5);
  const [streak, setStreak] = useState(0);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const bgmSoundRef = useRef<Audio.Sound | null>(null);
  const cheerTimerRef = useRef<any>(null);
  const hornSoundRef = useRef<Audio.Sound | null>(null);

  const puckX = useRef(new Animated.Value(0)).current;
  const puckY = useRef(new Animated.Value(0)).current;
  const puckScale = useRef(new Animated.Value(1)).current;
  const goalieX = useRef(new Animated.Value(0)).current;
  const netShake = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  const [initials, setInitials] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const isShootingRef = useRef(false);
  isShootingRef.current = isShooting;

  const shotsLeftRef = useRef(5);
  shotsLeftRef.current = shotsLeft;

  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const hasSelectedDifficultyRef = useRef(false);
  hasSelectedDifficultyRef.current = hasSelectedDifficulty;

  const difficultyRef = useRef<DifficultyLevel>('AHL');
  difficultyRef.current = difficulty;

  // Initialize and loop arena BGM reliably
  useEffect(() => {
    let isMounted = true;
    async function initBgm() {
      try {
        const soundObject = new Audio.Sound();
        await soundObject.loadAsync(BGM_AUDIO, {
          isLooping: true,
          volume: 0.35,
          shouldPlay: false,
        });
        if (isMounted) {
          bgmSoundRef.current = soundObject;
          if (musicEnabled && hasSelectedDifficulty && !isPaused && !gameOver) {
            await soundObject.playAsync();
          }
        }
      } catch (err) {
        console.warn('BGM Audio warning:', err);
      }
    }
    initBgm();

    return () => {
      isMounted = false;
      if (cheerTimerRef.current) clearTimeout(cheerTimerRef.current);
      bgmSoundRef.current?.unloadAsync();
      hornSoundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (!bgmSoundRef.current) return;
    try {
      if (musicEnabled && hasSelectedDifficulty && !isPaused && !gameOver) {
        bgmSoundRef.current.playAsync();
      } else {
        bgmSoundRef.current.pauseAsync();
      }
    } catch {}
  }, [musicEnabled, isPaused, gameOver, hasSelectedDifficulty]);

  // Android-tested SFX player: creates a dedicated instance that unloads on completion
  const playSfx = async (source: any, volume = 0.85) => {
    if (!sfxEnabled) return;
    try {
      const soundObject = new Audio.Sound();
      await soundObject.loadAsync(source, { shouldPlay: true, volume });
      soundObject.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          await soundObject.unloadAsync();
        }
      });
    } catch (e) {
      console.warn('SFX playback warning:', e);
    }
  };

  // 3-second auto-stop goal horn
  const triggerQuietHorn = async () => {
    if (!sfxEnabled) return;
    try {
      if (hornSoundRef.current) {
        try {
          await hornSoundRef.current.stopAsync();
          await hornSoundRef.current.unloadAsync();
        } catch {}
      }
      const soundObject = new Audio.Sound();
      await soundObject.loadAsync(HORN_AUDIO, { shouldPlay: true, volume: 0.33 });
      hornSoundRef.current = soundObject;
      setTimeout(async () => {
        try {
          await soundObject.stopAsync();
          await soundObject.unloadAsync();
        } catch {}
      }, 3000);
    } catch (e) {
      console.warn('Horn playback warning:', e);
    }
  };

  // Goal cheer audio with automatic ducking
  const triggerGoalCheer = async () => {
    if (!sfxEnabled) return;
    try {
      if (bgmSoundRef.current && musicEnabled) await bgmSoundRef.current.pauseAsync();
      if (cheerTimerRef.current) clearTimeout(cheerTimerRef.current);

      const soundObject = new Audio.Sound();
      await soundObject.loadAsync(GOAL_AUDIO, { shouldPlay: true, volume: 0.85 });

      cheerTimerRef.current = setTimeout(async () => {
        try {
          await soundObject.unloadAsync();
        } catch {}
        if (musicEnabled && hasSelectedDifficulty && !isPaused && !gameOver && bgmSoundRef.current) {
          await bgmSoundRef.current.playAsync();
        }
      }, 3000);
    } catch (e) {
      console.warn('Goal cheer warning:', e);
    }
  };

  const resetPuck = useCallback(() => {
    puckX.setValue(0);
    puckY.setValue(0);
    puckScale.setValue(1);
    goalieX.setValue(0);
    setIsShooting(false);
  }, [puckX, puckY, puckScale, goalieX]);

  const restartGame = useCallback(() => {
    setScore(0);
    setShotsLeft(5);
    setStreak(0);
    setRoundResult(null);
    setGameOver(false);
    setIsPaused(false);
    resetPuck();
    setHasSelectedDifficulty(false);
  }, [resetPuck]);

  const selectDifficultyAndStart = useCallback((level: DifficultyLevel) => {
    setDifficulty(level);
    setHasSelectedDifficulty(true);
  }, []);

  const handleBackToDifficultyMenu = useCallback(() => {
    if (hasSelectedDifficulty) {
      restartGame();
    } else {
      router.back();
    }
  }, [hasSelectedDifficulty, restartGame, router]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: -8, duration: 600, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [arrowAnim]);

  const fetchLeaderboard = async () => {
    try {
      const { data } = await supabase
        .from('arcade_high_scores')
        .select('*')
        .eq('game_type', 'FRENZY_SHOT')
        .order('score', { ascending: false })
        .limit(30);

      if (data && data.length > 0) {
        // Keep only the highest score per unique initial
        const unique = [];
        const seen = new Set();
        for (const item of data) {
          const key = (item.initials || '').toUpperCase();
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
          if (unique.length === 10) break;
        }
        setLeaderboard(unique);
      } else {
        setLeaderboard([]);
      }
    } catch {
      setLeaderboard([]);
    }
  };

  const triggerPostRicochet = (impactX: number, targetY: number) => {
    playSfx(CLANG_AUDIO, 0.85);
    setStreak(0);
    setRoundResult('🔔 *CLANG!* OFF THE POST!');

    Animated.sequence([
      Animated.timing(netShake, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(netShake, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(netShake, { toValue: -3, duration: 40, useNativeDriver: true }),
      Animated.timing(netShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();

    const bounceDirection = impactX > 0 ? 45 : -45;
    Animated.parallel([
      Animated.timing(puckX, { toValue: impactX + bounceDirection, duration: 220, useNativeDriver: true }),
      Animated.timing(puckY, { toValue: targetY + 80, duration: 220, useNativeDriver: true }),
      Animated.timing(puckScale, { toValue: 0.55, duration: 220, useNativeDriver: true }),
    ]).start(() => finishRound());
  };

  const finishRound = () => {
    setShotsLeft((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setTimeout(() => {
          triggerQuietHorn();
          fetchLeaderboard();
          setGameOver(true);
        }, 800);
      } else {
        setTimeout(() => {
          setRoundResult(null);
          resetPuck();
        }, 1100);
      }
      return next;
    });
  };

  const handleShoot = useCallback((dx: number, dy: number, vx: number, vy: number) => {
    if (isShootingRef.current || shotsLeftRef.current <= 0 || isPausedRef.current || !hasSelectedDifficultyRef.current) return;
    setIsShooting(true);

    const currentDiff = difficultyRef.current;
    const config = DIFFICULTY_CONFIG[currentDiff];
    const rawTargetX = dx * 1.6 + (vx || 0) * 40;
    const targetY = -(height * 0.38);

    const goalieChoices = [
      rawTargetX * config.trackingMultiplier,
      (Math.random() - 0.5) * (INNER_POST_LIMIT * 1.3),
      rawTargetX * (currentDiff === 'NHL' ? 1.0 : 0.8),
    ];
    const goalieTargetX = Math.max(
      -INNER_POST_LIMIT + 15,
      Math.min(INNER_POST_LIMIT - 15, goalieChoices[Math.floor(Math.random() * goalieChoices.length)])
    );

    Animated.parallel([
      Animated.timing(puckX, { toValue: rawTargetX, duration: 380, useNativeDriver: true }),
      Animated.timing(puckY, { toValue: targetY, duration: 380, useNativeDriver: true }),
      Animated.timing(puckScale, { toValue: 0.42, duration: 380, useNativeDriver: true }),
      Animated.timing(goalieX, { toValue: goalieTargetX, duration: config.goalieDuration, useNativeDriver: true }),
    ]).start(() => {
      const absX = Math.abs(rawTargetX);

      if (absX >= INNER_POST_LIMIT - 8 && absX <= INNER_POST_LIMIT + POST_THICKNESS) {
        triggerPostRicochet(rawTargetX, targetY);
        return;
      }

      if (absX > INNER_POST_LIMIT + POST_THICKNESS) {
        setStreak(0);
        setRoundResult('❌ WIDE OF THE NET!');
        finishRound();
        return;
      }

      const isSaved = Math.abs(rawTargetX - goalieTargetX) < config.saveThreshold;
      if (isSaved) {
        playSfx(SAVE_AUDIO, 0.85);
        setStreak(0);
        setRoundResult('🧤 SAVED BY FRENZY!');
      } else {
        triggerGoalCheer();
        const basePts = Math.round((100 + streak * 25) * config.ptsMultiplier);
        setScore((prev) => prev + basePts);
        setStreak((prev) => prev + 1);
        setRoundResult('🚨 GOAL! LIGHT THE LAMP!');
      }

      finishRound();
    });
  }, [puckX, puckY, puckScale, goalieX, streak]);

  // Bulletproof gesture listener: triggers immediately on upward movement
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < -12 && !isShootingRef.current) {
          handleShoot(gestureState.dx, gestureState.dy, gestureState.vx, gestureState.vy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if ((gestureState.dy < -8 || gestureState.vy < -0.15) && !isShootingRef.current) {
          handleShoot(gestureState.dx, gestureState.dy, gestureState.vx, gestureState.vy);
        }
      },
    })
  ).current;

  const handleSaveScore = async () => {
    const clean = initials.trim().toUpperCase();
    if (clean.length < 2 || clean.length > 4 || !validateInitials(clean)) {
      Alert.alert('Invalid Initials', 'Please enter 2-4 clean alphanumeric characters.');
      return;
    }

    try {
      setSaving(true);
      const { data: authData } = await supabase.auth.getSession();
      const currentUserId = authData?.session?.user?.id || null;

      await supabase.from('arcade_high_scores').insert([
        {
          user_id: currentUserId,
          initials: clean,
          score,
          team_played: `FRENZY-${difficulty}`,
          game_type: 'FRENZY_SHOT',
        },
      ]);

      if (currentUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('frenzyshot_high_score')
          .eq('id', currentUserId)
          .single();

        const currentBest = profile?.frenzyshot_high_score || 0;
        if (score > currentBest) {
          await supabase
            .from('profiles')
            .update({
              frenzyshot_high_score: score,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentUserId);
        }
      }

      Alert.alert('Saved!', 'Your score is on the leaderboard & synced to your account.');
      await fetchLeaderboard();
      setGameOver(false);
      restartGame();
    } catch {
      Alert.alert('Error', 'Could not record score at this time.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <Animated.View style={[styles.bgContainer, { transform: [{ translateX: netShake }] }]}>
        <Image source={RINK_BACKGROUND} style={styles.backgroundImage} contentFit="fill" />
      </Animated.View>

      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <StatusBar style="light" />

        {/* HEADER */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <TouchableOpacity style={styles.menuBtn} onPress={handleBackToDifficultyMenu}>
            <Text style={styles.menuBtnText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>FRENZY SHOOTOUT</Text>
          </View>

          <View style={styles.headerRightRow}>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>PTS: {score}</Text>
            </View>

            <TouchableOpacity
              style={styles.pauseBtn}
              onPress={() => { fetchLeaderboard(); setIsPaused(true); }}
              disabled={gameOver || isShooting || !hasSelectedDifficulty}
            >
              <Text style={styles.pauseBtnText}>⏸</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hudBar}>
          <View style={styles.hudBox}>
            <Text style={styles.hudLabel}>SHOTS LEFT</Text>
            <Text style={styles.hudVal}>🏒 {shotsLeft}</Text>
          </View>
          <View style={styles.hudBox}>
            <Text style={styles.hudLabel}>DIFFICULTY</Text>
            <Text style={[styles.hudVal, { color: '#00E5FF' }]}>{hasSelectedDifficulty ? difficulty : '--'}</Text>
          </View>
          <View style={styles.hudBox}>
            <Text style={styles.hudLabel}>STREAK</Text>
            <Text style={[styles.hudVal, { color: streak > 1 ? '#FF4D4D' : '#FFB800' }]}>🔥 {streak}</Text>
          </View>
        </View>

        {/* FIELD PLAY AREA */}
        <View style={styles.fieldContainer}>
          {/* FRENZY GOALIE: Anchored precisely to the center of the rink */}
          <View style={styles.creaseAnchor} pointerEvents="none">
            <Animated.View style={[styles.goalieContainer, { transform: [{ translateX: goalieX }] }]}>
              <Image source={FRENZY_GOALIE} style={styles.goalieSprite} contentFit="contain" />
            </Animated.View>
          </View>

          {roundResult && (
            <View style={styles.resultBanner} pointerEvents="none">
              <Text style={styles.resultBannerText}>{roundResult}</Text>
            </View>
          )}

          {/* PUCK AND SWIPE HINT */}
          <View style={styles.puckStartingZone} pointerEvents="none">
            {!isShooting && shotsLeft > 0 && !isPaused && hasSelectedDifficulty && (
              <Animated.View style={[styles.aimIndicator, { transform: [{ translateY: arrowAnim }] }]}>
                <Text style={styles.aimArrow}>▲</Text>
                <Text style={styles.aimText}>SWIPE UP TO SHOOT</Text>
              </Animated.View>
            )}

            <Animated.View
              style={[
                styles.puckWrapper,
                { transform: [{ translateX: puckX }, { translateY: puckY }, { scale: puckScale }] },
              ]}
            >
              <View style={styles.puckShadow} />
              <View style={styles.puckDisc}>
                <View style={styles.puckCore} />
              </View>
            </Animated.View>
          </View>

          {/* ACTIVE ANDROID-PROOF TOUCH SURFACE */}
          <View
            collapsable={false}
            style={styles.touchOverlay}
            {...panResponder.panHandlers}
          />
        </View>

        {/* DIFFICULTY MODAL */}
        <Modal visible={!hasSelectedDifficulty} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.difficultyCard}>
              <Text style={styles.modalHeading}>SELECT DIFFICULTY</Text>
              <Text style={styles.modalSubheading}>Choose your challenge to start the shootout.</Text>

              <TouchableOpacity style={styles.diffSelectBtn} onPress={() => selectDifficultyAndStart('ECHL')}>
                <Text style={styles.diffSelectTitle}>ECHL (Rookie)</Text>
                <Text style={styles.diffSelectDesc}>Slower goalie • 1.0x Points</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.diffSelectBtn, { borderColor: '#00E5FF' }]} onPress={() => selectDifficultyAndStart('AHL')}>
                <Text style={[styles.diffSelectTitle, { color: '#00E5FF' }]}>AHL (Pro)</Text>
                <Text style={styles.diffSelectDesc}>Normal goalie • 1.25x Points</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.diffSelectBtn, { borderColor: '#FF4D4D' }]} onPress={() => selectDifficultyAndStart('NHL')}>
                <Text style={[styles.diffSelectTitle, { color: '#FF4D4D' }]}>NHL (All-Star)</Text>
                <Text style={styles.diffSelectDesc}>Lightning goalie • 1.50x Points</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.exitBtn, { marginTop: 14 }]} onPress={() => router.back()}>
                <Text style={styles.exitBtnText}>Quit to Arcade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* PAUSE MODAL */}
        <Modal visible={isPaused} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.pauseCard}>
              <Text style={styles.modalHeading}>GAME PAUSED</Text>
              <Text style={styles.modalSubheading}>Match Difficulty: {difficulty}</Text>

              <View style={styles.leaderboardBox}>
                <Text style={styles.leaderboardTitle}>🏆 TOP 10 FRENZY SCORES</Text>
                <ScrollView style={{ maxHeight: 120 }}>
                  {leaderboard.map((item, index) => (
                    <Text key={item.id || index} style={styles.leaderboardRow}>
                      {index + 1}. {item.initials} — {item.score} PTS ({item.team_played || 'FRENZY'})
                    </Text>
                  ))}
                  {leaderboard.length === 0 && <Text style={{ color: '#80B3B8', textAlign: 'center', fontSize: 12 }}>No scores yet.</Text>}
                </ScrollView>
              </View>

              <View style={styles.settingRow}>
                <View>
                  <Text style={styles.settingTitle}>Arena Music</Text>
                  <Text style={styles.settingDesc}>Background soundtrack</Text>
                </View>
                <Switch value={musicEnabled} onValueChange={setMusicEnabled} trackColor={{ false: '#00333A', true: '#FFB800' }} thumbColor={musicEnabled ? '#001E22' : '#80B3B8'} />
              </View>

              <View style={styles.settingRow}>
                <View>
                  <Text style={styles.settingTitle}>Sound Effects</Text>
                  <Text style={styles.settingDesc}>Puck clangs, saves & horn</Text>
                </View>
                <Switch value={sfxEnabled} onValueChange={setSfxEnabled} trackColor={{ false: '#00333A', true: '#FFB800' }} thumbColor={sfxEnabled ? '#001E22' : '#80B3B8'} />
              </View>

              <TouchableOpacity style={styles.resumeBtn} onPress={() => setIsPaused(false)}>
                <Text style={styles.resumeBtnText}>RESUME SHOOTOUT ➔</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.exitBtn} onPress={() => { setIsPaused(false); restartGame(); }}>
                <Text style={styles.exitBtnText}>Change Difficulty / Mode</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* GAME OVER MODAL */}
        <Modal visible={gameOver} transparent animationType="slide" onRequestClose={() => { setGameOver(false); restartGame(); }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setGameOver(false); restartGame(); }}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.modalHeading}>SHOOTOUT FINAL</Text>
              <Text style={styles.modalSubheading}>You tallied {score} points on {difficulty} mode!</Text>

              <View style={styles.leaderboardBox}>
                <Text style={styles.leaderboardTitle}>🏆 TOP 10 FRENZY SCORES</Text>
                <ScrollView style={{ maxHeight: 120 }}>
                  {leaderboard.map((item, index) => (
                    <Text key={item.id || index} style={styles.leaderboardRow}>
                      {index + 1}. {item.initials} — {item.score} PTS ({item.team_played || 'FRENZY'})
                    </Text>
                  ))}
                  {leaderboard.length === 0 && <Text style={{ color: '#80B3B8', textAlign: 'center', fontSize: 12 }}>No recorded scores yet. Be the first!</Text>}
                </ScrollView>
              </View>

              <TextInput
                style={styles.initialsInput}
                maxLength={4}
                placeholder="INITIALS"
                placeholderTextColor="#80B3B8"
                value={initials}
                onChangeText={setInitials}
                autoCapitalize="characters"
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveScore} disabled={saving}>
                <Text style={styles.submitBtnText}>{saving ? 'RECORDING...' : 'SUBMIT SCORE ➔'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.playAgainBtn} onPress={restartGame}>
                <Text style={styles.playAgainText}>↺ Pick Difficulty & Shoot Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#D7EDF5' },
  bgContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backgroundImage: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(0, 24, 26, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: '#004D57',
    zIndex: 10,
  },
  menuBtn: {
    backgroundColor: '#00333A',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#004D57',
  },
  menuBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  titleContainer: { alignItems: 'center' },
  title: { color: '#FFB800', fontWeight: '900', fontSize: 15, letterSpacing: 0.8 },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreContainer: {
    backgroundColor: '#00333A',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  scoreText: { color: '#FFB800', fontWeight: '900', fontSize: 13 },
  pauseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#00333A',
    borderWidth: 1,
    borderColor: '#FFB800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseBtnText: { color: '#FFB800', fontSize: 14, fontWeight: '900' },
  hudBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 38, 43, 0.90)',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#004D57',
    zIndex: 10,
  },
  hudBox: { alignItems: 'center' },
  hudLabel: { color: '#80B3B8', fontSize: 9, fontWeight: '800' },
  hudVal: { color: '#FFF', fontSize: 14, fontWeight: '900', marginTop: 2 },
  fieldContainer: {
    flex: 1,
    position: 'relative',
    width: width,
  },
  creaseAnchor: {
    position: 'absolute',
    top: '48%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  goalieContainer: {
    width: 156,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalieSprite: { width: 156, height: 164 },
  resultBanner: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 24, 26, 0.95)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFB800',
    zIndex: 5,
  },
  resultBannerText: { color: '#FFF', fontWeight: '900', fontSize: 16, textAlign: 'center' },
  puckStartingZone: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  aimIndicator: { alignItems: 'center', marginBottom: 12 },
  aimArrow: { color: '#004D57', fontSize: 20, fontWeight: '900' },
  aimText: { color: '#004D57', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  puckWrapper: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  puckShadow: {
    position: 'absolute',
    bottom: 2,
    width: 52,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  puckDisc: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puckCore: { width: 36, height: 18, borderRadius: 9, backgroundColor: '#002B30' },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.01)',
    zIndex: 99,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 15, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  difficultyCard: {
    backgroundColor: '#00262B',
    width: '90%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFB800',
    padding: 24,
    alignItems: 'center',
  },
  diffSelectBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#001E22',
    borderWidth: 1.5,
    borderColor: '#004D57',
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  diffSelectTitle: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  diffSelectDesc: { color: '#80B3B8', fontSize: 11, fontWeight: '600', marginTop: 4 },
  pauseCard: {
    backgroundColor: '#00262B',
    width: '90%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFB800',
    padding: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#003D47',
    paddingBottom: 10,
  },
  settingTitle: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  settingDesc: { color: '#80B3B8', fontSize: 10, marginTop: 2 },
  resumeBtn: {
    backgroundColor: '#FFB800',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  resumeBtnText: { color: '#001E22', fontWeight: '900', fontSize: 14 },
  exitBtn: {
    backgroundColor: '#00333A',
    width: '100%',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  exitBtnText: { color: '#80B3B8', fontWeight: '800', fontSize: 13 },
  modalCard: {
    backgroundColor: '#00262B',
    width: '90%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFB800',
    padding: 22,
    alignItems: 'center',
    position: 'relative',
  },
  modalCloseBtn: { position: 'absolute', top: 12, right: 14, padding: 6, zIndex: 10 },
  modalCloseBtnText: { color: '#80B3B8', fontSize: 18, fontWeight: '900' },
  modalHeading: { color: '#FFB800', fontSize: 21, fontWeight: '900', marginBottom: 4 },
  modalSubheading: { color: '#80B3B8', fontSize: 13, fontWeight: '600', marginBottom: 14, textAlign: 'center' },
  leaderboardBox: {
    backgroundColor: '#001E22',
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#004D57',
    marginBottom: 14,
  },
  leaderboardTitle: { color: '#FFB800', fontSize: 12, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  leaderboardRow: { color: '#E0F0F2', fontSize: 12, fontWeight: '700', marginVertical: 2, textAlign: 'center' },
  initialsInput: {
    width: '80%',
    height: 48,
    backgroundColor: '#00181A',
    borderWidth: 1.5,
    borderColor: '#005461',
    borderRadius: 10,
    color: '#FFB800',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#FFB800',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnText: { color: '#001E22', fontWeight: '900', fontSize: 13 },
  playAgainBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  playAgainText: { color: '#80B3B8', fontSize: 13, fontWeight: '800' },
});