import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabase';

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
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  // Submit Chant Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [chantTitle, setChantTitle] = useState('');
  const [chantLyrics, setChantLyrics] = useState('');
  const [chantTempo, setChantTempo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categories = ['ALL', 'GENERAL', 'CALL & RESPONSE', 'ARENA TRADITION'];

  const filteredChants = activeCategory === 'ALL'
    ? CHANTS_LIST
    : CHANTS_LIST.filter((c) => c.category === activeCategory);

  const handleSubmitChant = async () => {
    if (!chantTitle.trim() || !chantLyrics.trim()) {
      Alert.alert('Incomplete Form', 'Please provide at least a chant title and the lyrics.');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const payload = {
        user_id: session?.user?.id || null,
        submitter_name: session?.user?.email ? session.user.email.split('@')[0] : 'Supporter 108',
        contact_email: session?.user?.email || null,
        chant_title: chantTitle.trim(),
        chant_lyrics: chantLyrics.trim(),
        melody_inspiration: chantTempo.trim() || null,
      };

      const { error } = await supabase
        .from('chant_submissions')
        .insert([payload]);

      if (error) throw error;

      Alert.alert(
        'Chant Submitted! 📢',
        'Thanks for fueling Section 108! Your idea has been sent directly to the Battery Pack team for review.'
      );

      setModalVisible(false);
      setChantTitle('');
      setChantLyrics('');
      setChantTempo('');
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not send submission. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      <ScrollView contentContainerStyle={styles.scrollPadding}>
        {/* Banner */}
        <View style={[styles.headerBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>SECTION 108 CHANTS</Text>
          <Text style={[styles.bannerSubtitle, { color: theme.text }]}>
            The Official Songbook & Traditions of the SJ Battery Pack 🪸
          </Text>
        </View>

        {/* Submit Chant Idea Floating Card */}
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

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterPill, 
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                activeCategory === cat && { backgroundColor: theme.accentGold, borderColor: theme.accentGold }
              ]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[
                styles.filterText, 
                { color: theme.subText },
                activeCategory === cat && { color: '#001417', fontWeight: '900' }
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Chant Cards */}
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
              {chant.tip && (
                <Text style={[styles.tipText, { color: theme.subText }]}>💡 {chant.tip}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 📝 Submit Chant Idea Modal */}
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
                disabled={submitting}
              >
                <Text style={[styles.cancelBtnText, { color: theme.subText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendIdeaBtn, { backgroundColor: theme.accentOrange }]}
                onPress={handleSubmitChant}
                disabled={submitting}
              >
                {submitting ? (
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
  scrollPadding: { padding: 14, paddingBottom: 40 },
  headerBanner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  bannerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  bannerSubtitle: { fontSize: 12, textAlign: 'center', fontWeight: '600', marginTop: 2 },
  submitPromptCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
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