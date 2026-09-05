import React, { useState, useEffect, useMemo } from 'react';
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
  SectionList,
  Dimensions,
  Share,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useAppTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 40) / GRID_COLUMNS;

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
  comments_count?: number;
  month_year: string;
  created_at: string;
  hasLiked?: boolean;
}

interface PhotoComment {
  id: string;
  photo_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  comment_text: string;
  created_at: string;
}

interface AlbumSection {
  title: string;
  data: GalleryPhoto[][];
  count: number;
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

  const [activeTab, setActiveTab] = useState<FanZoneTab>(
    params.tab === 'GALLERY' ? 'GALLERY' : params.tab === 'CHAT' ? 'CHAT' : 'CHANTS'
  );

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
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Gallery Comments State
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [activeCommentPhoto, setActiveCommentPhoto] = useState<GalleryPhoto | null>(null);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Collapsible Month Keys
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (params.tab === 'GALLERY') setActiveTab('GALLERY');
    else if (params.tab === 'CHAT') setActiveTab('CHAT');
  }, [params.tab]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchGallery(session?.user?.id);
    });

    const channel = supabase
      .channel('public:fan_gallery_fanzone_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fan_gallery' }, () => {
        fetchGallery();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatMonthYear = (dateStr?: string, fallbackMonth?: string) => {
    if (fallbackMonth && fallbackMonth.trim()) return fallbackMonth.trim();
    if (!dateStr) return 'Recent Uploads';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Recent Uploads';
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return 'Recent Uploads';
    }
  };

  const fetchGallery = async (userId?: string) => {
    try {
      setGalleryLoading(true);
      const { data, error } = await supabase
        .from('fan_gallery')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase gallery fetch error:', error.message);
        return;
      }

      if (Array.isArray(data)) {
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
    } catch (err) {
      console.warn('Gallery error:', err);
    } finally {
      setGalleryLoading(false);
    }
  };

  const albumSections: AlbumSection[] = useMemo(() => {
    const map: Record<string, GalleryPhoto[]> = {};

    photos.forEach((photo) => {
      const key = formatMonthYear(photo.created_at, photo.month_year);
      if (!map[key]) map[key] = [];
      map[key].push(photo);
    });

    return Object.keys(map).map((monthKey) => {
      const rawList = map[monthKey];
      const isCollapsed = !!collapsedMonths[monthKey];

      const rows: GalleryPhoto[][] = [];
      if (!isCollapsed) {
        for (let i = 0; i < rawList.length; i += GRID_COLUMNS) {
          rows.push(rawList.slice(i, i + GRID_COLUMNS));
        }
      }

      return {
        title: monthKey,
        data: rows,
        count: rawList.length,
      };
    });
  }, [photos, collapsedMonths]);

  const toggleMonthCollapse = (month: string) => {
    setCollapsedMonths((prev) => ({ ...prev, [month]: !prev[month] }));
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
      allowsEditing: false,
      quality: 1.0,
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
      const userHandle =
        session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Supporter108';

      await supabase.from('fan_gallery').insert([
        {
          user_id: session.user.id,
          username: userHandle,
          image_url: publicUrlData.publicUrl,
          month_year: monthYear,
          comments_count: 0,
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

  const handleDownloadPhoto = async (photo: GalleryPhoto) => {
    try {
      setDownloading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Storage permission is required to save photos.');
        return;
      }

      const cleanUrl = photo.image_url.split('?')[0];
      const ext = cleanUrl.split('.').pop() || 'jpg';
      const filename = `cuda_fan_${Date.now()}.${ext}`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadRes = await FileSystem.downloadAsync(photo.image_url, localUri);

      if (downloadRes.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
        const album = await MediaLibrary.getAlbumAsync('SJ Battery Pack');
        if (!album) {
          await MediaLibrary.createAlbumAsync('SJ Battery Pack', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        Alert.alert('Saved! 📥', 'Full-resolution image saved to your device Photos album.');
      } else {
        throw new Error('Download failed');
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not save photo.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDeletePhoto = async (photo: GalleryPhoto) => {
    setOptionsMenuVisible(false);

    if (session?.user?.id !== photo.user_id) {
      Alert.alert('Permission Denied', 'You can only delete photos that you personally uploaded.');
      return;
    }

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to permanently remove this picture from the Reef Gallery?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('fan_gallery').delete().eq('id', photo.id);
              if (error) throw error;

              const parts = photo.image_url.split('/');
              const fileKey = parts[parts.length - 1].split('?')[0];
              await supabase.storage.from('gallery-photos').remove([fileKey]);

              setSelectedPhoto(null);
              Alert.alert('Deleted', 'Your photo has been removed.');
              fetchGallery();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete photo.');
            }
          },
        },
      ]
    );
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

    if (selectedPhoto && selectedPhoto.id === photo.id) {
      setSelectedPhoto({ ...selectedPhoto, hasLiked: !isLiked, likes_count: newCount });
    }

    if (isLiked) {
      await supabase.from('gallery_likes').delete().eq('photo_id', photo.id).eq('user_id', session.user.id);
      await supabase.from('fan_gallery').update({ likes_count: newCount }).eq('id', photo.id);
    } else {
      await supabase.from('gallery_likes').insert([{ photo_id: photo.id, user_id: session.user.id }]);
      await supabase.from('fan_gallery').update({ likes_count: newCount }).eq('id', photo.id);
    }
  };

  const openCommentsModal = async (photo: GalleryPhoto) => {
    setActiveCommentPhoto(photo);
    setCommentsModalVisible(true);
    setLoadingComments(true);

    const { data } = await supabase
      .from('gallery_comments')
      .select('*')
      .eq('photo_id', photo.id)
      .order('created_at', { ascending: true });

    setComments(data || []);
    setLoadingComments(false);
  };

  const handlePostComment = async () => {
    if (!session?.user) {
      Alert.alert('Sign In Required', 'Please sign in to comment.');
      return;
    }
    if (!newCommentText.trim() || !activeCommentPhoto) return;

    setPostingComment(true);
    const userHandle =
      session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Supporter108';
    const avatar = session.user.user_metadata?.avatar_url || null;

    try {
      const { data, error } = await supabase
        .from('gallery_comments')
        .insert([
          {
            photo_id: activeCommentPhoto.id,
            user_id: session.user.id,
            username: userHandle,
            avatar_url: avatar,
            comment_text: newCommentText.trim(),
          },
        ])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setComments((prev) => [...prev, data[0]]);
        setNewCommentText('');
        const updatedCount = (activeCommentPhoto.comments_count || 0) + 1;
        await supabase.from('fan_gallery').update({ comments_count: updatedCount }).eq('id', activeCommentPhoto.id);
        setPhotos((prev) =>
          prev.map((p) => (p.id === activeCommentPhoto.id ? { ...p, comments_count: updatedCount } : p))
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not post comment.');
    } finally {
      setPostingComment(false);
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

      {/* Segmented Top Tab Bar */}
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

      {/* TAB 2: 📸 FULLY FEATURED GALLERY */}
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
                  ▦ Monthly Albums
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {galleryLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.accentGold} />
            </View>
          ) : viewMode === 'TIMELINE' ? (
            <FlatList
              data={photos}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.timelinePadding}
              renderItem={({ item }) => (
                <View style={[styles.timelineCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatarBadge, { backgroundColor: theme.accentOrange }]}>
                      <Text style={styles.avatarText}>{item.username.substring(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.usernameText, { color: theme.text }]}>{item.username}</Text>
                      <Text style={[styles.dateText, { color: theme.subText }]}>
                        {new Date(item.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleShare(item)} style={{ padding: 6 }}>
                      <Text style={{ fontSize: 16 }}>📤</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity activeOpacity={0.9} onPress={() => { setSelectedPhoto(item); setOptionsMenuVisible(false); }}>
                    <Image
                      source={{ uri: item.image_url }}
                      contentFit="cover"
                      transition={250}
                      cachePolicy="memory-disk"
                      style={styles.timelineImage}
                    />
                  </TouchableOpacity>

                  <View style={styles.cardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <TouchableOpacity style={styles.likeBtn} onPress={() => toggleLike(item)}>
                        <Text style={{ fontSize: 18 }}>{item.hasLiked ? '❤️' : '🤍'}</Text>
                        <Text style={[styles.likeCount, { color: theme.text }]}>{item.likes_count}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.likeBtn} onPress={() => openCommentsModal(item)}>
                        <Text style={{ fontSize: 18 }}>💬</Text>
                        <Text style={[styles.likeCount, { color: theme.text }]}>{item.comments_count || 0}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.likeBtn} onPress={() => handleDownloadPhoto(item)}>
                        <Text style={{ fontSize: 17 }}>💾</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.monthPill, { color: theme.accentGold }]}>{item.month_year}</Text>
                  </View>
                </View>
              )}
            />
          ) : (
            <SectionList
              sections={albumSections}
              keyExtractor={(row, index) => `${row[0]?.id || ''}_${index}`}
              contentContainerStyle={styles.gridContainerPadding}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => {
                const isCollapsed = !!collapsedMonths[section.title];
                return (
                  <TouchableOpacity
                    style={[styles.albumHeader, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.albumTitle, { color: theme.accentGold }]}>📅 {section.title}</Text>
                      <Text style={[styles.albumBadge, { color: theme.subText }]}>({section.count} photos)</Text>
                    </View>
                    <Text style={[styles.collapseArrow, { color: theme.accentGold }]}>
                      {isCollapsed ? '▼ Expand' : '▲ Collapse'}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              renderItem={({ item: row }) => (
                <View style={styles.gridRow}>
                  {row.map((photo) => (
                    <TouchableOpacity
                      key={photo.id}
                      style={styles.gridImageWrapper}
                      activeOpacity={0.85}
                      onPress={() => { setSelectedPhoto(photo); setOptionsMenuVisible(false); }}
                    >
                      <Image
                        source={{ uri: photo.image_url }}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                        style={styles.gridImage}
                      />
                      <View style={styles.gridBadgeOverlay}>
                        <Text style={styles.gridBadgeText}>❤️ {photo.likes_count}</Text>
                        <Text style={styles.gridBadgeText}>💬 {photo.comments_count || 0}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {Array.from({ length: GRID_COLUMNS - row.length }).map((_, i) => (
                    <View key={`empty-${i}`} style={[styles.gridImageWrapper, { backgroundColor: 'transparent' }]} />
                  ))}
                </View>
              )}
            />
          )}

          {/* Floating Upload Button */}
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

      {/* FULLSCREEN PHOTO MODAL */}
      {selectedPhoto && (
        <Modal visible transparent animationType="fade" onRequestClose={() => { setSelectedPhoto(null); setOptionsMenuVisible(false); }}>
          <View style={styles.modalBg}>
            <View style={styles.modalTopBar}>
              <TouchableOpacity onPress={() => { setSelectedPhoto(null); setOptionsMenuVisible(false); }} style={{ padding: 8 }}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => handleDownloadPhoto(selectedPhoto)} disabled={downloading} style={{ padding: 8 }}>
                  <Text style={{ fontSize: 22 }}>{downloading ? '⏳' : '💾'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setOptionsMenuVisible((prev) => !prev)}
                  style={{ padding: 8 }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.modalOptionsText}>•••</Text>
                </TouchableOpacity>
              </View>
            </View>

            {optionsMenuVisible && (
              <View style={[styles.optionsPopover, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
                <TouchableOpacity
                  style={styles.popoverItem}
                  onPress={() => {
                    setOptionsMenuVisible(false);
                    handleDownloadPhoto(selectedPhoto);
                  }}
                >
                  <Text style={[styles.popoverText, { color: theme.text }]}>💾 Save Full-Resolution</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.popoverItem}
                  onPress={() => {
                    setOptionsMenuVisible(false);
                    handleShare(selectedPhoto);
                  }}
                >
                  <Text style={[styles.popoverText, { color: theme.text }]}>📤 Share Photo</Text>
                </TouchableOpacity>

                {session?.user?.id === selectedPhoto.user_id && (
                  <TouchableOpacity
                    style={[styles.popoverItem, { borderTopWidth: 1, borderTopColor: theme.borderColor }]}
                    onPress={() => handleDeletePhoto(selectedPhoto)}
                  >
                    <Text style={[styles.popoverText, { color: '#FF4C00', fontWeight: '900' }]}>
                      🗑️ Delete My Photo
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Image
              source={{ uri: selectedPhoto.image_url }}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
              style={styles.fullscreenImage}
            />

            <View style={styles.modalBottomBar}>
              <View>
                <Text style={styles.modalUsername}>Uploaded by {selectedPhoto.username}</Text>
                <Text style={styles.modalDate}>{new Date(selectedPhoto.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => toggleLike(selectedPhoto)}>
                  <Text style={{ fontSize: 24 }}>{selectedPhoto.hasLiked ? '❤️' : '🤍'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const target = selectedPhoto;
                    setSelectedPhoto(null);
                    setOptionsMenuVisible(false);
                    openCommentsModal(target);
                  }}
                >
                  <Text style={{ fontSize: 24 }}>💬</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleShare(selectedPhoto)}>
                  <Text style={{ fontSize: 24 }}>📤</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* COMMENTS MODAL */}
      <Modal
        visible={commentsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.commentsOverlay}
        >
          <View style={[styles.commentsContainer, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            <View style={[styles.commentsHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.commentsTitle, { color: theme.accentGold }]}>💬 Photo Comments</Text>
              <TouchableOpacity onPress={() => setCommentsModalVisible(false)} style={{ padding: 4 }}>
                <Text style={[styles.modalCloseText, { color: theme.subText }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color={theme.accentGold} />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Text style={{ color: theme.subText }}>No comments yet. Be the first to chime in!</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 12 }}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <View style={[styles.commentAvatarBadge, { backgroundColor: theme.accentOrange }]}>
                        <Text style={styles.commentAvatarInitial}>{item.username.substring(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.commentContent}>
                      <View style={styles.commentUserRow}>
                        <Text style={[styles.commentUsername, { color: theme.text }]}>{item.username}</Text>
                        <Text style={[styles.commentDate, { color: theme.subText }]}>
                          {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <Text style={[styles.commentBody, { color: theme.text }]}>{item.comment_text}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            <View style={[styles.commentInputRow, { backgroundColor: theme.subCardBg, borderTopColor: theme.borderColor }]}>
              <TextInput
                style={[styles.commentInput, { color: theme.text, backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                placeholder="Write a comment..."
                placeholderTextColor={theme.subText}
                value={newCommentText}
                onChangeText={setNewCommentText}
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, { backgroundColor: theme.accentGold }]}
                onPress={handlePostComment}
                disabled={postingComment || !newCommentText.trim()}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color="#001E22" />
                ) : (
                  <Text style={styles.commentSendBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Gallery Header
  galleryHeaderBar: { padding: 10, borderBottomWidth: 1, alignItems: 'center' },
  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: 3 },
  togglePill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  toggleText: { fontSize: 12, fontWeight: '800' },

  // Timeline Styles
  timelinePadding: { padding: 14, paddingBottom: 80 },
  timelineCard: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  avatarBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  usernameText: { fontSize: 13, fontWeight: '800' },
  dateText: { fontSize: 10, fontWeight: '600' },
  timelineImage: { width: '100%', height: 290 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCount: { fontSize: 13, fontWeight: '800' },
  monthPill: { fontSize: 11, fontWeight: '800' },

  // SectionList Grid Styles with Badge Overlays
  gridContainerPadding: { paddingHorizontal: 12, paddingBottom: 90 },
  albumHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 12, marginBottom: 8 },
  albumTitle: { fontSize: 14, fontWeight: '900' },
  albumBadge: { fontSize: 11, fontWeight: '600' },
  collapseArrow: { fontSize: 12, fontWeight: '800' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  gridImageWrapper: { width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridBadgeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 2,
  },
  gridBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },

  floatingAddBtn: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  floatingAddBtnText: { color: '#001417', fontSize: 32, fontWeight: '900', marginTop: -2 },

  // Chat Gate
  chatGateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  chatGateCard: { width: '100%', padding: 26, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  chatGateTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  chatGateSub: { fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 18 },
  chatGateButton: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  chatGateButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },

  // Modals
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

  // Fullscreen Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'space-between' },
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 36, zIndex: 10 },
  modalCloseText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  modalOptionsText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  fullscreenImage: { width: '100%', height: '70%' },
  modalBottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalUsername: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalDate: { color: '#80B3B8', fontSize: 11 },

  // Options Popover
  optionsPopover: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 115 : 85,
    right: 16,
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  popoverItem: { paddingVertical: 12, paddingHorizontal: 14 },
  popoverText: { fontSize: 13, fontWeight: '700' },

  // Comments Styles
  commentsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  commentsContainer: { height: '65%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  commentsTitle: { fontSize: 16, fontWeight: '900' },
  emptyComments: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  commentItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentAvatarBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  commentAvatarInitial: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  commentContent: { flex: 1 },
  commentUserRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  commentUsername: { fontSize: 12, fontWeight: '800' },
  commentDate: { fontSize: 10 },
  commentBody: { fontSize: 13, lineHeight: 18 },
  commentInputRow: { flexDirection: 'row', padding: 10, borderTopWidth: 1, gap: 10, alignItems: 'center' },
  commentInput: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, fontSize: 13 },
  commentSendBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  commentSendBtnText: { color: '#001417', fontWeight: '900', fontSize: 13 },
});