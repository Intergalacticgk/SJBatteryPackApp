import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 36) / 3;

type FanZoneTab = 'CHANTS' | 'GALLERY' | 'CHAT';

interface ChantItem {
  id: string;
  title: string;
  category: 'GENERAL' | 'CALL & RESPONSE' | 'ARENA TRADITION';
  lyrics: string;
  tempo: string;
  tip?: string;
}

interface GalleryPhoto {
  id: string;
  user_id: string;
  username: string;
  image_url: string;
  caption?: string;
  likes_count: number;
  month_year: string;
  created_at: string;
  hasLiked?: boolean;
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

  // Top Tab State
  const [activeTab, setActiveTab] = useState<FanZoneTab>('CHANTS');

  // --- Chants State ---
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [chantTitle, setChantTitle] = useState('');
  const [chantLyrics, setChantLyrics] = useState('');
  const [chantTempo, setChantTempo] = useState('');
  const [submittingChant, setSubmittingChant] = useState(false);
  const chantCategories = ['ALL', 'GENERAL', 'CALL & RESPONSE', 'ARENA TRADITION'];

  // --- Gallery State ---
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'GRID'>('TIMELINE');
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchGallery(session?.user?.id);
    });

    const channel = supabase
      .channel('public:fan_gallery_fanzone')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fan_gallery' }, () => {
        fetchGallery();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchGallery = async (userId?: string) => {
    setGalleryLoading(true);
    const { data, error } = await supabase
      .from('fan_gallery')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      const currentUid = userId || session?.user?.id;
      if (currentUid) {
        const { data: userLikes } = await supabase
          .from('gallery_likes')
          .select('photo_id')
          .eq('user_id', currentUid);

        const likedIds = new Set(userLikes?.map((l) => l.photo_id));
        setPhotos(data.map((p) => ({ ...p, hasLiked: likedIds.has(p.id) })));
      } else {
        setPhotos(data);
      }
    }
    setGalleryLoading(false);
  };

  const handleUploadPhoto = async () => {
    if (!session?.user) {
      Alert.alert('Sign In Required', 'You must be signed in to contribute photos to the Reef Gallery.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll access is needed to upload photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      setUploadingPhoto(true);
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() || 'jpg';
      const fileName = `${session.user.id}_${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: fileName,
        type: `image/${ext}`,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('gallery-photos')
        .upload(fileName, formData);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('gallery-photos')
        .getPublicUrl(fileName);

      const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const userHandle = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Supporter108';

      await supabase.from('fan_gallery').insert([
        {
          user_id: session.user.id,
          username: userHandle,
          image_url: publicUrlData.publicUrl,
          month_year: monthYear,
        },
      ]);

      Alert.alert('Success! 📸', 'Your photo has been posted to Section 108 Reef Gallery.');
      fetchGallery();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleLike = async (photo: GalleryPhoto) => {
    if (!session?.user) {
      Alert.alert('Sign In Required', 'Sign in to heart supporter photos.');
      return;
    }

    const isLiked = photo.hasLiked;
    const newCount = isLiked ? Math.max(0, photo.likes_count - 1) : photo.likes_count + 1;

    setPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, hasLiked: !isLiked, likes_count: newCount } : p))
    );

    if (isLiked) {
      await supabase.from('gallery_likes').delete().eq('photo_id', photo.id).eq('user_id', session.user.id);
      await supabase.from('fan_gallery').update({ likes_count: newCount }).eq('id', photo.id);
    } else {
      await supabase.from('gallery_likes').insert([{ photo_id: photo.id, user_id: session.user.id }]);
      await supabase.from('fan_gallery').update({ likes_count: newCount }).eq('id', photo.id);
    }
  };

  const handleShare = async (photo: GalleryPhoto) => {
    try {
      await Share.share({
        message: `Check out this Barracuda supporter photo by ${photo.username} in Section 108!\n${photo.image_url}`,
      });
    } catch {}
  };

  const handleSubmitChant = async () => {
    if (!chantTitle.trim() || !chantLyrics.trim()) {
      Alert.alert('Incomplete Form', 'Please provide at least a chant title and the lyrics.');
      return;
    }

    setSubmittingChant(true);
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

      const { error } = await supabase.from('chant_submissions').insert([payload]);
      if (error) throw error;

      Alert.alert('Chant Submitted! 📢', 'Thanks for fueling Section 108! Your idea has been sent directly to the Battery Pack team.');
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* 🚀 Segmented Top Tab Bar */}
      <View style={[styles.topTabBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'CHANTS' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('CHANTS')}
        >
          <Text style={[styles.topTabText, { color: activeTab === 'CHANTS' ? '#001417' : theme.subText }]}>
            🗣️ Chants
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'GALLERY' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('GALLERY')}
        >
          <Text style={[styles.topTabText, { color: activeTab === 'GALLERY' ? '#001417' : theme.subText }]}>
            📸 Gallery
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'CHAT' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('CHAT')}
        >
          <Text style={[styles.topTabText, { color: activeTab === 'CHAT' ? '#001417' : theme.subText }]}>
            💬 Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: 🗣️ CHANTS */}
      {activeTab === 'CHANTS' && (
        <ScrollView contentContainerStyle={styles.scrollPadding}>
          <View style={[styles.headerBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>SECTION 108 CHANTS</Text>
            <Text style={[styles.bannerSubtitle, { color: theme.text }]}>
              The Official Songbook & Traditions of the SJ Battery Pack 🪸
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

      {/* TAB 2: 📸 GALLERY */}
      {activeTab === 'GALLERY' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.galleryHeaderBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.togglePill, viewMode === 'TIMELINE' && { backgroundColor: theme.accentGold }]}
                onPress={() => setViewMode('TIMELINE')}
              >
                <Text style={[styles.toggleText, { color: viewMode === 'TIMELINE' ? '#001417' : theme.text }]}>
                  📜 Timeline
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.togglePill, viewMode === 'GRID' && { backgroundColor: theme.accentGold }]}
                onPress={() => setViewMode('GRID')}
              >
                <Text style={[styles.toggleText, { color: viewMode === 'GRID' ? '#001417' : theme.text }]}>
                  ▦ Grid
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {galleryLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.accentGold} />
            </View>
          ) : (
            <FlatList
              key={viewMode}
              data={photos}
              keyExtractor={(item) => item.id}
              numColumns={viewMode === 'GRID' ? 3 : 1}
              contentContainerStyle={viewMode === 'GRID' ? styles.gridPadding : styles.timelinePadding}
              renderItem={({ item }) => {
                if (viewMode === 'GRID') {
                  return (
                    <TouchableOpacity
                      style={styles.gridImageWrapper}
                      activeOpacity={0.8}
                      onPress={() => setSelectedPhoto(item)}
                    >
                      <Image source={{ uri: item.image_url }} style={styles.gridImage} />
                    </TouchableOpacity>
                  );
                }

                return (
                  <View style={[styles.timelineCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.avatarBadge, { backgroundColor: theme.accentOrange }]}>
                        <Text style={styles.avatarText}>{item.username.substring(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.usernameText, { color: theme.text }]}>{item.username}</Text>
                        <Text style={[styles.dateText, { color: theme.subText }]}>
                          {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleShare(item)}>
                        <Text style={{ fontSize: 16 }}>📤</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedPhoto(item)}>
                      <Image source={{ uri: item.image_url }} style={styles.timelineImage} resizeMode="cover" />
                    </TouchableOpacity>

                    <View style={styles.cardFooter}>
                      <TouchableOpacity style={styles.likeBtn} onPress={() => toggleLike(item)}>
                        <Text style={{ fontSize: 18 }}>{item.hasLiked ? '❤️' : '🤍'}</Text>
                        <Text style={[styles.likeCount, { color: theme.text }]}>{item.likes_count}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.monthPill, { color: theme.accentGold }]}>{item.month_year}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* Floating Upload Photo Button */}
          <TouchableOpacity
            style={[styles.floatingAddBtn, { backgroundColor: theme.accentGold }]}
            activeOpacity={0.85}
            onPress={handleUploadPhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? <ActivityIndicator color="#001417" /> : <Text style={styles.floatingAddBtnText}>＋</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* TAB 3: 💬 CHAT DIRECT ENTRY */}
      {activeTab === 'CHAT' && (
        <View style={styles.chatGateContainer}>
          <View style={[styles.chatGateCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
            <Text style={[styles.chatGateTitle, { color: theme.accentGold }]}>SECTION 108 CHAT</Text>
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

      {/* Fullscreen Photo Modal */}
      {selectedPhoto && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
          <View style={styles.modalBg}>
            <View style={styles.modalTopBar}>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Image source={{ uri: selectedPhoto.image_url }} style={styles.fullscreenImage} resizeMode="contain" />
            <View style={styles.modalBottomBar}>
              <View>
                <Text style={styles.modalUsername}>Uploaded by {selectedPhoto.username}</Text>
                <Text style={styles.modalDate}>{new Date(selectedPhoto.created_at).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity onPress={() => handleShare(selectedPhoto)}>
                <Text style={{ fontSize: 24 }}>📤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topTabBar: { flexDirection: 'row', padding: 6, marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 1 },
  topTabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  topTabText: { fontSize: 13, fontWeight: '800' },
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
  galleryHeaderBar: { padding: 10, borderBottomWidth: 1, alignItems: 'center' },
  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: 3 },
  togglePill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  toggleText: { fontSize: 12, fontWeight: '800' },
  timelinePadding: { padding: 14, paddingBottom: 80 },
  timelineCard: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  avatarBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  usernameText: { fontSize: 13, fontWeight: '800' },
  dateText: { fontSize: 10, fontWeight: '600' },
  timelineImage: { width: '100%', height: 260 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCount: { fontSize: 13, fontWeight: '800' },
  monthPill: { fontSize: 11, fontWeight: '800' },
  gridPadding: { padding: 6, paddingBottom: 80 },
  gridImageWrapper: { margin: 3 },
  gridImage: { width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE, borderRadius: 6 },
  floatingAddBtn: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  floatingAddBtnText: { color: '#001417', fontSize: 32, fontWeight: '900', marginTop: -2 },
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
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'space-between' },
  modalTopBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  modalCloseText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  fullscreenImage: { width: '100%', height: '70%' },
  modalBottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalUsername: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalDate: { color: '#80B3B8', fontSize: 11 },
});