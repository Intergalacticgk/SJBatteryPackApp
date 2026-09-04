import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, TouchableOpacity, StatusBar, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import { SafeAreaView } from 'react-native-safe-area-context';
import Matter from 'matter-js';
import { useRouter } from 'expo-router'; 
import { CircleRenderer, WallRenderer } from '../../game-engines/components/Physics';
import { GameSystems } from '../../game-engines/systems/GameSystems';
import { supabase } from '../../supabase';

const { width, height } = Dimensions.get('window');
const RINK_WIDTH = width - 20;
const RINK_HEIGHT = height - 160;

// 🥅 Goal size locked at half width
const GOAL_WIDTH = 100; 
const GOAL_LEFT = (RINK_WIDTH - GOAL_WIDTH) / 2;
const GOAL_RIGHT = GOAL_LEFT + GOAL_WIDTH;
const FACEOFF_CIRCLE_SIZE = 76;

const PROPHANITY_FILTER = /^(FUCK|SHIT|DICK|COCK|PUSS|CUNT|ASSX|BICH|SLUT|HELL|DAMN|PISS|TITS|CRAP|FAGS|TWAT|WANK|JISM|GOCH)$/i;

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
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  
  const [opponent, setOpponent] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isOvertime, setIsOvertime] = useState(false);
  const [overtimeModalVisible, setOvertimeModalVisible] = useState(false);
  const [gameOverModalVisible, setGameOverModalVisible] = useState(false);
  const [initials, setInitials] = useState('');
  const [savingScore, setSavingScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Ref to hold current game physics entities for manual resets
  const entitiesRef = useRef<any>(null);

  // ⏱️ Main Countdown Loop with Sudden Death Overtime Logic
  useEffect(() => {
    let timer: any;
    if (gameActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameActive) {
      // If regulation ends in a tie and we aren't already in OT, pause game & trigger Overtime Modal
      if (playerScore === aiScore && !isOvertime) {
        setGameActive(false); // ⏸️ Pause the game & physics completely
        if (entitiesRef.current) {
          const { puck, player, ai } = entitiesRef.current;
          stopAllVelocity(puck?.body, player?.body, ai?.body);
        }
        setIsOvertime(true);
        setTimeLeft(30); // 30-second sudden death overtime
        setOvertimeModalVisible(true);
      } else {
        // End the game normally
        setGameActive(false);
        fetchLeaderboard();
        setGameOverModalVisible(true);
      }
    }
    return () => clearInterval(timer);
  }, [gameActive, timeLeft, playerScore, aiScore, isOvertime]);

  let goalScored = false;
  let resetTimer = 0;
  let serveTargetY = RINK_HEIGHT / 2; 

  const GoalDetectionSystem = (entities: any, { time }: any) => {
    if (!gameActive || !entities.puck) return entities;

    const puckBody = entities.puck.body;
    const playerBody = entities.player?.body;
    const aiBody = entities.ai?.body;
    const puckX = puckBody.position.x;

    if (!goalScored) {
      if (puckBody.position.y < 40) {
        if (puckX >= GOAL_LEFT && puckX <= GOAL_RIGHT) {
          goalScored = true;
          serveTargetY = 160; 
          const newScore = playerScore + 1;
          setPlayerScore(newScore);
          stopAllVelocity(puckBody, playerBody, aiBody);

          // ⚡ Sudden Death check: If in Overtime, game ends immediately on a goal!
          if (isOvertime) {
            setGameActive(false);
            setTimeout(() => {
              fetchLeaderboard();
              setGameOverModalVisible(true);
            }, 600);
            return entities;
          }
        } else {
          Matter.Body.setVelocity(puckBody, { x: puckBody.velocity.x, y: Math.abs(puckBody.velocity.y) });
        }
      } else if (puckBody.position.y > RINK_HEIGHT - 40) {
        if (puckX >= GOAL_LEFT && puckX <= GOAL_RIGHT) {
          goalScored = true;
          serveTargetY = RINK_HEIGHT - 160; 
          const newScore = aiScore + 1;
          setAiScore(newScore);
          stopAllVelocity(puckBody, playerBody, aiBody);

          // ⚡ Sudden Death check: If in Overtime, game ends immediately on a goal!
          if (isOvertime) {
            setGameActive(false);
            setTimeout(() => {
              fetchLeaderboard();
              setGameOverModalVisible(true);
            }, 600);
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
        if (playerBody) Matter.Body.setPosition(playerBody, { x: RINK_WIDTH / 2, y: RINK_HEIGHT - 100 });
        if (aiBody) Matter.Body.setPosition(aiBody, { x: RINK_WIDTH / 2, y: 100 });
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

    // 🏒 Reset all bodies to Center Faceoff positions
    if (entitiesRef.current) {
      const { puck, player, ai } = entitiesRef.current;
      if (puck) {
        Matter.Body.setPosition(puck.body, { x: RINK_WIDTH / 2, y: RINK_HEIGHT / 2 });
        Matter.Body.setVelocity(puck.body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(puck.body, 0);
      }
      if (player) {
        Matter.Body.setPosition(player.body, { x: RINK_WIDTH / 2, y: RINK_HEIGHT - 100 });
        Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
      }
      if (ai) {
        Matter.Body.setPosition(ai.body, { x: RINK_WIDTH / 2, y: 100 });
        Matter.Body.setVelocity(ai.body, { x: 0, y: 0 });
      }
    }

    // Resume the game with neutral faceoff velocity
    setTimeout(() => {
      setGameActive(true);
      if (entitiesRef.current?.puck) {
        const randomX = (Math.random() - 0.5) * 2.0;
        Matter.Body.setVelocity(entitiesRef.current.puck.body, { x: randomX, y: 2.2 });
      }
    }, 300);
  };

  const setupWorld = () => {
    const engine = Matter.Engine.create();
    engine.gravity.y = 0; 
    engine.gravity.x = 0;
    const world = engine.world;

    const aiSpeed = 2.0;

    const playerMallet = Matter.Bodies.circle(RINK_WIDTH / 2, RINK_HEIGHT - 100, 25, { frictionAir: 0.05, density: 0.8, label: 'player' });
    const aiMallet = Matter.Bodies.circle(RINK_WIDTH / 2, 100, 25, { frictionAir: 0.05, density: 0.8, label: 'ai' });
    const hockeyPuck = Matter.Bodies.circle(RINK_WIDTH / 2, RINK_HEIGHT / 2, 15, { restitution: 1.0, frictionAir: 0.001, density: 0.001, label: 'puck' });

    const leftWall = Matter.Bodies.rectangle(-25, RINK_HEIGHT / 2, 60, RINK_HEIGHT, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(RINK_WIDTH + 25, RINK_HEIGHT / 2, 60, RINK_HEIGHT, { isStatic: true });

    const wallSegmentWidth = GOAL_LEFT;
    const topWallLeft = Matter.Bodies.rectangle(wallSegmentWidth / 2, -10, wallSegmentWidth, 50, { isStatic: true });
    const topWallRight = Matter.Bodies.rectangle(RINK_WIDTH - (wallSegmentWidth / 2), -10, wallSegmentWidth, 50, { isStatic: true });
    const bottomWallLeft = Matter.Bodies.rectangle(wallSegmentWidth / 2, RINK_HEIGHT + 10, wallSegmentWidth, 50, { isStatic: true });
    const bottomWallRight = Matter.Bodies.rectangle(RINK_WIDTH - (wallSegmentWidth / 2), RINK_HEIGHT + 10, wallSegmentWidth, 50, { isStatic: true });

    Matter.World.add(world, [playerMallet, aiMallet, hockeyPuck, leftWall, rightWall, topWallLeft, topWallRight, bottomWallLeft, bottomWallRight]);

    setTimeout(() => {
      setGameActive(true);
      const randomX = (Math.random() - 0.5) * 2.5;
      Matter.Body.setVelocity(hockeyPuck, { x: randomX, y: 2.8 });
    }, 400);

    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        
        if (labels.includes('puck')) {
          let collidingMallet = null;

          if (labels.includes('player')) {
            collidingMallet = pair.bodyA.label === 'player' ? pair.bodyA : pair.bodyB;
          } else if (labels.includes('ai')) {
            collidingMallet = pair.bodyA.label === 'ai' ? pair.bodyA : pair.bodyB;
          }

          if (collidingMallet) {
            const dx = hockeyPuck.position.x - collidingMallet.position.x;
            const dy = hockeyPuck.position.y - collidingMallet.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const launchForce = 8.5; 
            
            Matter.Body.setVelocity(hockeyPuck, { 
              x: (dx / distance) * launchForce, 
              y: (dy / distance) * launchForce 
            });
          }
        }
      });
    });

    const entities = {
      physics: { engine, world },
      player: { body: playerMallet, color: '#266B73', renderer: <CircleRenderer /> }, 
      ai: { body: aiMallet, color: opponent ? opponent.color : '#C0392B', renderer: <CircleRenderer /> }, 
      puck: { body: hockeyPuck, color: '#000000', renderer: <CircleRenderer /> },
      left: { body: leftWall, color: 'transparent', renderer: <WallRenderer /> },
      right: { body: rightWall, color: 'transparent', renderer: <WallRenderer /> },
      aiMaxSpeed: aiSpeed
    };

    entitiesRef.current = entities;
    return entities;
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('arcade_high_scores')
        .select('*')
        .order('score', { ascending: false })
        .limit(5);

      if (!error && data) {
        setLeaderboard(data);
      }
    } catch {
      setLeaderboard([
        { id: '1', initials: 'TEST', score: playerScore, team_played: opponent?.abbrev || 'OPP' }
      ]);
    }
  };

  const handleSaveScore = async () => {
    const cleanInitials = initials.trim().toUpperCase();

    if (cleanInitials.length < 2 || cleanInitials.length > 4) {
      Alert.alert("Invalid Entry", "Your initials must be between 2 to 4 letters long.");
      return;
    }

    if (PROPHANITY_FILTER.test(cleanInitials)) {
      Alert.alert(
        "Flagged Entry 🛑",
        "Inappropriate names are not allowed on the high score boards. Please change your name entry to save your score safely!"
      );
      return;
    }

    try {
      setSavingScore(true);
      const { error } = await supabase
        .from('arcade_high_scores')
        .insert([{ initials: cleanInitials, score: playerScore, team_played: opponent?.abbrev || 'OPP' }]);

      if (error) throw error;

      Alert.alert("Score Saved!", "Your total has been uploaded successfully.");
      setGameOverModalVisible(false);
      resetEntireGame();
    } catch (err) {
      console.error(err);
      Alert.alert("Upload Error", "Could not reach the database. Please try again.");
    } finally {
      setSavingScore(false);
    }
  };

  const resetEntireGame = () => {
    goalScored = false;
    resetTimer = 0;
    setPlayerScore(0);
    setAiScore(0);
    setTimeLeft(60);
    setIsOvertime(false);
    setOvertimeModalVisible(false);
    setGameActive(false);
    setOpponent(null);
    setInitials('');
    setGameKey(k => k + 1); 
  };

  if (!opponent) {
    return (
      <SafeAreaView style={styles.menuContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#002F35" />
        <Text style={styles.menuTitle}>Puck Drop Pacific Division</Text>
        <Text style={styles.menuSubtitle}>Select Your Opponent</Text>
        
        <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }}>
          {PACIFIC_TEAMS.map((team, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={[styles.menuButton, { borderLeftWidth: 8, borderLeftColor: team.color }]} 
              onPress={() => setOpponent(team)}
            >
              <Text style={styles.menuButtonText}>🏒 {team.name} ({team.abbrev})</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.exitMenuButton} onPress={() => router.back()}>
          <Text style={styles.exitMenuButtonText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const topFaceoffY = RINK_HEIGHT * 0.18;
  const bottomFaceoffY = RINK_HEIGHT * 0.82;
  const leftFaceoffX = RINK_WIDTH * 0.22;
  const rightFaceoffX = RINK_WIDTH * 0.78;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#002F35" />
      
      <View style={styles.headerControls}>
        <TouchableOpacity style={styles.controlButton} onPress={resetEntireGame}><Text style={styles.controlButtonText}>← Menu</Text></TouchableOpacity>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>🏒 {isOvertime ? 'OT: ' : ''}SJBP {playerScore} - {aiScore} {opponent.abbrev}</Text>
        </View>
        <View style={[styles.timerContainer, isOvertime && { backgroundColor: '#C0392B' }]}>
          <Text style={styles.timerText}>⏳ {timeLeft}s{isOvertime ? ' 🔥' : ''}</Text>
        </View>
      </View>

      <View style={styles.rinkSurface}>
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

        <GameEngine
          key={gameKey}
          style={styles.gameCanvas}
          systems={[GameSystems, GoalDetectionSystem]}
          entities={setupWorld()}
          running={gameActive}
        />
      </View>

      {/* 🚨 OVERTIME ACKNOWLEDGMENT MODAL (Freezes game until tapped) */}
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
              <Text style={styles.otRuleText}>🏒 Puck resets to center ice for a fair faceoff.</Text>
            </View>

            <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#C0392B', marginTop: 10 }]} onPress={handleStartOvertime}>
              <Text style={[styles.submitButtonText, { fontSize: 16 }]}>Start Overtime Faceoff ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🏆 GAME OVER & LEADERBOARD MODAL */}
      <Modal visible={gameOverModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalHeader}>🚨 BUZZER SOUNDS! 🚨</Text>
            <Text style={styles.modalSub}>Final Score: SJBP {playerScore} - {aiScore} {opponent.abbrev} {isOvertime ? '(OT)' : ''}</Text>
            
            <View style={styles.leaderboardBox}>
              <Text style={styles.leaderboardTitle}>🏆 LIVE HIGH SCORES</Text>
              {leaderboard.map((item, index) => (
                <Text key={item.id} style={styles.leaderboardRow}>
                  {index + 1}. {item.initials} — {item.score} Goals ({item.team_played})
                </Text>
              ))}
              {leaderboard.length === 0 && <Text style={{ color: '#888', textAlign: 'center' }}>No score tracking entries loaded.</Text>}
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
  menuContainer: { flex: 1, backgroundColor: '#002F35', justifyContent: 'center', alignItems: 'center', padding: 24, paddingTop: 40 },
  menuTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 1, marginBottom: 4, textAlign: 'center' },
  menuSubtitle: { color: '#A0C4C7', fontSize: 14, fontWeight: '600', marginBottom: 24, textAlign: 'center' },
  menuButton: { backgroundColor: '#00434B', width: '100%', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#9BA0A3' },
  menuButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  exitMenuButton: { marginTop: 14 },
  exitMenuButtonText: { color: '#9BA0A3', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  headerControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#002F35' },
  controlButton: { backgroundColor: '#00434B', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#9BA0A3' },
  controlButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  scoreContainer: { backgroundColor: '#000000', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  scoreText: { color: '#00FFCC', fontSize: 15, fontWeight: '900' },
  timerContainer: { backgroundColor: '#DD8943', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  timerText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  rinkSurface: { width: RINK_WIDTH, height: RINK_HEIGHT, marginHorizontal: 10, backgroundColor: '#FAFCFC', borderWidth: 6, borderColor: '#7F8C8D', position: 'relative', overflow: 'hidden', borderRadius: 44, marginBottom: 10 },
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
  modalContainer: { backgroundColor: '#FFFFFF', width: '88%', padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#266B73' },
  modalHeader: { fontSize: 22, fontWeight: '900', color: '#C0392B', textAlign: 'center', marginBottom: 4 },
  modalSub: { fontSize: 14, fontWeight: '700', color: '#000000', textAlign: 'center', marginBottom: 12 },
  otAlertBox: { backgroundColor: '#FADBD8', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E6B0AA', marginVertical: 8, gap: 6 },
  otRuleText: { fontSize: 13, color: '#000000', fontWeight: '600' },
  leaderboardBox: { backgroundColor: '#F4F6F9', padding: 14, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#9BA0A3' },
  leaderboardTitle: { fontSize: 15, fontWeight: '800', color: '#266B73', textAlign: 'center', marginBottom: 8 },
  leaderboardRow: { fontSize: 14, color: '#000000', fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#000000', marginBottom: 6 },
  nameInput: { borderWidth: 2, borderColor: '#266B73', borderRadius: 8, padding: 10, fontSize: 16, fontWeight: '800', textAlign: 'center', color: '#000000', backgroundColor: '#F4F6F9', marginBottom: 16 },
  submitButton: { backgroundColor: '#DD8943', padding: 14, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }
});