import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  AppState,
  Animated,
  Switch,
  PanResponder,
} from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Matter from 'matter-js';
import { useRouter } from 'expo-router'; 
import { Audio } from 'expo-av';
import { CircleRenderer, WallRenderer } from '../../game-engines/components/Physics';
import { supabase } from '../../supabase';

const { width, height } = Dimensions.get('window');
const RINK_WIDTH = width - 16;
const RINK_HEIGHT = height - 100;

const GOAL_WIDTH = 110; 
const GOAL_LEFT = (RINK_WIDTH - GOAL_WIDTH) / 2;
const GOAL_RIGHT = GOAL_LEFT + GOAL_WIDTH;
const FACEOFF_CIRCLE_SIZE = 76;
const MAX_PUCK_SPEED = 9.0;
const FIXED_TIMESTEP = 1000 / 60;

const BGM_AUDIO = require('../../assets/audio/frenzyshot-bgm.mp3');
const GOAL_AUDIO = require('../../assets/audio/goal-cheer.mp3');
const HORN_AUDIO = require('../../assets/audio/goal-horn.mp3');

const BANNED_WORDS = [
  'FUCK', 'SHIT', 'DICK', 'COCK', 'PUSS', 'CUNT', 'ASS', 'BITCH',
  'SLUT', 'HELL', 'DAMN', 'PISS', 'TITS', 'CRAP', 'FAG', 'TWAT', 'WANK', 'JISM'
];

const validateInitials = (input: string): boolean => {
  const clean = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/1/g, 'I')
    .replace(/3/g, 'E')
    .replace(/4/g, 'A')
    .replace(/0/g, 'O')
    .replace(/5/g, 'S');

  for (const word of BANNED_WORDS) {
    if (clean.includes(word)) return false;
  }
  return true;
};

const PACIFIC_TEAMS = [
  { name: 'Abbotsford Canucks', abbrev: 'ABB', color: '#00205B' },
  { name: 'Bakersfield Condors', abbrev: 'BAK', color: '#FF671F' },
  { name: 'Calgary Wranglers', abbrev: 'CGY', color: '#C8102E' },
  { name: 'Coachella Valley Firebirds', abbrev: 'CV', color: '#D54A2B' },
  { name: 'Colorado Eagles', abbrev: 'COL', color: '#002D62' },
  { name: 'Henderson Silver Knights', abbrev: 'HSK', color: '#8A8D8F' },
  { name: 'Ontario Reign', abbrev: 'ONT', color: '#A2AAAD' },
  { name: 'San Diego Gulls', abbrev: 'SD', color: '#002855' },
  { name: 'Tucson Roadrunners', abbrev: 'TUC', color: '#8C1D40' },
];

export default function PuckDropScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  
  const [gameMode, setGameMode] = useState<'EXHIBITION' | 'TOURNAMENT'>('EXHIBITION');
  const [tournamentRound, setTournamentRound] = useState(1);
  const [opponent, setOpponent] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isOvertime, setIsOvertime] = useState(false);
  
  const [isPaused, setIsPaused] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const [overtimeModalVisible, setOvertimeModalVisible] = useState(false);
  const [gameOverModalVisible, setGameOverModalVisible] = useState(false);
  const [resumeModalVisible, setResumeModalVisible] = useState(false);
  const [savedGameState, setSavedGameState] = useState<any>(null);

  const [initials, setInitials] = useState('');
  const [savingScore, setSavingScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const boardOriginX = useRef((width - RINK_WIDTH) / 2);
  const boardOriginY = useRef(110);
  const rinkRef = useRef<View>(null);

  const targetX = useRef(RINK_WIDTH / 2);
  const targetY = useRef(RINK_HEIGHT - 90);
  const prevTargetX = useRef(RINK_WIDTH / 2);
  const prevTargetY = useRef(RINK_HEIGHT - 90);

  const otFinishedRef = useRef(false);
  const hornTriggeredRef = useRef(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const entitiesRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);

  const bgmSoundRef = useRef<Audio.Sound | null>(null);
  const cheerTimerRef = useRef<any>(null);
  const hornSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function initBgm() {
      try {
        const { sound } = await Audio.Sound.createAsync(BGM_AUDIO, { isLooping: true, volume: 0.35 });
        if (isMounted) {
          bgmSoundRef.current = sound;
          if (musicEnabled && !isPaused && !gameOverModalVisible) {
            await sound.playAsync();
          }
        }
      } catch (err) {
        console.warn('Puck drop audio warning:', err);
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
      if (musicEnabled && !isPaused && !gameOverModalVisible) {
        bgmSoundRef.current.playAsync();
      } else {
        bgmSoundRef.current.pauseAsync();
      }
    } catch {}
  }, [musicEnabled, isPaused, gameOverModalVisible]);

  const triggerGoalCheer = async () => {
    if (!sfxEnabled) return;
    try {
      if (bgmSoundRef.current && musicEnabled) await bgmSoundRef.current.pauseAsync();
      if (cheerTimerRef.current) clearTimeout(cheerTimerRef.current);

      const { sound } = await Audio.Sound.createAsync(GOAL_AUDIO, { volume: 0.85 });
      await sound.playAsync();

      cheerTimerRef.current = setTimeout(async () => {
        await sound.unloadAsync();
        if (musicEnabled && !isPaused && !gameOverModalVisible && bgmSoundRef.current) {
          await bgmSoundRef.current.playAsync();
        }
      }, 3000);
    } catch (e) {}
  };

  const triggerQuietHorn = async () => {
    if (!sfxEnabled || hornTriggeredRef.current) return;
    hornTriggeredRef.current = true;
    try {
      if (hornSoundRef.current) {
        await hornSoundRef.current.stopAsync();
        await hornSoundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(HORN_AUDIO, { volume: 0.33 });
      hornSoundRef.current = sound;
      await sound.playAsync();
      setTimeout(async () => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch {}
      }, 3000);
    } catch (e) {}
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const relativeX = pageX - boardOriginX.current;
        const relativeY = pageY - boardOriginY.current;

        const clampedX = Math.max(34, Math.min(RINK_WIDTH - 34, relativeX));
        const clampedY = Math.max(RINK_HEIGHT / 2 + 25, Math.min(RINK_HEIGHT - 34, relativeY));

        targetX.current = clampedX;
        targetY.current = clampedY;
        prevTargetX.current = clampedX;
        prevTargetY.current = clampedY;
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const relativeX = pageX - boardOriginX.current;
        const relativeY = pageY - boardOriginY.current;

        prevTargetX.current = targetX.current;
        prevTargetY.current = targetY.current;

        targetX.current = Math.max(34, Math.min(RINK_WIDTH - 34, relativeX));
        targetY.current = Math.max(RINK_HEIGHT / 2 + 25, Math.min(RINK_HEIGHT - 34, relativeY));
      },
      onPanResponderRelease: () => {
        prevTargetX.current = targetX.current;
        prevTargetY.current = targetY.current;
      },
    })
  ).current;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        if (bgmSoundRef.current) bgmSoundRef.current.pauseAsync();
        if (gameActive) {
          setGameActive(false);
          setSavedGameState({
            playerScore,
            aiScore,
            timeLeft,
            isOvertime,
            opponent,
            gameMode,
            tournamentRound,
          });
        }
      } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (bgmSoundRef.current && musicEnabled) bgmSoundRef.current.playAsync();
        if (savedGameState) setResumeModalVisible(true);
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [gameActive, playerScore, aiScore, timeLeft, isOvertime, opponent, gameMode, tournamentRound, savedGameState, musicEnabled]);

  useEffect(() => {
    let timer: any;
    if (gameActive && timeLeft > 0 && !isPaused && !overtimeModalVisible) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameActive && !isPaused && !overtimeModalVisible) {
      if (playerScore === aiScore && !isOvertime) {
        setGameActive(false);
        if (entitiesRef.current) {
          const { puck, player, ai } = entitiesRef.current;
          stopAllVelocity(puck?.body, player?.body, ai?.body);
        }
        setIsOvertime(true);
        setOvertimeModalVisible(true);
      } else {
        setGameActive(false);
        triggerQuietHorn();
        fetchLeaderboard();
        setGameOverModalVisible(true);
      }
    }
    return () => clearInterval(timer);
  }, [gameActive, timeLeft, playerScore, aiScore, isOvertime, isPaused, overtimeModalVisible]);

  let goalScored = false;
  let resetTimer = 0;
  let serveTargetY = RINK_HEIGHT / 2; 

  const triggerScreenShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const PhysicsAndAISystem = (entities: any) => {
    if (!entities.physics?.engine) return entities;

    Matter.Engine.update(entities.physics.engine, FIXED_TIMESTEP);

    if (gameActive && !isPaused && !overtimeModalVisible && entities.player?.body) {
      const player = entities.player.body;
      const curX = player.position.x;
      const curY = player.position.y;
      const destX = targetX.current;
      const destY = targetY.current;

      const diffX = destX - curX;
      const diffY = destY - curY;
      const dist = Math.sqrt(diffX * diffX + diffY * diffY);

      const MAX_STEP = 32;
      let nextX = destX;
      let nextY = destY;

      if (dist > MAX_STEP) {
        nextX = curX + (diffX / dist) * MAX_STEP;
        nextY = curY + (diffY / dist) * MAX_STEP;
      }

      Matter.Body.setPosition(player, { x: nextX, y: nextY });
    }

    if (gameActive && !isPaused && !overtimeModalVisible && entities.ai?.body && entities.puck?.body) {
      const ai = entities.ai.body;
      const puck = entities.puck.body;
      const maxSpeed = entities.aiMaxSpeed || 2.2;

      let aiTargetX = Math.max(50, Math.min(RINK_WIDTH - 50, puck.position.x));
      let aiTargetY = 90;

      if (puck.position.y < RINK_HEIGHT / 2) {
        aiTargetY = Math.max(48, Math.min(RINK_HEIGHT / 2 - 35, puck.position.y));
      }

      const dx = aiTargetX - ai.position.x;
      const dy = aiTargetY - ai.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 4) {
        const moveX = (dx / dist) * Math.min(dist, maxSpeed);
        const moveY = (dy / dist) * Math.min(dist, maxSpeed);
        Matter.Body.setPosition(ai, {
          x: Math.max(42, Math.min(RINK_WIDTH - 42, ai.position.x + moveX)),
          y: Math.max(42, Math.min(RINK_HEIGHT / 2 - 28, ai.position.y + moveY)),
        });
      }
    }

    return entities;
  };

  const PhysicsSpeedClampSystem = (entities: any) => {
    if (!entities.puck?.body) return entities;

    const puck = entities.puck.body;
    const currentSpeed = Math.sqrt(puck.velocity.x * puck.velocity.x + puck.velocity.y * puck.velocity.y);

    if (currentSpeed > MAX_PUCK_SPEED) {
      const ratio = MAX_PUCK_SPEED / currentSpeed;
      Matter.Body.setVelocity(puck, {
        x: puck.velocity.x * ratio,
        y: puck.velocity.y * ratio,
      });
    }

    return entities;
  };

  const GoalDetectionSystem = (entities: any, { time }: any) => {
    if (!gameActive || isPaused || overtimeModalVisible || !entities.puck) return entities;

    const puckBody = entities.puck.body;
    const playerBody = entities.player?.body;
    const aiBody = entities.ai?.body;
    const puckX = puckBody.position.x;

    if (!goalScored && !otFinishedRef.current) {
      if (puckBody.position.y < 38) {
        if (puckX >= GOAL_LEFT && puckX <= GOAL_RIGHT) {
          goalScored = true;
          serveTargetY = 150; 
          setPlayerScore((prev) => prev + 1);
          triggerGoalCheer();
          stopAllVelocity(puckBody, playerBody, aiBody);
          triggerScreenShake();

          if (isOvertime) {
            otFinishedRef.current = true;
            setGameActive(false);
            Matter.Body.setPosition(puckBody, { x: RINK_WIDTH / 2, y: 15 });
            stopAllVelocity(puckBody, playerBody, aiBody);

            triggerQuietHorn();
            setTimeout(() => {
              fetchLeaderboard();
              setGameOverModalVisible(true);
            }, 500);
            return entities;
          }
        } else {
          Matter.Body.setVelocity(puckBody, { x: puckBody.velocity.x, y: Math.abs(puckBody.velocity.y) });
        }
      } else if (puckBody.position.y > RINK_HEIGHT - 38) {
        if (puckX >= GOAL_LEFT && puckX <= GOAL_RIGHT) {
          goalScored = true;
          serveTargetY = RINK_HEIGHT - 150; 
          setAiScore((prev) => prev + 1);
          stopAllVelocity(puckBody, playerBody, aiBody);
          triggerScreenShake();

          if (isOvertime) {
            otFinishedRef.current = true;
            setGameActive(false);
            Matter.Body.setPosition(puckBody, { x: RINK_WIDTH / 2, y: RINK_HEIGHT - 15 });
            stopAllVelocity(puckBody, playerBody, aiBody);

            triggerQuietHorn();
            setTimeout(() => {
              fetchLeaderboard();
              setGameOverModalVisible(true);
            }, 500);
            return entities;
          }
        } else {
          Matter.Body.setVelocity(puckBody, { x: puckBody.velocity.x, y: -Math.abs(puckBody.velocity.y) });
        }
      }
    }

    if (goalScored && !isOvertime) {
      stopAllVelocity(puckBody, playerBody, aiBody);
      if (resetTimer === 0) {
        Matter.Body.setPosition(puckBody, { x: RINK_WIDTH / 2, y: serveTargetY });
        if (playerBody) Matter.Body.setPosition(playerBody, { x: RINK_WIDTH / 2, y: RINK_HEIGHT - 90 });
        if (aiBody) Matter.Body.setPosition(aiBody, { x: RINK_WIDTH / 2, y: 90 });
      }

      resetTimer += time.delta;

      if (resetTimer >= 600) {
        goalScored = false;
        resetTimer = 0;
        const randomX = (Math.random() - 0.5) * 1.5;
        Matter.Body.setVelocity(puckBody, { x: randomX, y: serveTargetY < RINK_HEIGHT / 2 ? 0.7 : -0.7 });
      }
    }

    return entities;
  };

  const stopAllVelocity = (puck: any, player: any, ai: any) => {
    if (puck) {
      Matter.Body.setVelocity(puck, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(puck, 0);
    }
    if (player) Matter.Body.setVelocity(player, { x: 0, y: 0 });
    if (ai) Matter.Body.setVelocity(ai, { x: 0, y: 0 });
  };

  const handleStartOvertime = () => {
    setOvertimeModalVisible(false);
    setTimeLeft(30);
    otFinishedRef.current = false;
    hornTriggeredRef.current = false;

    if (entitiesRef.current) {
      const { puck, player, ai } = entitiesRef.current;
      if (puck) {
        Matter.Body.setPosition(puck.body, { x: RINK_WIDTH / 2, y: RINK_HEIGHT / 2 });
        Matter.Body.setVelocity(puck.body, { x: 0, y: 0 });
      }
      if (player) Matter.Body.setPosition(player.body, { x: RINK_WIDTH / 2, y: RINK_HEIGHT - 90 });
      if (ai) Matter.Body.setPosition(ai.body, { x: RINK_WIDTH / 2, y: 90 });
    }

    setTimeout(() => {
      setGameActive(true);
      if (entitiesRef.current?.puck) {
        const randomX = (Math.random() - 0.5) * 2.0;
        Matter.Body.setVelocity(entitiesRef.current.puck.body, { x: randomX, y: 2.2 });
      }
    }, 300);
  };

  const handleResumeGame = () => {
    if (savedGameState) {
      setPlayerScore(savedGameState.playerScore);
      setAiScore(savedGameState.aiScore);
      setTimeLeft(savedGameState.timeLeft);
      setIsOvertime(savedGameState.isOvertime);
      setOpponent(savedGameState.opponent);
      setGameMode(savedGameState.gameMode);
      setTournamentRound(savedGameState.tournamentRound);
      setSavedGameState(null);
      setResumeModalVisible(false);
      setGameActive(true);
    }
  };

  const handleDiscardSavedGame = () => {
    setSavedGameState(null);
    setResumeModalVisible(false);
  };

  const setupWorld = () => {
    const engine = Matter.Engine.create({ enableSleeping: false });
    engine.gravity.y = 0; 
    engine.gravity.x = 0;
    const world = engine.world;

    const aiSpeed = gameMode === 'TOURNAMENT' ? 2.3 + (tournamentRound * 0.2) : 2.0;

    const playerMallet = Matter.Bodies.circle(RINK_WIDTH / 2, RINK_HEIGHT - 90, 24, { 
      isStatic: true,
      restitution: 1.0,
      friction: 0,
      label: 'player',
    });

    const aiMallet = Matter.Bodies.circle(RINK_WIDTH / 2, 90, 24, { 
      isStatic: true,
      restitution: 1.0,
      friction: 0,
      label: 'ai',
    });

    const hockeyPuck = Matter.Bodies.circle(RINK_WIDTH / 2, RINK_HEIGHT / 2, 14, { 
      restitution: 0.95, 
      frictionAir: 0.0015, 
      friction: 0.001,
      density: 0.001, 
      label: 'puck',
    });

    const leftWall = Matter.Bodies.rectangle(-25, RINK_HEIGHT / 2, 60, RINK_HEIGHT, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(RINK_WIDTH + 25, RINK_HEIGHT / 2, 60, RINK_HEIGHT, { isStatic: true });

    const wallSegmentWidth = GOAL_LEFT;
    const topWallLeft = Matter.Bodies.rectangle(wallSegmentWidth / 2, -10, wallSegmentWidth, 50, { isStatic: true });
    const topWallRight = Matter.Bodies.rectangle(RINK_WIDTH - (wallSegmentWidth / 2), -10, wallSegmentWidth, 50, { isStatic: true });
    const bottomWallLeft = Matter.Bodies.rectangle(wallSegmentWidth / 2, RINK_HEIGHT + 10, wallSegmentWidth, 50, { isStatic: true });
    const bottomWallRight = Matter.Bodies.rectangle(RINK_WIDTH - (wallSegmentWidth / 2), RINK_HEIGHT + 10, wallSegmentWidth, 50, { isStatic: true });

    const cornerSize = 48;
    const topLeftCorner = Matter.Bodies.rectangle(14, 14, cornerSize, 14, { isStatic: true, angle: Math.PI / 4 });
    const topRightCorner = Matter.Bodies.rectangle(RINK_WIDTH - 14, 14, cornerSize, 14, { isStatic: true, angle: -Math.PI / 4 });
    const bottomLeftCorner = Matter.Bodies.rectangle(14, RINK_HEIGHT - 14, cornerSize, 14, { isStatic: true, angle: -Math.PI / 4 });
    const bottomRightCorner = Matter.Bodies.rectangle(RINK_WIDTH - 14, RINK_HEIGHT - 14, cornerSize, 14, { isStatic: true, angle: Math.PI / 4 });

    Matter.World.add(world, [
      playerMallet, aiMallet, hockeyPuck,
      leftWall, rightWall, topWallLeft, topWallRight, bottomWallLeft, bottomWallRight,
      topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner,
    ]);

    setTimeout(() => {
      setGameActive(true);
      const randomX = (Math.random() - 0.5) * 2.0;
      Matter.Body.setVelocity(hockeyPuck, { x: randomX, y: 2.4 });
    }, 400);

    Matter.Events.on(engine, 'collisionStart', (event: any) => {
      event.pairs.forEach((pair: any) => {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.includes('puck')) {
          let collidingMallet = null;
          let isPlayerHit = false;

          if (labels.includes('player')) {
            collidingMallet = pair.bodyA.label === 'player' ? pair.bodyA : pair.bodyB;
            isPlayerHit = true;
          } else if (labels.includes('ai')) {
            collidingMallet = pair.bodyA.label === 'ai' ? pair.bodyA : pair.bodyB;
          }

          if (collidingMallet) {
            const dx = hockeyPuck.position.x - collidingMallet.position.x;
            const dy = hockeyPuck.position.y - collidingMallet.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;

            let launchForce = 7.5;
            if (isPlayerHit) {
              const swipeSpeed = Math.sqrt(
                Math.pow(targetX.current - prevTargetX.current, 2) +
                Math.pow(targetY.current - prevTargetY.current, 2)
              );
              launchForce = Math.min(MAX_PUCK_SPEED, 7.2 + swipeSpeed * 0.35);
            }

            Matter.Body.setVelocity(hockeyPuck, { 
              x: (dx / distance) * launchForce, 
              y: (dy / distance) * launchForce 
            });
          }
        }
      });
    });

    const entities: any = {
      physics: { engine, world },
      player: { body: playerMallet, color: '#266B73', renderer: CircleRenderer }, 
      ai: { body: aiMallet, color: opponent ? opponent.color : '#C0392B', renderer: CircleRenderer }, 
      puck: { body: hockeyPuck, color: '#000000', renderer: CircleRenderer },
      left: { body: leftWall, color: 'transparent', renderer: WallRenderer },
      right: { body: rightWall, color: 'transparent', renderer: WallRenderer },
      aiMaxSpeed: aiSpeed,
    };

    entitiesRef.current = entities;
    return entities;
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('arcade_high_scores')
        .select('*')
        .eq('game_type', 'PUCK_DROP')
        .order('score', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        setLeaderboard(data);
      } else {
        setLeaderboard([]);
      }
    } catch {
      setLeaderboard([]);
    }
  };

  const handleSaveScore = async () => {
    const cleanInitials = initials.trim().toUpperCase();

    if (cleanInitials.length < 2 || cleanInitials.length > 4) {
      Alert.alert("Invalid Entry", "Your initials must be between 2 to 4 letters long.");
      return;
    }

    if (!validateInitials(cleanInitials)) {
      Alert.alert("Inappropriate Name 🛑", "Please enter family-friendly initials.");
      return;
    }

    try {
      setSavingScore(true);
      const { data: authData } = await supabase.auth.getSession();
      const currentUserId = authData?.session?.user?.id || null;

      const { error } = await supabase
        .from('arcade_high_scores')
        .insert([{
          user_id: currentUserId,
          initials: cleanInitials,
          score: playerScore,
          team_played: opponent?.abbrev || 'OPP',
          game_type: 'PUCK_DROP',
        }]);

      if (error) throw error;

      if (currentUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('puckdrop_high_score')
          .eq('id', currentUserId)
          .single();

        const currentBest = profile?.puckdrop_high_score || 0;
        if (playerScore > currentBest) {
          await supabase
            .from('profiles')
            .update({
              puckdrop_high_score: playerScore,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentUserId);
        }
      }

      Alert.alert("Score Saved!", "Your puck drop total has been saved & synced to your account.");
      await fetchLeaderboard();
      setGameOverModalVisible(false);
      resetEntireGame();
    } catch (err) {
      Alert.alert("Upload Error", "Could not reach the database. Please try again.");
    } finally {
      setSavingScore(false);
    }
  };

  const resetEntireGame = () => {
    goalScored = false;
    resetTimer = 0;
    otFinishedRef.current = false;
    hornTriggeredRef.current = false;
    setPlayerScore(0);
    setAiScore(0);
    setTimeLeft(60);
    setIsOvertime(false);
    setOvertimeModalVisible(false);
    setGameActive(false);
    setIsPaused(false);
    setOpponent(null);
    setTournamentRound(1);
    setInitials('');
    targetX.current = RINK_WIDTH / 2;
    targetY.current = RINK_HEIGHT - 90;
    prevTargetX.current = RINK_WIDTH / 2;
    prevTargetY.current = RINK_HEIGHT - 90;
    setGameKey((k) => k + 1); 
  };

  if (!opponent) {
    return (
      <SafeAreaView style={styles.menuContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#002F35" />

        <View style={styles.menuHeaderRow}>
          <TouchableOpacity style={styles.exitPillBtn} onPress={() => router.back()}>
            <Text style={styles.exitPillText}>← Exit</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <Text style={styles.menuTitle}>Puck Drop Arcade</Text>
        
        <View style={styles.modeToggleRow}>
          <TouchableOpacity 
            style={[styles.modeTab, gameMode === 'EXHIBITION' && styles.modeTabActive]} 
            onPress={() => setGameMode('EXHIBITION')}
          >
            <Text style={[styles.modeTabText, gameMode === 'EXHIBITION' && styles.modeTabActiveText]}>Exhibition</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modeTab, gameMode === 'TOURNAMENT' && styles.modeTabActive]} 
            onPress={() => setGameMode('TOURNAMENT')}
          >
            <Text style={[styles.modeTabText, gameMode === 'TOURNAMENT' && styles.modeTabActiveText]}>🏆 Cup Run</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.menuSubtitle}>
          {gameMode === 'TOURNAMENT' ? `Tournament Mode — Round ${tournamentRound} of 2` : 'Select Your Opponent'}
        </Text>
        
        <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }}>
          {PACIFIC_TEAMS.map((team, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={[
                styles.menuButton, 
                { 
                  borderLeftWidth: 10, 
                  borderLeftColor: team.color,
                  borderTopColor: '#005461',
                  borderRightColor: '#005461',
                  borderBottomColor: '#005461',
                }
              ]} 
              onPress={() => {
                setOpponent(team);
                setGameKey((k) => k + 1);
              }}
            >
              <View style={styles.menuButtonRow}>
                <View style={[styles.colorPip, { backgroundColor: team.color }]} />
                <Text style={styles.menuButtonText}>🏒 {team.name} ({team.abbrev})</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const topFaceoffY = RINK_HEIGHT * 0.18;
  const bottomFaceoffY = RINK_HEIGHT * 0.82;
  const leftFaceoffX = RINK_WIDTH * 0.22;
  const rightFaceoffX = RINK_WIDTH * 0.78;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#002F35" />
      
      <View style={[styles.headerControls, { paddingTop: Math.max(insets.top, 4) }]}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <TouchableOpacity style={styles.controlButton} onPress={() => router.back()}>
            <Text style={styles.controlButtonText}>← Exit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlButton, { backgroundColor: '#00333A' }]} onPress={resetEntireGame}>
            <Text style={styles.controlButtonText}>Teams</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>🏒 {gameMode === 'TOURNAMENT' ? `R${tournamentRound} ` : ''}{isOvertime ? 'OT: ' : ''}SJBP {playerScore} - {aiScore} {opponent.abbrev}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <View style={[styles.timerContainer, isOvertime && { backgroundColor: '#C0392B' }]}>
            <Text style={styles.timerText}>⏳ {timeLeft}s{isOvertime ? ' 🔥' : ''}</Text>
          </View>

          <TouchableOpacity
            style={styles.pauseBtn}
            onPress={() => {
              fetchLeaderboard();
              setIsPaused(true);
            }}
            disabled={gameOverModalVisible}
          >
            <Text style={styles.pauseBtnText}>⏸</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View 
        ref={rinkRef}
        onLayout={() => {
          rinkRef.current?.measure((x, y, w, h, pageX, pageY) => {
            if (pageX !== undefined) boardOriginX.current = pageX;
            if (pageY !== undefined) boardOriginY.current = pageY;
          });
        }}
        style={[styles.rinkSurface, { transform: [{ translateX: shakeAnim }] }]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.blueLine, { top: RINK_HEIGHT * 0.33 }]} />
        <View style={[styles.blueLine, { bottom: RINK_HEIGHT * 0.33 }]} />
        <View style={styles.centerLine} />
        <View style={styles.centerCircleOutline}><View style={styles.centerDot} /></View>
        <View style={[styles.fullGoalLine, { top: 38 }]} />
        <View style={[styles.fullGoalLine, { bottom: 38 }]} />
        <View style={[styles.goalCrease, { top: 38, left: (RINK_WIDTH - GOAL_WIDTH) / 2, width: GOAL_WIDTH }]} />
        <View style={[styles.goalCrease, { bottom: 38, left: (RINK_WIDTH - GOAL_WIDTH) / 2, width: GOAL_WIDTH, transform: [{ rotate: '180deg' }] }]} />

        <View style={[styles.largeFaceoffCircle, { top: topFaceoffY - (FACEOFF_CIRCLE_SIZE/2), left: leftFaceoffX - (FACEOFF_CIRCLE_SIZE/2) }]}><View style={styles.faceoffDotInternal} /></View>
        <View style={[styles.largeFaceoffCircle, { top: topFaceoffY - (FACEOFF_CIRCLE_SIZE/2), left: rightFaceoffX - (FACEOFF_CIRCLE_SIZE/2) }]}><View style={styles.faceoffDotInternal} /></View>
        <View style={[styles.largeFaceoffCircle, { top: bottomFaceoffY - (FACEOFF_CIRCLE_SIZE/2), left: leftFaceoffX - (FACEOFF_CIRCLE_SIZE/2) }]}><View style={styles.faceoffDotInternal} /></View>
        <View style={[styles.largeFaceoffCircle, { top: bottomFaceoffY - (FACEOFF_CIRCLE_SIZE/2), left: rightFaceoffX - (FACEOFF_CIRCLE_SIZE/2) }]}><View style={styles.faceoffDotInternal} /></View>

        <View style={{ flex: 1 }} pointerEvents="none">
          <GameEngine
            key={gameKey}
            style={styles.gameCanvas}
            systems={[PhysicsAndAISystem, PhysicsSpeedClampSystem, GoalDetectionSystem]}
            entities={setupWorld()}
            running={gameActive && !isPaused && !overtimeModalVisible}
          />
        </View>
      </Animated.View>

      {/* PAUSE MODAL */}
      <Modal visible={isPaused} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.pauseCard}>
            <Text style={styles.pauseCardTitle}>GAME PAUSED</Text>
            <Text style={styles.pauseCardSub}>Arena Audio & Top Drivers</Text>

            <View style={styles.leaderboardBox}>
              <Text style={styles.leaderboardTitle}>🏆 TOP 10 PUCK DROP PLAYERS</Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {leaderboard.map((item, index) => (
                  <Text key={item.id || index} style={styles.leaderboardRow}>
                    {index + 1}. {item.initials} — {item.score} Goals ({item.team_played || 'OPP'})
                  </Text>
                ))}
                {leaderboard.length === 0 && <Text style={{ color: '#80B3B8', textAlign: 'center', fontSize: 12 }}>No entries recorded yet.</Text>}
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
                <Text style={styles.settingDesc}>Goal cheers and game horn</Text>
              </View>
              <Switch
                value={sfxEnabled}
                onValueChange={setSfxEnabled}
                trackColor={{ false: '#00333A', true: '#FFB800' }}
                thumbColor={sfxEnabled ? '#001E22' : '#80B3B8'}
              />
            </View>

            <TouchableOpacity style={styles.resumeBtn} onPress={() => setIsPaused(false)}>
              <Text style={styles.resumeBtnText}>RESUME MATCH ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quitBtn}
              onPress={() => {
                setIsPaused(false);
                resetEntireGame();
              }}
            >
              <Text style={styles.quitBtnText}>Exit to Opponent Select</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* OVERTIME MODAL */}
      <Modal visible={overtimeModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { borderColor: '#C0392B', borderWidth: 3 }]}>
            <Text style={[styles.modalHeader, { color: '#C0392B', fontSize: 26 }]}>🚨 SUDDEN DEATH OT! 🚨</Text>
            <Text style={[styles.modalSub, { fontSize: 16, marginTop: 4 }]}>
              Regulation ended in a {playerScore} - {aiScore} tie!
            </Text>

            <View style={styles.otAlertBox}>
              <Text style={styles.otRuleText}>⏱️ <Text style={{ fontWeight: '900' }}>30 Seconds</Text> on the clock.</Text>
              <Text style={styles.otRuleText}>⚡ <Text style={{ fontWeight: '900', color: '#C0392B' }}>Next Goal Wins</Text> the game!</Text>
            </View>

            <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#C0392B', marginTop: 10 }]} onPress={handleStartOvertime}>
              <Text style={[styles.submitButtonText, { fontSize: 16 }]}>Start Overtime Faceoff ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* GAME OVER MODAL */}
      <Modal 
        visible={gameOverModalVisible} 
        transparent={true} 
        animationType="slide" 
        onRequestClose={() => { setGameOverModalVisible(false); resetEntireGame(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { position: 'relative' }]}>
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => { setGameOverModalVisible(false); resetEntireGame(); }}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalHeader}>🚨 BUZZER SOUNDS! 🚨</Text>
            <Text style={styles.modalSub}>Final Score: SJBP {playerScore} - {aiScore} {opponent?.abbrev} {isOvertime ? '(OT)' : ''}</Text>
            
            <View style={styles.leaderboardBox}>
              <Text style={styles.leaderboardTitle}>🏆 TOP 10 PUCK DROP SCORES</Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {leaderboard.map((item, index) => (
                  <Text key={item.id || index} style={styles.leaderboardRow}>
                    {index + 1}. {item.initials} — {item.score} Goals ({item.team_played || 'OPP'})
                  </Text>
                ))}
                {leaderboard.length === 0 && <Text style={{ color: '#888', textAlign: 'center', fontSize: 12 }}>No score entries loaded.</Text>}
              </ScrollView>
            </View>

            <Text style={styles.inputLabel}>Enter Initials (2-4 Letters max):</Text>
            <TextInput
              style={styles.nameInput}
              maxLength={4}
              autoCapitalize="characters"
              placeholder="NAME"
              placeholderTextColor="#9BA0A3"
              value={initials}
              onChangeText={setInitials}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleSaveScore} disabled={savingScore}>
              <Text style={styles.submitButtonText}>{savingScore ? "Uploading..." : "Save Score"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#7F8C8D', marginTop: 8 }]} onPress={() => { setGameOverModalVisible(false); resetEntireGame(); }}>
              <Text style={styles.submitButtonText}>Discard & Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#002F35' },
  menuContainer: { flex: 1, backgroundColor: '#002F35', padding: 20, paddingTop: 10 },
  menuHeaderRow: { width: '100%', marginBottom: 10 },
  exitPillBtn: { alignSelf: 'flex-start', backgroundColor: '#00434B', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#006D7A' },
  exitPillText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  menuTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 1, marginBottom: 14, textAlign: 'center' },
  menuSubtitle: { color: '#A0C4C7', fontSize: 14, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  
  modeToggleRow: { flexDirection: 'row', backgroundColor: '#001E22', borderRadius: 12, padding: 4, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: '#9BA0A3' },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  modeTabActive: { backgroundColor: '#FFB800' },
  modeTabText: { color: '#80B3B8', fontSize: 13, fontWeight: '800' },
  modeTabActiveText: { color: '#001417', fontWeight: '900' },

  menuButton: { 
    backgroundColor: '#00434B', 
    width: '100%', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 10, 
    borderWidth: 1,
    overflow: 'hidden'
  },
  menuButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorPip: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  menuButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  headerControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 4, backgroundColor: '#002F35' },
  controlButton: { backgroundColor: '#00434B', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#9BA0A3' },
  controlButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  scoreContainer: { backgroundColor: '#000000', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
  scoreText: { color: '#00FFCC', fontSize: 13, fontWeight: '900' },
  timerContainer: { backgroundColor: '#DD8943', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8 },
  timerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  pauseBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#00434B', borderWidth: 1, borderColor: '#FFB800', justifyContent: 'center', alignItems: 'center' },
  pauseBtnText: { color: '#FFB800', fontSize: 13, fontWeight: '900' },
  rinkSurface: { width: RINK_WIDTH, height: RINK_HEIGHT, alignSelf: 'center', backgroundColor: '#FAFCFC', borderWidth: 5, borderColor: '#7F8C8D', position: 'relative', overflow: 'hidden', borderRadius: 40, marginTop: 2 },
  centerLine: { position: 'absolute', top: RINK_HEIGHT / 2 - 2, width: '100%', height: 4, backgroundColor: '#C0392B', opacity: 0.8 },
  blueLine: { position: 'absolute', width: '100%', height: 5, backgroundColor: '#2980B9', opacity: 0.8 },
  centerCircleOutline: { position: 'absolute', top: (RINK_HEIGHT - 80) / 2, left: (RINK_WIDTH - 80) / 2, width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#2980B9', justifyContent: 'center', alignItems: 'center', opacity: 0.5 },
  centerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2980B9' },
  fullGoalLine: { position: 'absolute', width: '100%', height: 2, backgroundColor: '#C0392B', opacity: 0.8 },
  goalCrease: { position: 'absolute', height: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, borderWidth: 2, borderColor: '#2980B9', backgroundColor: '#EBF5FB', opacity: 0.35 },
  largeFaceoffCircle: { position: 'absolute', width: FACEOFF_CIRCLE_SIZE, height: FACEOFF_CIRCLE_SIZE, borderRadius: FACEOFF_CIRCLE_SIZE / 2, borderWidth: 1.5, borderColor: '#C0392B', opacity: 0.5, justifyContent: 'center', alignItems: 'center' },
  faceoffDotInternal: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C0392B' },
  gameCanvas: { flex: 1, backgroundColor: 'transparent' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  pauseCard: { backgroundColor: '#00262B', width: '88%', borderRadius: 16, borderWidth: 1.5, borderColor: '#FFB800', padding: 20 },
  pauseCardTitle: { color: '#FFB800', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  pauseCardSub: { color: '#80B3B8', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  leaderboardBox: { backgroundColor: '#001E22', padding: 12, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: '#004D57' },
  leaderboardTitle: { fontSize: 12, fontWeight: '900', color: '#FFB800', textAlign: 'center', marginBottom: 6 },
  leaderboardRow: { fontSize: 12, color: '#FFFFFF', fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#003D47' },
  settingTitle: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  settingDesc: { color: '#80B3B8', fontSize: 10, marginTop: 2 },
  resumeBtn: { backgroundColor: '#FFB800', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 14, marginBottom: 8 },
  resumeBtnText: { color: '#001E22', fontWeight: '900', fontSize: 13 },
  quitBtn: { backgroundColor: '#00333A', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  quitBtnText: { color: '#80B3B8', fontSize: 12, fontWeight: '800' },
  modalContainer: { backgroundColor: '#FFFFFF', width: '88%', padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#266B73' },
  modalCloseBtn: { position: 'absolute', top: 12, right: 14, padding: 6, zIndex: 10 },
  modalCloseBtnText: { fontSize: 18, fontWeight: '900', color: '#7F8C8D' },
  modalHeader: { fontSize: 22, fontWeight: '900', color: '#C0392B', textAlign: 'center', marginBottom: 4 },
  modalSub: { fontSize: 14, fontWeight: '700', color: '#000000', textAlign: 'center', marginBottom: 12 },
  otAlertBox: { backgroundColor: '#FADBD8', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E6B0AA', marginVertical: 8, gap: 6 },
  otRuleText: { fontSize: 13, color: '#000000', fontWeight: '600' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#000000', marginBottom: 6 },
  nameInput: { borderWidth: 2, borderColor: '#266B73', borderRadius: 8, padding: 10, fontSize: 16, fontWeight: '900', textAlign: 'center', color: '#000000', backgroundColor: '#F4F6F9', marginBottom: 16 },
  submitButton: { backgroundColor: '#DD8943', padding: 14, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
});