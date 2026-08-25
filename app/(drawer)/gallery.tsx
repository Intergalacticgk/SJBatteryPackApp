import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
  Platform,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 24) / 3;

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

export default function GalleryScreen() {
  const { theme } = useAppTheme();
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'GRID'>('TIMELINE');
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [session, setSession] = useState<any>(null);

  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchGallery(session?.user?.id);
    });

    const channel = supabase
      .channel('public:fan_gallery')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fan_gallery' }, () => {
        fetchGallery();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchGallery = async (userId?: string) => {
    setLoading(true);
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
    setLoading(false);
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
      setUploading(true);
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
      setUploading(false);
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

  const handleFlagPhoto = async (photo: GalleryPhoto) => {
    Alert.alert(
      'Flag Photo',
      'Would you like to report this photo for review by Section 108 moderators?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Image',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('fan_gallery').update({ flagged: true }).eq('id', photo.id);
            setSelectedPhoto(null);
            setOptionsMenuVisible(false);
            Alert.alert('Reported', 'Thank you. The image has been flagged for moderator review.');
            fetchGallery();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* Header Controls */}
      <View style={[styles.headerBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
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
              ▦ Month Grid
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Photo Feed with safe key to prevent dynamic numColumns crash */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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

      {/* Floating Add Photo Button */}
      <TouchableOpacity
        style={[styles.floatingAddBtn, { backgroundColor: theme.accentGold }]}
        activeOpacity={0.85}
        onPress={handleUploadPhoto}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#001417" />
        ) : (
          <Text style={styles.floatingAddBtnText}>＋</Text>
        )}
      </TouchableOpacity>

      {/* Expand Fullscreen Modal */}
      {selectedPhoto && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
          <View style={styles.modalBg}>
            <View style={styles.modalTopBar}>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOptionsMenuVisible(true)}>
                <Text style={styles.modalOptionsText}>•••</Text>
              </TouchableOpacity>
            </View>

            <Image source={{ uri: selectedPhoto.image_url }} style={styles.fullscreenImage} resizeMode="contain" />

            <View style={styles.modalBottomBar}>
              <View>
                <Text style={styles.modalUsername}>Uploaded by {selectedPhoto.username}</Text>
                <Text style={styles.modalDate}>{new Date(selectedPhoto.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => toggleLike(selectedPhoto)}>
                  <Text style={{ fontSize: 24 }}>{selectedPhoto.hasLiked ? '❤️' : '🤍'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleShare(selectedPhoto)}>
                  <Text style={{ fontSize: 24 }}>📤</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Options Menu */}
      {optionsMenuVisible && selectedPhoto && (
        <Modal visible transparent animationType="none" onRequestClose={() => setOptionsMenuVisible(false)}>
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setOptionsMenuVisible(false)}
          >
            <View style={[styles.menuCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setOptionsMenuVisible(false);
                  handleShare(selectedPhoto);
                }}
              >
                <Text style={[styles.menuItemText, { color: theme.text }]}>📤 Share Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setOptionsMenuVisible(false);
                  handleFlagPhoto(selectedPhoto);
                }}
              >
                <Text style={[styles.menuItemText, { color: '#e74c3c' }]}>🚩 Flag Image for Review</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { padding: 10, borderBottomWidth: 1, alignItems: 'center' },
  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: 3 },
  togglePill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  toggleText: { fontSize: 12, fontWeight: '800' },
  timelinePadding: { padding: 14, paddingBottom: 80 },
  timelineCard: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  avatarBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  usernameText: { fontSize: 13, fontWeight: '800' },
  dateText: { fontSize: 10, fontWeight: '600' },
  timelineImage: { width: '100%', height: 280 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCount: { fontSize: 13, fontWeight: '800' },
  monthPill: { fontSize: 11, fontWeight: '800' },
  gridPadding: { padding: 4, paddingBottom: 80 },
  gridImageWrapper: { margin: 2 },
  gridImage: { width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE, borderRadius: 6 },
  floatingAddBtn: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  floatingAddBtnText: { color: '#001417', fontSize: 32, fontWeight: '900', marginTop: -2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'space-between' },
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  modalCloseText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  modalOptionsText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  fullscreenImage: { width: '100%', height: '70%' },
  modalBottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalUsername: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalDate: { color: '#80B3B8', fontSize: 11 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuCard: { width: 250, borderRadius: 14, borderWidth: 1, padding: 8 },
  menuItem: { paddingVertical: 12, paddingHorizontal: 14 },
  menuItemText: { fontSize: 14, fontWeight: '700' },
});