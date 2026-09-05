import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  SectionList,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
  Platform,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 40) / GRID_COLUMNS;

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
  data: GalleryPhoto[][]; // Chunked in rows of 3 for smooth SectionList rendering
  count: number;
}

export default function GalleryScreen() {
  const { theme } = useAppTheme();
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'GRID'>('TIMELINE');
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [session, setSession] = useState<any>(null);

  // Fullscreen & In-Modal Actions
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Comments State
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [activeCommentPhoto, setActiveCommentPhoto] = useState<GalleryPhoto | null>(null);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Collapsible Month Keys
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchGallery(session?.user?.id);
    });

    const channel = supabase
      .channel('public:fan_gallery_realtime')
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
      setLoading(true);
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
      setLoading(false);
    }
  };

  // Safe chunking for virtualized grid rendering (Prevents Hermes Memory Panic)
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

      // Chunk into rows of 3
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

  // 1. High Resolution Upload
  const handleUploadPhoto = async () => {
    if (!session?.user) {
      Alert.alert('Sign In Required', 'Please sign in to upload photos to the Reef Gallery.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll access is needed to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1.0,
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

      Alert.alert('Uploaded! 📸', 'Your photo has been shared with the Teal Family.');
      fetchGallery();
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  // 2. High Resolution Download
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
      Alert.alert('Download Error', err.message || 'Could not save image.');
    } finally {
      setDownloading(false);
    }
  };

  // 3. Delete Photo (Verified Owner Only)
  const handleDeletePhoto = async (photo: GalleryPhoto) => {
    setOptionsMenuVisible(false);

    const isOwner = session?.user?.id === photo.user_id;
    if (!isOwner) {
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

              // Storage cleanup
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

  // 4. Like / Unlike
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

  // 5. Comments
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* View Switcher Header */}
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
              ▦ Monthly Albums
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.accentGold} />
        </View>
      ) : viewMode === 'TIMELINE' ? (
        /* TIMELINE VIEW */
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
                <Image source={{ uri: item.image_url }} style={styles.timelineImage} resizeMode="cover" />
              </TouchableOpacity>

              <View style={styles.cardFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item)}>
                    <Text style={{ fontSize: 18 }}>{item.hasLiked ? '❤️' : '🤍'}</Text>
                    <Text style={[styles.actionCount, { color: theme.text }]}>{item.likes_count}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => openCommentsModal(item)}>
                    <Text style={{ fontSize: 18 }}>💬</Text>
                    <Text style={[styles.actionCount, { color: theme.text }]}>{item.comments_count || 0}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownloadPhoto(item)}>
                    <Text style={{ fontSize: 17 }}>💾</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.monthPill, { color: theme.accentGold }]}>{item.month_year}</Text>
              </View>
            </View>
          )}
        />
      ) : (
        /* VIRTUALIZED & MEMORY-SAFE MONTHLY ALBUMS */
        <SectionList
          sections={albumSections}
          keyExtractor={(row, index) => `${row[0]?.id || ''}_${index}`}
          contentContainerStyle={styles.gridContainerPadding}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const isCollapsed = !!collapsedMonths[section.title];
            return (
              <TouchableOpacity
                style={[styles.albumHeader, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}
                onPress={() => toggleMonthCollapse(section.title)}
                activeOpacity={0.8}
              >
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
                  <Image source={{ uri: photo.image_url }} style={styles.gridImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
              {/* Spacer elements to align row if less than 3 items */}
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
        disabled={uploading}
      >
        {uploading ? <ActivityIndicator color="#001417" /> : <Text style={styles.floatingAddBtnText}>＋</Text>}
      </TouchableOpacity>

      {/* FULLSCREEN PHOTO MODAL */}
      {selectedPhoto && (
        <Modal visible transparent animationType="fade" onRequestClose={() => { setSelectedPhoto(null); setOptionsMenuVisible(false); }}>
          <View style={styles.modalBg}>
            {/* Top Bar */}
            <View style={styles.modalTopBar}>
              <TouchableOpacity onPress={() => { setSelectedPhoto(null); setOptionsMenuVisible(false); }} style={{ padding: 8 }}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => handleDownloadPhoto(selectedPhoto)} disabled={downloading} style={{ padding: 8 }}>
                  <Text style={{ fontSize: 22 }}>{downloading ? '⏳' : '💾'}</Text>
                </TouchableOpacity>

                {/* 3-DOTS ACTION TRIGGER */}
                <TouchableOpacity
                  onPress={() => setOptionsMenuVisible((prev) => !prev)}
                  style={{ padding: 8 }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.modalOptionsText}>•••</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* In-Modal Options Popover Overlay (Fixes nested modal unresponsiveness on iPad) */}
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

            <Image source={{ uri: selectedPhoto.image_url }} style={styles.fullscreenImage} resizeMode="contain" />

            {/* Bottom Bar */}
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
              <View style={styles.centerLoading}>
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
                      <Image source={{ uri: item.avatar_url }} style={styles.commentAvatar} />
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

            {/* Comment Input Bar */}
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
                  <ActivityIndicator size="small" color="#001417" />
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
  headerBar: { padding: 10, borderBottomWidth: 1, alignItems: 'center' },
  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: 3 },
  togglePill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  toggleText: { fontSize: 12, fontWeight: '800' },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  timelinePadding: { padding: 14, paddingBottom: 80 },
  timelineCard: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  avatarBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  usernameText: { fontSize: 13, fontWeight: '800' },
  dateText: { fontSize: 10, fontWeight: '600' },
  timelineImage: { width: '100%', height: 290 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 13, fontWeight: '800' },
  monthPill: { fontSize: 11, fontWeight: '800' },

  // Virtualized SectionList Grid Styles
  gridContainerPadding: { paddingHorizontal: 12, paddingBottom: 90 },
  albumHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 12, marginBottom: 8 },
  albumTitle: { fontSize: 14, fontWeight: '900' },
  albumBadge: { fontSize: 11, fontWeight: '600' },
  collapseArrow: { fontSize: 12, fontWeight: '800' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  gridImageWrapper: { width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE, borderRadius: 8, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },

  // Floating Upload Button
  floatingAddBtn: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  floatingAddBtnText: { color: '#001417', fontSize: 32, fontWeight: '900', marginTop: -2 },

  // Fullscreen Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'space-between' },
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 36, zIndex: 10 },
  modalCloseText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  modalOptionsText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  fullscreenImage: { width: '100%', height: '70%' },
  modalBottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalUsername: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalDate: { color: '#80B3B8', fontSize: 11 },

  // Direct Options Popover
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