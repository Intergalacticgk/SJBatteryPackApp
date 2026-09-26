import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Alert,
  Easing,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { supabase } from '../../supabase';

const { width, height } = Dimensions.get('window');
const LANE_WIDTH = (width - 24) / 3;

const ZAMBONI_WIDTH = 136;
const ZAMBONI_HEIGHT = 88;

const ZAMBONI_IMG = require('../../assets/images/16bit Zamboni.png');

const BGM_AUDIO = require('../../assets/audio/frenzyshot-bgm.mp3');
const DAMAGE_SFX = require('../../assets/audio/damage.mp3');
const GEM_SFX = require('../../assets/audio/gem.mp3');
const HORN_AUDIO = require('../../assets/audio/goal-horn.mp3');

type GameMode = 'TIMED' | 'ENDLESS';

const BANNED_WORDS = [
  'FUCK', 'SHIT', 'DICK', 'COCK', 'PUSS', 'CUNT', 'ASS', 'BITCH',
  'SLUT', 'HELL', 'DAMN', 'PISS', 'TITS', 'CRAP', 'FAG', 'TWAT', 'WANK', 'JISM'
];

const validateInitials = (input: string): boolean => {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const word of BANNED_WORDS) {
    if (clean.includes(word)) return false;
  }
  return true;
};

const SEAMLESS_TILE_HEIGHT = 400;

export default function ZamboniDashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedMode, setSelectedMode] = useState<GameMode>('ENDLESS');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [hearts, setHearts] = useState(4);

  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const [gemsCollected, setGemsCollected] = useState(0);
  const [distance, setDistance] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);

  const distanceRef = useRef(0);
  distanceRef.current = distance;
  const timeLeftRef = useRef(30);
  timeLeftRef.current = timeLeft;
  const selectedModeRef = useRef<GameMode>('ENDLESS');
  selectedModeRef.current = selectedMode;
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const [lane, setLane] = useState(1);
  const laneRef = useRef(1);
  laneRef.current = lane;

  const [rinkHeight, setRinkHeight] = useState(height * 0.7);
  const rinkHeightRef = useRef(height * 0.7);
  rinkHeightRef.current = rinkHeight;
  const playerTargetY = Math.max(100, rinkHeight - (ZAMBONI_HEIGHT + 10));

  const scrollY = useRef(new Animated.Value(0)).current;

  const obstacleProgressY = useRef(new Animated.Value(-120)).current;
  const gemProgressY = useRef(new Animated.Value(-120)).current;
  const gemOpacity = useRef(new Animated.Value(1)).current;

  const [obstacleLane, setObstacleLane] = useState(0);
  const [gemLane, setGemLane] = useState(2);

  const obstacleLaneRef = useRef(0);
  obstacleLaneRef.current = obstacleLane;
  const gemLaneRef = useRef(2);
  gemLaneRef.current = gemLane;

  const currentGemCollected = useRef(false);
  const currentObstacleHit = useRef(false);

  const playerShakeX = useRef(new Animated.Value(0)).current;
  const playerRecoilY = useRef(new Animated.Value(0)).current;
  const [isStunned, setIsStunned] = useState(false);

  const [initials, setInitials] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const bgmSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function initBgm() {
      try {
        const { sound } = await Audio.Sound.createAsync(BGM_AUDIO, { isLooping: true, volume: 0.35 });
        if (isMounted) {
          bgmSoundRef.current = sound;
          if (musicEnabled && isPlaying && !isPaused && !gameOver) {
            await sound.playAsync();
          }
        }
      } catch (err) {
        console.warn('Zamboni BGM init warning:', err);
      }
    }
    initBgm();

    return () => {
      isMounted = false;
      bgmSoundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (!bgmSoundRef.current) return;
    try {
      if (musicEnabled && isPlaying && !isPaused && !gameOver) {
        bgmSoundRef.current.playAsync();
      } else {
        bgmSoundRef.current.pauseAsync();
      }
    } catch {}
  }, [musicEnabled, isPlaying, isPaused, gameOver]);

  const playSfx = async (source: any, volume = 0.85) => {
    if (!sfxEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(source, { volume });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {}
  };

  const playGemSfx = () => playSfx(GEM_SFX, 0.85);
  const playDamageSfx = () => playSfx(DAMAGE_SFX, 0.85);

  const triggerQuietHorn = async () => {
    if (!sfxEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(HORN_AUDIO, { volume: 0.33 });
      await sound.playAsync();
      setTimeout(async () => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch {}
      }, 3000);
    } catch (e) {}
  };

  const fetchLeaderboard = async () => {
    try {
      const { data } = await supabase
        .from('arcade_high_scores')
        .select('*')
        .eq('game_type', 'ZAMBONI_DASH')
        .order('score', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        setLeaderboard(data);
      }
    } catch {
      setLeaderboard([]);
    }
  };

  const getCurrentSpeed = () => {
    if (selectedModeRef.current === 'TIMED') {
      const elapsed = 30 - timeLeftRef.current;
      return Math.max(950, 1700 - elapsed * 25);
    } else {
      const stages = Math.floor(distanceRef.current / 100);
      return Math.max(800, 1750 - stages * 55);
    }
  };

  useEffect(() => {
    if (!isPlaying || isPaused) {
      scrollY.stopAnimation();
      return;
    }

    scrollY.setValue(0);
    const loopAnim = Animated.loop(
      Animated.timing(scrollY, {
        toValue: SEAMLESS_TILE_HEIGHT,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loopAnim.start();

    return () => loopAnim.stop();
  }, [isPlaying, isPaused]);

  useEffect(() => {
    if (!isPlaying || isPaused || selectedMode !== 'TIMED') return;

    if (timeLeft <= 0) {
      triggerGameOver();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, isPaused, timeLeft, selectedMode]);

  useEffect(() => {
    if (!isPlaying || isPaused) return;

    const currentSpeed = getCurrentSpeed();
    const intervalMs = Math.max(65, Math.floor((currentSpeed / 1750) * 120));

    const distTimer = setInterval(() => {
      setDistance((d) => d + 3);
    }, intervalMs);

    return () => clearInterval(distTimer);
  }, [isPlaying, isPaused, Math.floor(distance / 200)]);

  useEffect(() => {
    if (!isPlaying || isPaused) {
      obstacleProgressY.stopAnimation();
      gemProgressY.stopAnimation();
      return;
    }

    let isSubscribed = true;
    let obstacleTimer: any = null;
    let gemTimer: any = null;

    const runObstacleCycle = () => {
      if (!isSubscribed || !isPlayingRef.current || isPausedRef.current) return;

      const randomLane = Math.floor(Math.random() * 3);
      setObstacleLane(randomLane);
      obstacleLaneRef.current = randomLane;
      currentObstacleHit.current = false;
      obstacleProgressY.setValue(-100);

      const animDuration = getCurrentSpeed();
      const targetY = rinkHeightRef.current + 80;

      Animated.timing(obstacleProgressY, {
        toValue: targetY,
        duration: animDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isSubscribed && isPlayingRef.current && !isPausedRef.current) {
          const nextDelay = 300 + Math.random() * 700;
          obstacleTimer = setTimeout(runObstacleCycle, nextDelay);
        }
      });
    };

    const runGemCycle = () => {
      if (!isSubscribed || !isPlayingRef.current || isPausedRef.current) return;

      const randomLane = Math.floor(Math.random() * 3);
      setGemLane(randomLane);
      gemLaneRef.current = randomLane;

      currentGemCollected.current = false;
      gemOpacity.setValue(1);
      gemProgressY.setValue(-100);

      const animDuration = getCurrentSpeed();
      const targetY = rinkHeightRef.current + 80;

      Animated.timing(gemProgressY, {
        toValue: targetY,
        duration: animDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isSubscribed && isPlayingRef.current && !isPausedRef.current) {
          const nextDelay = 350 + Math.random() * 750;
          gemTimer = setTimeout(runGemCycle, nextDelay);
        }
      });
    };

    runObstacleCycle();
    gemTimer = setTimeout(runGemCycle, 450);

    const obsListener = obstacleProgressY.addListener(({ value }) => {
      if (value >= playerTargetY - 45 && value <= playerTargetY + 50) {
        if (!currentObstacleHit.current && laneRef.current === obstacleLaneRef.current) {
          currentObstacleHit.current = true;
          handleObstacleHit();
        }
      }
    });

    const gemListener = gemProgressY.addListener(({ value }) => {
      if (value >= playerTargetY - 50 && value <= playerTargetY + 55) {
        if (!currentGemCollected.current && laneRef.current === gemLaneRef.current) {
          currentGemCollected.current = true;
          gemOpacity.setValue(0);
          playGemSfx();
          setGemsCollected((prev) => prev + 1);
        }
      }
    });

    return () => {
      isSubscribed = false;
      if (obstacleTimer) clearTimeout(obstacleTimer);
      if (gemTimer) clearTimeout(gemTimer);
      obstacleProgressY.removeListener(obsListener);
      gemProgressY.removeListener(gemListener);
      obstacleProgressY.stopAnimation();
      gemProgressY.stopAnimation();
    };
  }, [isPlaying, isPaused]);

  const handleObstacleHit = () => {
    playDamageSfx();
    setIsStunned(true);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(playerRecoilY, { toValue: 12, duration: 90, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(playerShakeX, { toValue: -8, duration: 40, useNativeDriver: true }),
          Animated.timing(playerShakeX, { toValue: 8, duration: 40, useNativeDriver: true }),
          Animated.timing(playerShakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
          Animated.timing(playerShakeX, { toValue: 4, duration: 40, useNativeDriver: true }),
          Animated.timing(playerShakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(playerRecoilY, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setIsStunned(false);
    });

    setHearts((prev) => {
      if (prev <= 1) {
        triggerGameOver();
        return 0;
      }
      return prev - 1;
    });
  };

  const triggerGameOver = () => {
    setIsPlaying(false);
    setIsPaused(false);
    obstacleProgressY.stopAnimation();
    gemProgressY.stopAnimation();
    scrollY.stopAnimation();
    triggerQuietHorn();
    fetchLeaderboard();
    // Delay slightly to prevent trailing touch inputs from dismissing modal
    setTimeout(() => {
      setGameOver(true);
    }, 150);
  };

  const handleStartGame = (mode: GameMode) => {
    setSelectedMode(mode);
    setGemsCollected(0);
    setDistance(0);
    setTimeLeft(30);
    setHearts(4);
    setLane(1);
    gemOpacity.setValue(1);
    currentGemCollected.current = false;
    currentObstacleHit.current = false;
    setGameOver(false);
      setIsPlaying(false);
    setIsPaused(false);
    setIsPlaying(true);
  };

  const togglePause = () => {
    if (!isPaused) {
      fetchLeaderboard();
    }
    setIsPaused((prev) => !prev);
  };

  const handleSaveScore = async () => {
    const clean = initials.trim().toUpperCase();
    if (clean.length < 2 || clean.length > 4 || !validateInitials(clean)) {
      Alert.alert('Invalid Initials', 'Please enter 2-4 clean alphanumeric initials.');
      return;
    }

    const calculatedScore = selectedMode === 'TIMED' ? gemsCollected : distance + gemsCollected * 10;

    try {
      setSaving(true);
      const { data: authData } = await supabase.auth.getSession();
      const currentUserId = authData?.session?.user?.id || null;

      await supabase.from('arcade_high_scores').insert([
        {
          user_id: currentUserId,
          initials: clean,
          score: calculatedScore,
          team_played: selectedMode === 'TIMED' ? 'ZAM-TIME' : 'ZAM-END',
          game_type: 'ZAMBONI_DASH',
        },
      ]);

      if (currentUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('zambonidash_high_score')
          .eq('id', currentUserId)
          .single();

        const currentBest = profile?.zambonidash_high_score || 0;
        if (calculatedScore > currentBest) {
          await supabase
            .from('profiles')
            .update({
              zambonidash_high_score: calculatedScore,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentUserId);
        }
      }

      Alert.alert('Score Submitted!', 'Your dash has been logged on the leaderboard & saved to your account.');
      await fetchLeaderboard();
      setGameOver(false);
    } catch {
      Alert.alert('Save Error', 'Could not record score at this time.');
    } finally {
      setSaving(false);
    }
  };

  const currentLevel = Math.min(10, 1 + Math.floor(distance / 250));

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.back()}>
          <Text style={styles.menuBtnText}>← Exit</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>ZAMBONI DASH</Text>
          <Text style={styles.subTitle}>Tech CU Arena Reef Patrol</Text>
        </View>

        {isPlaying ? (
          <TouchableOpacity style={styles.pauseBtn} onPress={togglePause}>
            <Text style={styles.pauseBtnText}>{isPaused ? '▶' : '⏸'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <View style={styles.hudBar}>
        <View style={styles.heartRow}>
          {[...Array(4)].map((_, i) => (
            <Text key={i} style={styles.heartIcon}>
              {i < hearts ? '❤️' : '🖤'}
            </Text>
          ))}
        </View>

        {selectedMode === 'TIMED' ? (
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TIME LEFT</Text>
            <Text style={[styles.statValue, { color: timeLeft < 10 ? '#FF4D4D' : '#FFB800' }]}>
              {timeLeft}s
            </Text>
          </View>
        ) : (
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DISTANCE (LVL {currentLevel})</Text>
            <Text style={[styles.statValue, { color: '#00E5FF' }]}>{distance} FT</Text>
          </View>
        )}

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>TEAL GEMS</Text>
          <Text style={[styles.statValue, { color: '#00FFCC' }]}>💎 {gemsCollected}</Text>
        </View>
      </View>

      <View
        style={styles.rinkContainer}
        onLayout={(e) => setRinkHeight(e.nativeEvent.layout.height)}
      >
        <Animated.View
          style={[
            styles.iceSurfaceConveyor,
            {
              transform: [{ translateY: scrollY }],
            },
          ]}
        >
          <View style={styles.iceTileBlock}>
            <View style={styles.redGoalLine} />
            <View style={styles.faceoffDotRow}>
              <View style={styles.redFaceoffDot} />
              <View style={styles.redFaceoffDot} />
            </View>
            <View style={styles.blueZoneLine} />
          </View>

          <View style={styles.iceTileBlock}>
            <View style={styles.redGoalLine} />
            <View style={styles.faceoffDotRow}>
              <View style={styles.redFaceoffDot} />
              <View style={styles.redFaceoffDot} />
            </View>
            <View style={styles.blueZoneLine} />
          </View>

          <View style={styles.iceTileBlock}>
            <View style={styles.redGoalLine} />
            <View style={styles.faceoffDotRow}>
              <View style={styles.redFaceoffDot} />
              <View style={styles.redFaceoffDot} />
            </View>
            <View style={styles.blueZoneLine} />
          </View>
        </Animated.View>

        <View style={[styles.laneDivider, { left: LANE_WIDTH }]} />
        <View style={[styles.laneDivider, { left: LANE_WIDTH * 2 }]} />

        {isPlaying && !isPaused && (
          <Animated.View
            style={[
              styles.obstacleSprite,
              {
                left: obstacleLane * LANE_WIDTH + (LANE_WIDTH / 2 - 20),
                transform: [{ translateY: obstacleProgressY }],
              },
            ]}
          >
            <Text style={{ fontSize: 34 }}>🏒</Text>
          </Animated.View>
        )}

        {isPlaying && !isPaused && (
          <Animated.View
            style={[
              styles.gemSprite,
              {
                left: gemLane * LANE_WIDTH + (LANE_WIDTH / 2 - 18),
                transform: [{ translateY: gemProgressY }],
                opacity: gemOpacity,
              },
            ]}
          >
            <Text style={{ fontSize: 30 }}>💎</Text>
          </Animated.View>
        )}

        <Animated.View
          style={[
            styles.zamboniPlayerContainer,
            {
              left: lane * LANE_WIDTH + (LANE_WIDTH / 2 - ZAMBONI_WIDTH / 2),
              transform: [
                { translateX: playerShakeX },
                { translateY: playerRecoilY },
              ],
              opacity: isStunned ? 0.65 : 1,
            },
          ]}
        >
          <Image
            source={ZAMBONI_IMG}
            style={styles.zamboniSprite}
            contentFit="contain"
          />
        </Animated.View>
      </View>

      <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        {!isPlaying ? (
          <View style={styles.startModeContainer}>
            <TouchableOpacity
              style={[styles.modeBtn, selectedMode === 'TIMED' && styles.modeBtnActive]}
              onPress={() => handleStartGame('TIMED')}
            >
              <Text style={styles.modeBtnTitle}>⏱️ 30s DASH</Text>
              <Text style={styles.modeBtnSub}>Rapid gem collector</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, selectedMode === 'ENDLESS' && styles.modeBtnActiveEndless]}
              onPress={() => handleStartGame('ENDLESS')}
            >
              <Text style={styles.modeBtnTitle}>♾️ ENDLESS SHIFT</Text>
              <Text style={styles.modeBtnSub}>Dynamic speed scaling</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.steeringRow}>
            <TouchableOpacity
              style={[styles.steerBtn, lane === 0 && styles.steerBtnDisabled]}
              onPress={() => setLane((l) => Math.max(0, l - 1))}
              disabled={lane === 0 || isPaused}
            >
              <Text style={styles.steerBtnText}>◀ LEFT</Text>
            </TouchableOpacity>

            <View style={styles.laneTracker}>
              <View style={[styles.laneIndicatorDot, lane === 0 && styles.laneActiveDot]} />
              <View style={[styles.laneIndicatorDot, lane === 1 && styles.laneActiveDot]} />
              <View style={[styles.laneIndicatorDot, lane === 2 && styles.laneActiveDot]} />
            </View>

            <TouchableOpacity
              style={[styles.steerBtn, lane === 2 && styles.steerBtnDisabled]}
              onPress={() => setLane((l) => Math.min(2, l + 1))}
              disabled={lane === 2 || isPaused}
            >
              <Text style={styles.steerBtnText}>RIGHT ▶</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* PAUSE MODAL: WITH DEDICATED TOP 10 LEADERBOARD */}
      <Modal visible={isPaused} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.pauseCard}>
            <Text style={styles.modalHeading}>⏸️ SHIFT PAUSED</Text>
            <Text style={styles.modalSubheading}>Audio & Top 10 Drivers</Text>

            <View style={styles.leaderboardBox}>
              <Text style={styles.leaderboardTitle}>🏆 TOP 10 ZAMBONI DRIVERS</Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {leaderboard.map((item, index) => (
                  <Text key={item.id || index} style={styles.leaderboardRow}>
                    {index + 1}. {item.initials} — {item.score} PTS ({item.team_played || 'ZAM'})
                  </Text>
                ))}
                {leaderboard.length === 0 && (
                  <Text style={{ color: '#80B3B8', textAlign: 'center', fontSize: 12 }}>
                    No high scores recorded yet!
                  </Text>
                )}
              </ScrollView>
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingTitle}>Arena Music</Text>
                <Text style={styles.settingDesc}>Background soundtrack</Text>
              </View>
              <Switch
                value={musicEnabled}
                onValueChange={setMusicEnabled}
                trackColor={{ false: '#00333A', true: '#FFB800' }}
                thumbColor={musicEnabled ? '#001E22' : '#80B3B8'}
              />
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingTitle}>Sound Effects</Text>
                <Text style={styles.settingDesc}>Gems, collisions & horn</Text>
              </View>
              <Switch
                value={sfxEnabled}
                onValueChange={setSfxEnabled}
                trackColor={{ false: '#00333A', true: '#FFB800' }}
                thumbColor={sfxEnabled ? '#001E22' : '#80B3B8'}
              />
            </View>

            <TouchableOpacity style={styles.resumeBtn} onPress={togglePause}>
              <Text style={styles.resumeBtnText}>RESUME RUN ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quitBtn}
              onPress={() => {
                setIsPaused(false);
                setIsPlaying(false);
              }}
            >
              <Text style={styles.quitBtnText}>Exit to Mode Select</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* GAME OVER MODAL */}
      <Modal visible={gameOver} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.gameOverCard, { position: 'relative' }]}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setGameOver(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.gameOverTitle}>
              {hearts <= 0 ? '💥 ZAMBONI CRASH!' : '🏁 SHIFT COMPLETE!'}
            </Text>
            <Text style={styles.gameOverSub}>
              {selectedMode === 'TIMED'
                ? `You collected ${gemsCollected} gems in 30 seconds!`
                : `Distance: ${distance} FT with ${gemsCollected} gems collected!`}
            </Text>

            <View style={styles.leaderboardBox}>
              <Text style={styles.leaderboardTitle}>
                🏆 TOP 10 ZAMBONI DRIVERS
              </Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {leaderboard.map((item, idx) => (
                  <Text key={item.id || idx} style={styles.leaderboardRow}>
                    {idx + 1}. {item.initials} — {item.score} PTS ({item.team_played || 'ZAM'})
                  </Text>
                ))}
                {leaderboard.length === 0 && (
                  <Text style={{ color: '#80B3B8', textAlign: 'center', fontSize: 12 }}>
                    No high scores recorded yet!
                  </Text>
                )}
              </ScrollView>
            </View>

            <TextInput
              style={styles.initialsInput}
              maxLength={4}
              placeholder="YOUR INITIALS"
              placeholderTextColor="#80B3B8"
              value={initials}
              onChangeText={setInitials}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSaveScore}
              disabled={saving}
            >
              <Text style={styles.submitBtnText}>
                {saving ? 'RECORDING...' : 'SAVE SCORE ➔'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tryAgainBtn}
              onPress={() => handleStartGame(selectedMode)}
            >
              <Text style={styles.tryAgainText}>↺ Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#001E22' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#00181A',
    borderBottomWidth: 1,
    borderBottomColor: '#00373E',
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
  title: { color: '#FFB800', fontWeight: '900', fontSize: 16, letterSpacing: 0.8 },
  subTitle: { color: '#80B3B8', fontSize: 10, fontWeight: '700' },
  pauseBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#00333A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#004D57',
  },
  pauseBtnText: { color: '#FFB800', fontSize: 16, fontWeight: '900' },
  hudBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#00262B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00373E',
  },
  heartRow: { flexDirection: 'row', gap: 2 },
  heartIcon: { fontSize: 15 },
  statBox: { alignItems: 'center' },
  statLabel: { color: '#80B3B8', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '900' },
  rinkContainer: {
    flex: 1,
    backgroundColor: '#EAF6FA',
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 3,
    borderColor: '#B0D8E6',
  },
  iceSurfaceConveyor: {
    position: 'absolute',
    top: -SEAMLESS_TILE_HEIGHT,
    left: 0,
    right: 0,
    height: SEAMLESS_TILE_HEIGHT * 3,
  },
  iceTileBlock: {
    height: SEAMLESS_TILE_HEIGHT,
    justifyContent: 'space-around',
    paddingVertical: 20,
  },
  redGoalLine: { width: '100%', height: 3, backgroundColor: 'rgba(215, 38, 56, 0.45)' },
  faceoffDotRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  redFaceoffDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(215, 38, 56, 0.35)',
    borderWidth: 2,
    borderColor: 'rgba(215, 38, 56, 0.55)',
  },
  blueZoneLine: { width: '100%', height: 5, backgroundColor: 'rgba(0, 102, 179, 0.45)' },
  laneDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(160, 205, 222, 0.5)',
  },
  obstacleSprite: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  gemSprite: { position: 'absolute', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  zamboniPlayerContainer: {
    position: 'absolute',
    bottom: 24,
    width: ZAMBONI_WIDTH,
    height: ZAMBONI_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  zamboniSprite: { width: ZAMBONI_WIDTH, height: ZAMBONI_HEIGHT },
  bottomControls: {
    backgroundColor: '#00181A',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#00373E',
  },
  startModeContainer: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1,
    backgroundColor: '#00333A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#005461',
  },
  modeBtnActive: { borderColor: '#FFB800', backgroundColor: '#004652' },
  modeBtnActiveEndless: { borderColor: '#00E5FF', backgroundColor: '#004652' },
  modeBtnTitle: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  modeBtnSub: { color: '#80B3B8', fontSize: 10, fontWeight: '600', marginTop: 3 },
  steeringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  steerBtn: {
    flex: 1,
    backgroundColor: '#004D57',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#007A8A',
  },
  steerBtnDisabled: { opacity: 0.35, borderColor: '#00333A' },
  steerBtnText: { color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.6 },
  laneTracker: { flexDirection: 'row', gap: 6, paddingHorizontal: 14 },
  laneIndicatorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00333A' },
  laneActiveDot: { backgroundColor: '#FFB800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 15, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pauseCard: {
    backgroundColor: '#00262B',
    width: '90%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFB800',
    padding: 20,
  },
  modalHeading: { color: '#FFB800', fontSize: 20, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
  modalSubheading: { color: '#80B3B8', fontSize: 12, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#003D47',
  },
  settingTitle: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  settingDesc: { color: '#80B3B8', fontSize: 10, marginTop: 2 },
  resumeBtn: {
    backgroundColor: '#FFB800',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  resumeBtnText: { color: '#001E22', fontWeight: '900', fontSize: 13 },
  quitBtn: {
    backgroundColor: '#00373E',
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  quitBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  gameOverCard: {
    backgroundColor: '#00262B',
    width: '92%',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E74C3C',
    padding: 24,
    alignItems: 'center',
  },
  modalCloseBtn: { position: 'absolute', top: 12, right: 14, padding: 6, zIndex: 10 },
  modalCloseBtnText: { color: '#80B3B8', fontSize: 18, fontWeight: '900' },
  gameOverTitle: { color: '#E74C3C', fontSize: 21, fontWeight: '900', marginBottom: 6 },
  gameOverSub: { color: '#E0F0F2', fontSize: 13, textAlign: 'center', fontWeight: '600', marginBottom: 14 },
  leaderboardBox: {
    width: '100%',
    backgroundColor: '#001E22',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#004D57',
    marginBottom: 12,
  },
  leaderboardTitle: { color: '#FFB800', fontSize: 12, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  leaderboardRow: { color: '#FFF', fontSize: 12, textAlign: 'center', marginVertical: 2, fontWeight: '700' },
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
  tryAgainBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  tryAgainText: { color: '#80B3B8', fontSize: 13, fontWeight: '800' },
});