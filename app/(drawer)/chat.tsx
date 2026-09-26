import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  Dimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GIF_WIDTH = (SCREEN_WIDTH - 48) / 2;

// Production Public GIPHY Key
const GIPHY_API_KEY = 'TVNEkjVWJEw0UDZxb7lzRG7mZpcD4FIA';

interface ChatMessage {
  id: string;
  room: string;
  user_id: string;
  username: string;
  content?: string;
  message?: string;
  media_url?: string;
  media_type?: 'IMAGE' | 'GIF';
  created_at: string;
}

const ROOMS = [
  { id: 'general', title: '🗣️ General', desc: 'Live reactions from Tech CU Arena' },
  { id: 'watch-parties', title: '🍻 Watch Parties', desc: 'Away game meetups & bar spots' },
  { id: 'merch', title: '🎟️ Merch & Tickets', desc: 'Ticket exchanges and fan gear' },
  { id: 'prospects', title: '⭐ Prospect Talk', desc: 'Sharks & Cuda prospect development' },
];

const GIPHY_QUICK_TAGS = [
  'San Jose Barracuda',
  'San Jose Sharks',
  'Frenzy',
  'Goal',
  'Celley',
  'Hockey Fight',
  'Reef',
];

const FALLBACK_GIFS = [
  { id: 'fb-1', images: { fixed_height: { url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif' } } },
  { id: 'fb-2', images: { fixed_height: { url: 'https://media.giphy.com/media/l0HlTdK9f97qfOGRy/giphy.gif' } } },
  { id: 'fb-3', images: { fixed_height: { url: 'https://media.giphy.com/media/26FPqAH61DhAndwPa/giphy.gif' } } },
  { id: 'fb-4', images: { fixed_height: { url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif' } } },
  { id: 'fb-5', images: { fixed_height: { url: 'https://media.giphy.com/media/3o85xGocUH8RYoDKKs/giphy.gif' } } },
  { id: 'fb-6', images: { fixed_height: { url: 'https://media.giphy.com/media/l2JdZ53ZTs3WShYHy/giphy.gif' } } },
];

export default function ChatScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeRoom, setActiveRoom] = useState<string>('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Media & Giphy State
  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [gifSearchText, setGifSearchText] = useState('San Jose Barracuda');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const rawHeight = e.endCoordinates.height;
      setKeyboardHeight(rawHeight);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        setSession(session);
        if (session?.user) {
          fetchCurrentUserProfile(session.user.id);
        } else {
          setCurrentUserProfile(null);
        }
        setAuthChecking(false);
      });

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const fetchCurrentUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setCurrentUserProfile(data);
    }
  };

  useEffect(() => {
    if (!session?.user) return;

    fetchRoomMessages();

    const channel = supabase
      .channel(`public:chat_messages:${activeRoom}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room=eq.${activeRoom}`,
        },
        (payload) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === (payload.new as any).id);
            if (exists) return prev;
            return [...prev, payload.new as ChatMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom, session]);

  const fetchRoomMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room', activeRoom)
      .order('created_at', { ascending: true })
      .limit(60);

    if (data && !error) {
      setMessages(data as ChatMessage[]);
    }
    setLoading(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return;

    if (!session?.user) {
      Alert.alert('Sign In Required', 'Please sign in to participate in the chat.');
      return;
    }

    const messageText = inputText.trim();
    const chatHandle =
      currentUserProfile?.username ||
      (currentUserProfile?.first_name
        ? `${currentUserProfile.first_name} ${currentUserProfile.last_name || ''}`.trim()
        : '') ||
      (session.user.email ? session.user.email.split('@')[0] : 'Supporter108');

    const newMessage = {
      room: activeRoom,
      user_id: session.user.id,
      username: chatHandle,
      content: messageText,
      message: messageText,
    };

    setSending(true);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([newMessage])
        .select()
        .single();

      if (error) {
        Alert.alert('Chat Error', error.message || 'Could not send message.');
      } else {
        setInputText('');
        if (data) {
          setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unexpected failure.');
    } finally {
      setSending(false);
    }
  };

  const handlePickAndSendImage = async () => {
    if (!session?.user) {
      Alert.alert('Sign In Required', 'Please sign in to upload photos to Section 108 chat.');
      return;
    }

    Alert.alert('Share Photo', 'Select a photo source:', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            uploadAndDispatchMedia(result.assets[0].uri, 'IMAGE');
          }
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Media library access is required.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            uploadAndDispatchMedia(result.assets[0].uri, 'IMAGE');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadAndDispatchMedia = async (localUri: string, mediaType: 'IMAGE' | 'GIF') => {
    try {
      setSending(true);
      const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `chat_${session.user.id}_${Date.now()}.${ext}`;
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      const base64Data = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64Data);

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('chat-media').getPublicUrl(fileName);

      const chatHandle =
        currentUserProfile?.username ||
        (session.user.email ? session.user.email.split('@')[0] : 'Supporter108');

      const newMessage = {
        room: activeRoom,
        user_id: session.user.id,
        username: chatHandle,
        content: '📷 Photo',
        message: '📷 Photo',
        media_url: publicData.publicUrl,
        media_type: mediaType,
      };

      const { data, error } = await supabase.from('chat_messages').insert([newMessage]).select().single();
      if (data && !error) {
        setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Could not send photo.');
    } finally {
      setSending(false);
    }
  };

  const searchGiphy = async (query = 'San Jose Barracuda') => {
    setGifLoading(true);
    try {
      const trimmed = query.trim();
      const endpoint = trimmed.length > 0
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(trimmed)}&limit=24&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=pg-13`;

      const res = await fetch(endpoint);
      const json = await res.json();

      if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
        setGifResults(json.data);
      } else {
        setGifResults(FALLBACK_GIFS);
      }
    } catch (e) {
      console.warn('Giphy live fetch error:', e);
      setGifResults(FALLBACK_GIFS);
    } finally {
      setGifLoading(false);
    }
  };

  const handleSelectGif = async (gifUrl: string) => {
    setGifModalVisible(false);
    if (!session?.user) return;

    const chatHandle =
      currentUserProfile?.username ||
      (session.user.email ? session.user.email.split('@')[0] : 'Supporter108');

    const newMessage = {
      room: activeRoom,
      user_id: session.user.id,
      username: chatHandle,
      content: '🎬 GIF',
      message: '🎬 GIF',
      media_url: gifUrl,
      media_type: 'GIF',
    };

    setSending(true);
    try {
      const { data, error } = await supabase.from('chat_messages').insert([newMessage]).select().single();
      if (data && !error) {
        setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
      }
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const text = m.content || m.message || '';
        return (
          text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.username.toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
    : messages;

  if (authChecking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accentGold} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['left', 'right', 'bottom']}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <View style={styles.loggedOutContainer}>
          <View style={[styles.loggedOutCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={styles.loggedOutIcon}>🔒</Text>
            <Text style={[styles.loggedOutTitle, { color: theme.accentGold }]}>SJ BATTERY PACK CHAT</Text>
            <Text style={[styles.loggedOutSub, { color: theme.subText }]}>
              Join the real-time supporter rooms, share gameday reactions, photos, and GIFs with fellow Barracuda boosters.
            </Text>
            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: theme.accentOrange }]}
              onPress={() => router.push('/(drawer)/info')}
            >
              <Text style={styles.loginBtnText}>Sign In / Create Account ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['left', 'right']}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      <View style={styles.flexContainer}>
        {/* Room Selector Tabs */}
        <View style={[styles.roomsContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={ROOMS}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 10 }}
            renderItem={({ item }) => {
              const isActive = item.id === activeRoom;
              return (
                <TouchableOpacity
                  style={[
                    styles.roomTab,
                    { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                    isActive && { backgroundColor: theme.accentGold, borderColor: theme.accentGold },
                  ]}
                  onPress={() => setActiveRoom(item.id)}
                >
                  <Text
                    style={[
                      styles.roomTabText,
                      { color: theme.text },
                      isActive && { color: '#001417', fontWeight: '900' },
                    ]}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchRow, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search messages in this channel..."
            placeholderTextColor="#80B3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: theme.subText, fontSize: 13, paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Messages Feed */}
        <View style={styles.feedContainer}>
          {loading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color={theme.accentGold} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={filteredMessages}
              keyExtractor={(item) => item.id || String(Math.random())}
              contentContainerStyle={styles.messagesPadding}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isMine = item.user_id === session?.user?.id;
                const formattedTime = new Date(item.created_at || Date.now()).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                });
                const displayMsg = item.content || item.message || '';

                return (
                  <View style={[styles.messageBubbleWrapper, isMine ? styles.myBubbleWrapper : styles.otherBubbleWrapper]}>
                    <Text style={[styles.senderHandle, { color: theme.accentGold }, isMine && { textAlign: 'right' }]}>
                      {item.username}
                    </Text>
                    <View
                      style={[
                        styles.messageBubble,
                        isMine
                          ? { backgroundColor: theme.accentOrange, alignSelf: 'flex-end' }
                          : { backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderWidth: 1, alignSelf: 'flex-start' },
                      ]}
                    >
                      {item.media_url ? (
                        <Image
                          source={{ uri: item.media_url }}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                          style={styles.bubbleMedia}
                        />
                      ) : (
                        <Text style={[styles.messageText, { color: isMine ? '#FFFFFF' : theme.text }]}>
                          {displayMsg}
                        </Text>
                      )}
                      <Text style={[styles.messageTime, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.subText }]}>
                        {formattedTime}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Message Input Toolbar - Anchored with boosted bottom margin */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.cardBg,
              borderTopColor: theme.borderColor,
              paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom, 12),
              marginBottom: keyboardHeight > 0 ? keyboardHeight + 48 : 0,
            },
          ]}
        >
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.subCardBg }]} onPress={handlePickAndSendImage}>
            <Text style={{ fontSize: 18 }}>📎</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gifButton, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}
            onPress={() => {
              setGifModalVisible(true);
              searchGiphy(gifSearchText);
            }}
          >
            <Text style={[styles.gifButtonText, { color: theme.accentGold }]}>GIF</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.messageInput, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
            placeholder={`Message #${ROOMS.find((r) => r.id === activeRoom)?.title}...`}
            placeholderTextColor="#80B3B8"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: theme.accentGold }]}
            onPress={handleSendMessage}
            disabled={sending || !inputText.trim()}
          >
            {sending ? <ActivityIndicator size="small" color="#001E22" /> : <Text style={styles.sendButtonText}>➔</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* GIPHY Modal */}
      <Modal visible={gifModalVisible} animationType="slide" transparent onRequestClose={() => setGifModalVisible(false)}>
        <View style={styles.gifModalOverlay}>
          <View style={[styles.gifModalContainer, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            <View style={styles.gifModalHeader}>
              <Text style={[styles.gifModalTitle, { color: theme.accentGold }]}>🎬 GIPHY KEYBOARD</Text>
              <TouchableOpacity onPress={() => setGifModalVisible(false)}>
                <Text style={[styles.gifCloseText, { color: theme.subText }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickTagsRow}>
              {GIPHY_QUICK_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.quickTagPill,
                    { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                    gifSearchText.toLowerCase() === tag.toLowerCase() && {
                      backgroundColor: theme.accentGold,
                      borderColor: theme.accentGold,
                    },
                  ]}
                  onPress={() => {
                    setGifSearchText(tag);
                    searchGiphy(tag);
                  }}
                >
                  <Text
                    style={[
                      styles.quickTagText,
                      { color: theme.text },
                      gifSearchText.toLowerCase() === tag.toLowerCase() && {
                        color: '#001417',
                        fontWeight: '900',
                      },
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.gifSearchRow, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <TextInput
                style={[styles.gifSearchInput, { color: theme.text }]}
                placeholder="Search GIPHY GIFs..."
                placeholderTextColor="#80B3B8"
                value={gifSearchText}
                onChangeText={(t) => {
                  setGifSearchText(t);
                  searchGiphy(t);
                }}
              />
            </View>

            {gifLoading ? (
              <ActivityIndicator size="large" color={theme.accentGold} style={{ flex: 1, marginTop: 20 }} />
            ) : (
              <FlatList
                data={gifResults}
                keyExtractor={(item, index) => item.id || String(index)}
                numColumns={2}
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const gifUrl = item.images?.fixed_height?.url || item.images?.downsized?.url;
                  if (!gifUrl) return null;

                  return (
                    <TouchableOpacity
                      style={styles.gifGridItem}
                      activeOpacity={0.8}
                      onPress={() => handleSelectGif(gifUrl)}
                    >
                      <Image
                        source={{ uri: gifUrl }}
                        contentFit="cover"
                        transition={150}
                        cachePolicy="memory-disk"
                        style={styles.gifThumbnail}
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flexContainer: { flex: 1 },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  roomsContainer: { borderBottomWidth: 1 },
  roomTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  roomTabText: { fontSize: 12, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 12, fontWeight: '600' },
  feedContainer: { flex: 1 },
  messagesPadding: { padding: 14, paddingBottom: 16 },
  messageBubbleWrapper: { marginBottom: 12, maxWidth: '82%' },
  myBubbleWrapper: { alignSelf: 'flex-end' },
  otherBubbleWrapper: { alignSelf: 'flex-start' },
  senderHandle: { fontSize: 11, fontWeight: '800', marginBottom: 3 },
  messageBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, overflow: 'hidden' },
  bubbleMedia: { width: 220, height: 160, borderRadius: 8, marginBottom: 4 },
  messageText: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  messageTime: { fontSize: 9, marginTop: 4, textAlign: 'right', fontWeight: '500' },
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  iconButton: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  gifButton: { width: 44, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  gifButtonText: { fontSize: 12, fontWeight: '900' },
  messageInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  sendButton: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { fontSize: 16, color: '#001E22', fontWeight: '900' },
  loggedOutContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loggedOutCard: { width: '100%', padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  loggedOutIcon: { fontSize: 40, marginBottom: 10 },
  loggedOutTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  loggedOutSub: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 18 },
  loginBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  gifModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  gifModalContainer: { height: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 14 },
  gifModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  gifModalTitle: { fontSize: 16, fontWeight: '900' },
  gifCloseText: { fontSize: 20, fontWeight: '900', paddingHorizontal: 6 },
  quickTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  quickTagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  quickTagText: { fontSize: 11, fontWeight: '700' },
  gifSearchRow: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  gifSearchInput: { fontSize: 13, fontWeight: '600' },
  gifGridItem: { width: GIF_WIDTH, height: 120, margin: 4, borderRadius: 8, overflow: 'hidden' },
  gifThumbnail: { width: '100%', height: '100%' },
});