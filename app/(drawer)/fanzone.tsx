import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 40) / GRID_COLUMNS;

type FanZoneTab = 'CHANTS' | 'GALLERY' | 'CHAT' | 'GAMES';

interface ChantItem {
  id: string;
  title: string;
  category: 'GENERAL' | 'CALL & RESPONSE' | 'ARENA TRADITION';
  lyrics: string;
  tempo: string;
  tip?: string;
}

const CHANTS_LIST: ChantItem[] = [
  {
    id: '1',
    title: 'Defend The Reef',
    category: 'GENERAL',
    lyrics: 'DEFEND! (clap clap)\nTHE REEF! (clap clap)\nDEFEND! THE! REEF! 🦈🪸',
    tempo: 'Fast & Loud',
    tip: 'Initiated from Section 108 drum beat.',
  },
  {
    id: '2',
    title: "Let's Go 'Cuda",
    category: 'GENERAL',
    lyrics: "LET'S GO 'CUDA! 👏 👏  👏👏👏\nLET'S GO 'CUDA! 👏 👏  👏👏👏",
    tempo: 'Steady 4/4 March',
    tip: 'Standard rally chant during whistle breaks.',
  },
  {
    id: '3',
    title: 'BAR-RA CU-DA (Clap Clap)',
    category: 'GENERAL',
    lyrics: 'BAR-RA! CU-DA! 👏 👏  👏👏👏\nBAR-RA! CU-DA! 👏 👏  👏👏👏',
    tempo: 'Steady 4/4 Rhythm',
    tip: 'Rhythmic arena-wide pack chant.',
  },
  {
    id: '4',
    title: 'BARRA-CUDA! (Back & Forth)',
    category: 'CALL & RESPONSE',
    lyrics: 'Avid Chanter: "BARRA!"\nFans: "CUDA!"\n\nAvid Chanter: "BARRA!"\nFans: "CUDA!"\n\nAvid Chanter: "BARRA!"\nFans: "CUDA!"\n\nAvid Chanter: "MAKE SOME NOISE!"\n(🗣️ Yell, Cheer, Whistle! 🥁🎉)',
    tempo: 'Call & Response (Building Volume)',
    tip: 'Section leader calls out through the megaphone to rally the entire arena.',
  },
  {
    id: '5',
    title: 'How Much Time Is Left?',
    category: 'ARENA TRADITION',
    lyrics: '⏰ At 1:04 remaining in the period, Section 108 yells out:\n"Hey Schimmel, how much time is left?!"\n\n📢 After Schimmel announces:\n"One minute remaining in the period."\n\n🗣️ Section 108 responds in unison:\n"THANK YOU!"',
    tempo: 'Timed Tradition (1:04 on clock)',
    tip: 'Shouted directly to PA Announcer Schimmel at the end of every period.',
  },
];

export default function FanzoneScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<FanZoneTab>(
    params.tab === 'GALLERY' ? 'GALLERY' : params.tab === 'CHAT' ? 'CHAT' : params.tab === 'GAMES' ? 'GAMES' : 'CHANTS'
  );

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [chantTitle, setChantTitle] = useState('');
  const [chantLyrics, setChantLyrics] = useState('');
  const [chantTempo, setChantTempo] = useState('');
  const [submittingChant, setSubmittingChant] = useState(false);
  const chantCategories = ['ALL', 'GENERAL', 'CALL & RESPONSE', 'ARENA TRADITION'];


  useEffect(() => {
    if (params.tab === 'GALLERY') setActiveTab('GALLERY');
    else if (params.tab === 'CHAT') setActiveTab('CHAT');
    else if (params.tab === 'GAMES') setActiveTab('GAMES');
  }, [params.tab]);

  const handleSubmitChant = async () => {
    if (!chantTitle.trim() || !chantLyrics.trim()) {
      Alert.alert('Incomplete Form', 'Please provide at least a chant title and the lyrics.');
      return;
    }

    setSubmittingChant(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const payload = {
        user_id: currentSession?.user?.id || null,
        submitter_name: currentSession?.user?.email ? currentSession.user.email.split('@')[0] : 'Supporter 108',
        contact_email: currentSession?.user?.email || null,
        chant_title: chantTitle.trim(),
        chant_lyrics: chantLyrics.trim(),
        melody_inspiration: chantTempo.trim() || null,
      };

      const { error } = await supabase.from('chant_submissions').insert([payload]);
      if (error) throw error;

      Alert.alert('Chant Submitted! 📢', 'Thanks for fueling SJ Battery Pack! Your idea has been sent directly to the team.');
      setModalVisible(false);
      setChantTitle('');
      setChantLyrics('');
      setChantTempo('');
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not send submission.');
    } finally {
      setSubmittingChant(false);
    }
  };

  const filteredChants = activeCategory === 'ALL'
    ? CHANTS_LIST
    : CHANTS_LIST.filter((c) => c.category === activeCategory);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['left', 'right']}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Segmented Top Tab Bar */}
      <View style={[styles.topTabBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'CHANTS' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('CHANTS')}
        >
          <Text 
            numberOfLines={1} 
            adjustsFontSizeToFit 
            style={[styles.topTabText, { color: activeTab === 'CHANTS' ? '#001417' : theme.subText }]}
          >
            🗣️ Chants
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'GALLERY' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('GALLERY')}
        >
          <Text 
            numberOfLines={1} 
            adjustsFontSizeToFit 
            style={[styles.topTabText, { color: activeTab === 'GALLERY' ? '#001417' : theme.subText }]}
          >
            📸 Gallery
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'GAMES' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('GAMES')}
        >
          <Text 
            numberOfLines={1} 
            adjustsFontSizeToFit 
            style={[styles.topTabText, { color: activeTab === 'GAMES' ? '#001417' : theme.subText }]}
          >
            🎮 Games
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'CHAT' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('CHAT')}
        >
          <Text 
            numberOfLines={1} 
            adjustsFontSizeToFit 
            style={[styles.topTabText, { color: activeTab === 'CHAT' ? '#001417' : theme.subText }]}
          >
            💬 Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: 🗣️ CHANTS */}
      {activeTab === 'CHANTS' && (
        <ScrollView contentContainerStyle={[styles.scrollPadding, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
          <View style={[styles.headerBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>SJ BATTERY PACK CHANTS</Text>
            <Text style={[styles.bannerSubtitle, { color: theme.text }]}>
              The Official Songbook & Traditions 🪸
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitPromptCard, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.submitPromptLeft}>
              <Text style={styles.submitPromptIcon}>🥁</Text>
              <View>
                <Text style={[styles.submitPromptTitle, { color: theme.accentGold }]}>Have a Chant Idea?</Text>
                <Text style={[styles.submitPromptSub, { color: theme.subText }]}>Submit your lyrics to the Section 108 boosters</Text>
              </View>
            </View>
            <Text style={[styles.submitPromptAction, { color: theme.accentOrange }]}>Submit ➔</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {chantCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterPill,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  activeCategory === cat && { backgroundColor: theme.accentGold, borderColor: theme.accentGold },
                ]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: theme.subText },
                    activeCategory === cat && { color: '#001417', fontWeight: '900' },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredChants.map((chant) => (
            <View key={chant.id} style={[styles.chantCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.chantTitle, { color: theme.text }]}>{chant.title}</Text>
                <View style={[styles.categoryBadge, { backgroundColor: theme.subCardBg, borderColor: theme.accentGold }]}>
                  <Text style={[styles.categoryBadgeText, { color: theme.accentGold }]}>{chant.category}</Text>
                </View>
              </View>

              <View style={[styles.lyricsContainer, { backgroundColor: theme.isDark ? '#001417' : '#E6ECEE', borderLeftColor: theme.accentOrange }]}>
                <Text style={[styles.lyricsText, { color: theme.text }]}>{chant.lyrics}</Text>
              </View>

              <View style={[styles.cardFooter, { borderTopColor: theme.borderColor }]}>
                <Text style={[styles.tempoText, { color: theme.subText }]}>
                  🥁 <Text style={{ color: theme.accentGold, fontWeight: '700' }}>Tempo:</Text> {chant.tempo}
                </Text>
                {chant.tip && <Text style={[styles.tipText, { color: theme.subText }]}>💡 {chant.tip}</Text>}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* TAB 2: 📸 GALLERY DIRECT ENTRY */}
      {activeTab === 'GALLERY' && (
        <View style={[styles.chatGateContainer, { paddingBottom: Math.max(insets.bottom + 20, 24) }]}>
          <View style={[styles.chatGateCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📸</Text>
            <Text style={[styles.chatGateTitle, { color: theme.accentGold }]}>The Reef Fan Gallery</Text>
            <Text style={[styles.chatGateSub, { color: theme.subText }]}>
              Browse and share gameday photos with fellow supporters, leave likes, and drop comments on your favorite shots!
            </Text>
            <TouchableOpacity
              style={[styles.chatGateButton, { backgroundColor: theme.accentOrange }]}
              onPress={() => router.push('/(drawer)/gallery')}
            >
              <Text style={styles.chatGateButtonText}>Open Gallery ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* TAB 3: 🎮 MINI GAMES ARCADE HUB */}
      {activeTab === 'GAMES' && (
        <ScrollView contentContainerStyle={[styles.scrollPadding, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
          <View style={[styles.headerBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>🎮 SJ Battery Pack Arcade</Text>
            <Text style={[styles.bannerSubtitle, { color: theme.text }]}>
              Play intermission games & climb the Leaderboards!
            </Text>
          </View>

          {/* 1. Puck Drop */}
          <TouchableOpacity
            style={[styles.gameCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            onPress={() => router.push('/game/puckdrop')}
            activeOpacity={0.85}
          >
            <View style={styles.gameCardHeader}>
              <Text style={styles.gameCardIcon}>🏒</Text>
              <View style={styles.gameTextContainer}>
                <Text style={[styles.gameCardTitle, { color: theme.accentGold }]}>Puck Drop (Air Hockey)</Text>
                <Text style={[styles.gameCardSub, { color: theme.subText }]} numberOfLines={2}>
                  Battle Pacific Division rivals in 60s regulation or Sudden Death OT!
                </Text>
              </View>
              <View style={styles.gameActionContainer}>
                <Text style={[styles.gameCardAction, { color: theme.accentOrange }]}>Play ➔</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 2. Zamboni Dash */}
          <TouchableOpacity
            style={[styles.gameCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            onPress={() => router.push('/game/zambonidash')}
            activeOpacity={0.85}
          >
            <View style={styles.gameCardHeader}>
              <Text style={styles.gameCardIcon}>🛞</Text>
              <View style={styles.gameTextContainer}>
                <Text style={[styles.gameCardTitle, { color: theme.accentGold }]}>Zamboni Dash</Text>
                <Text style={[styles.gameCardSub, { color: theme.subText }]} numberOfLines={2}>
                  Drive up the ice collecting Teal Gems while dodging stray hockey sticks!
                </Text>
              </View>
              <View style={styles.gameActionContainer}>
                <Text style={[styles.gameCardAction, { color: theme.accentOrange }]}>Play ➔</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 3. Frenzy's Penalty Shot */}
          <TouchableOpacity
            style={[styles.gameCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            onPress={() => router.push('/game/frenzyshot')}
            activeOpacity={0.85}
          >
            <View style={styles.gameCardHeader}>
              <Text style={styles.gameCardIcon}>🥅</Text>
              <View style={styles.gameTextContainer}>
                <Text style={[styles.gameCardTitle, { color: theme.accentGold }]}>Frenzy's Penalty Shot</Text>
                <Text style={[styles.gameCardSub, { color: theme.subText }]} numberOfLines={2}>
                  Test your accuracy in a 5-shot shootout against the mascot goalie!
                </Text>
              </View>
              <View style={styles.gameActionContainer}>
                <Text style={[styles.gameCardAction, { color: theme.accentOrange }]}>Play ➔</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 4. The Great Cuda Catch - Disabled & Grayed Out */}
          <TouchableOpacity
            style={[
              styles.gameCard,
              styles.disabledGameCard,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor }
            ]}
            disabled={true}
            activeOpacity={1}
          >
            <View style={styles.gameCardHeader}>
              <Text style={[styles.gameCardIcon, styles.disabledIcon]}>🪸</Text>
              <View style={styles.gameTextContainer}>
                <Text style={[styles.gameCardTitle, styles.disabledText]}>The Great Cuda Catch</Text>
                <Text style={[styles.gameCardSub, styles.disabledSubText]} numberOfLines={2}>
                  Slide your catcher's mitt to catch good fan gear while dodging bad items!
                </Text>
              </View>
              <View style={styles.gameActionContainer}>
                <View style={[styles.soonBadge, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.soonBadgeText, { color: theme.subText }]}>SOON</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* TAB 4: 💬 CHAT DIRECT ENTRY */}
      {activeTab === 'CHAT' && (
        <View style={[styles.chatGateContainer, { paddingBottom: Math.max(insets.bottom + 20, 24) }]}>
          <View style={[styles.chatGateCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
            <Text style={[styles.chatGateTitle, { color: theme.accentGold }]}>SJ Battery Pack Chat</Text>
            <Text style={[styles.chatGateSub, { color: theme.subText }]}>
              Connect with fellow supporters in real-time. Share gameday reactions, away trip coordination, tickets, and prospect discussions!
            </Text>
            <TouchableOpacity
              style={[styles.chatGateButton, { backgroundColor: theme.accentOrange }]}
              onPress={() => router.push('/(drawer)/chat')}
            >
              <Text style={styles.chatGateButtonText}>Launch Live Chat ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Chant Submission Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            <Text style={[styles.modalHeaderTitle, { color: theme.accentGold }]}>🥁 SUBMIT A CHANT IDEA</Text>
            <Text style={[styles.modalHeaderSub, { color: theme.subText }]}>
              Got a rally call or taunt for Section 108? Send it directly to the drum line and booster leadership!
            </Text>

            <Text style={[styles.inputLabel, { color: theme.subText }]}>Chant Title / Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="e.g. The Shark Bite Rally"
              placeholderTextColor="#80B3B8"
              value={chantTitle}
              onChangeText={setChantTitle}
            />

            <Text style={[styles.inputLabel, { color: theme.subText }]}>Tempo / Drum Beat Cues</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="e.g. Fast 4/4 clapping rhythm"
              placeholderTextColor="#80B3B8"
              value={chantTempo}
              onChangeText={setChantTempo}
            />

            <Text style={[styles.inputLabel, { color: theme.subText }]}>Lyrics / Call & Response Breakdown</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="Type out the chant verses, clap cues, or megaphone calls..."
              placeholderTextColor="#80B3B8"
              multiline={true}
              numberOfLines={4}
              value={chantLyrics}
              onChangeText={setChantLyrics}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.borderColor }]}
                onPress={() => setModalVisible(false)}
                disabled={submittingChant}
              >
                <Text style={[styles.cancelBtnText, { color: theme.subText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendIdeaBtn, { backgroundColor: theme.accentOrange }]}
                onPress={handleSubmitChant}
                disabled={submittingChant}
              >
                {submittingChant ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendIdeaBtnText}>Submit Chant 🪸</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topTabBar: { 
    flexDirection: 'row', 
    padding: 4, 
    marginHorizontal: 10, 
    marginTop: 8, 
    borderRadius: 12, 
    borderWidth: 1 
  },
  topTabButton: { 
    flex: 1, 
    paddingVertical: 8, 
    paddingHorizontal: 2, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 8 
  },
  topTabText: { 
    fontSize: 11.5, 
    fontWeight: '800' 
  },
  scrollPadding: { padding: 14, paddingBottom: 40 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBanner: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1, alignItems: 'center' },
  bannerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  bannerSubtitle: { fontSize: 12, textAlign: 'center', fontWeight: '600', marginTop: 2 },
  submitPromptCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  submitPromptLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitPromptIcon: { fontSize: 24 },
  submitPromptTitle: { fontSize: 14, fontWeight: '900' },
  submitPromptSub: { fontSize: 11, fontWeight: '600' },
  submitPromptAction: { fontSize: 13, fontWeight: '900' },
  filterRow: { gap: 8, paddingBottom: 12 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterText: { fontSize: 11, fontWeight: '700' },
  chantCard: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  chantTitle: { fontSize: 15, fontWeight: '900', flex: 1, marginRight: 8 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  categoryBadgeText: { fontSize: 9, fontWeight: '900' },
  lyricsContainer: { padding: 12, borderRadius: 10, borderLeftWidth: 3, marginVertical: 4 },
  lyricsText: { fontSize: 13, fontWeight: '700', lineHeight: 22, fontFamily: 'monospace' },
  cardFooter: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, gap: 4 },
  tempoText: { fontSize: 11 },
  tipText: { fontSize: 11, fontStyle: 'italic' },

  gameCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  disabledGameCard: { opacity: 0.55 },
  gameCardHeader: { flexDirection: 'row', alignItems: 'center' },
  gameCardIcon: { fontSize: 32 },
  disabledIcon: { opacity: 0.6 },
  gameTextContainer: { flex: 1, marginLeft: 12, marginRight: 10 },
  gameCardTitle: { fontSize: 15, fontWeight: '900' },
  gameCardSub: { fontSize: 11, fontWeight: '600', marginTop: 2, lineHeight: 16 },
  disabledText: { color: '#80B3B8' },
  disabledSubText: { color: '#557A80' },
  gameActionContainer: { justifyContent: 'center', alignItems: 'flex-end', minWidth: 55 },
  gameCardAction: { fontSize: 13, fontWeight: '900' },
  soonBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  soonBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },





  chatGateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  chatGateCard: { width: '100%', padding: 26, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  chatGateTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  chatGateSub: { fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 18 },
  chatGateButton: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  chatGateButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 18 },
  modalHeaderTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  modalHeaderSub: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 14, lineHeight: 16 },
  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 5 },
  input: { padding: 10, borderRadius: 8, borderWidth: 1, fontSize: 13, marginBottom: 10 },
  textArea: { padding: 10, borderRadius: 8, borderWidth: 1, fontSize: 13, minHeight: 80, textAlignVertical: 'top', marginBottom: 14 },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700' },
  sendIdeaBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sendIdeaBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});