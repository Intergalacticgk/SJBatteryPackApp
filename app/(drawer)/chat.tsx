import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

interface ChatMessage {
  id: string;
  room: string;
  user_id: string;
  username: string;
  content?: string;
  message?: string;
  created_at: string;
}

const ROOMS = [
  { id: 'general', title: '🦈 Gameday & 108', desc: 'Live reactions from Tech CU Arena' },
  { id: 'watch-parties', title: '🍻 Watch Parties', desc: 'Away game meetups & bar spots' },
  { id: 'merch', title: '🎟️ Merch & Tickets', desc: 'Ticket exchanges and fan gear' },
  { id: 'prospects', title: '⭐ Prospect Talk', desc: 'Sharks & Cuda prospect development' },
];

export default function ChatScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeRoom, setActiveRoom] = useState<string>('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const flatListRef = useRef<FlatList>(null);

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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />
        <View style={styles.loggedOutContainer}>
          <View style={[styles.loggedOutCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={styles.loggedOutIcon}>🔒</Text>
            <Text style={[styles.loggedOutTitle, { color: theme.accentGold }]}>SECTION 108 CHAT</Text>
            <Text style={[styles.loggedOutSub, { color: theme.subText }]}>
              Join the real-time supporter rooms, share gameday reactions, and connect with fellow Barracuda boosters.
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.accentGold} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            keyExtractor={(item) => item.id || String(Math.random())}
            contentContainerStyle={styles.messagesPadding}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
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
                    <Text style={[styles.messageText, { color: isMine ? '#FFFFFF' : theme.text }]}>
                      {displayMsg}
                    </Text>
                    <Text style={[styles.messageTime, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.subText }]}>
                      {formattedTime}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Message Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  roomsContainer: { borderBottomWidth: 1 },
  roomTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  roomTabText: { fontSize: 12, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 12, fontWeight: '600' },
  messagesPadding: { padding: 14, paddingBottom: 10 },
  messageBubbleWrapper: { marginBottom: 12, maxWidth: '82%' },
  myBubbleWrapper: { alignSelf: 'flex-end' },
  otherBubbleWrapper: { alignSelf: 'flex-start' },
  senderHandle: { fontSize: 11, fontWeight: '800', marginBottom: 3 },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  messageText: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  messageTime: { fontSize: 9, marginTop: 4, textAlign: 'right', fontWeight: '500' },
  inputBar: { flexDirection: 'row', padding: 10, borderTopWidth: 1, alignItems: 'center', gap: 8 },
  messageInput: { flex: 1, minHeight: 40, maxHeight: 90, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, fontWeight: '600' },
  sendButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { fontSize: 18, color: '#001E22', fontWeight: '900' },
  loggedOutContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loggedOutCard: { width: '100%', padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  loggedOutIcon: { fontSize: 40, marginBottom: 10 },
  loggedOutTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  loggedOutSub: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 18 },
  loginBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});