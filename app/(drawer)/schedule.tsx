import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

export interface GameScheduleItem {
  id: string;
  game_date: string;
  date_display: string;
  game_time: string;
  opponent: string;
  opponent_abbr: string;
  is_home: boolean;
  venue: string;
  theme_night?: string;
  supporterEvent?: any;
}

const SCHEDULE_FILTERS = ['All Games', 'Home', 'Away', 'Theme Nights'] as const;

export default function ScheduleScreen() {
  const { theme } = useAppTheme();
  const [filter, setFilter] = useState<typeof SCHEDULE_FILTERS[number]>('All Games');
  const [games, setGames] = useState<GameScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedGame, setSelectedGame] = useState<GameScheduleItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchScheduleAndEvents = async () => {
    try {
      const [scheduleRes, eventsRes] = await Promise.all([
        supabase.from('schedule').select('*').order('game_date', { ascending: true }),
        supabase.from('supporter_events').select('*'),
      ]);

      const eventsList = Array.isArray(eventsRes.data) ? eventsRes.data : [];

      if (!scheduleRes.error && Array.isArray(scheduleRes.data)) {
        const mapped = scheduleRes.data.map((item: any) => {
          const gameDate = item.game_date || '';
          
          const matchedEvent = eventsList.find(
            (e: any) =>
              e.event_date === gameDate ||
              (item.theme_night && e.title?.toLowerCase().includes(item.theme_night.toLowerCase()))
          );

          const isHome = item.home_away === 'HOME';

          return {
            id: String(item.id),
            game_date: gameDate,
            date_display: item.date_display || gameDate,
            game_time: item.game_time || 'TBA',
            opponent: item.opponent || 'Opponent',
            opponent_abbr: item.opponent_abbr || 'OPP',
            is_home: isHome,
            venue: item.venue || (isHome ? 'Tech CU Arena' : 'Opponent Arena'),
            theme_night: item.theme_night || undefined,
            supporterEvent: matchedEvent,
          };
        });

        setGames(mapped);
      }
    } catch (err) {
      console.warn('Schedule fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchScheduleAndEvents();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchScheduleAndEvents();
  }, []);

  const openAwayActionModal = (game: GameScheduleItem) => {
    setSelectedGame(game);
    setModalVisible(true);
  };

  const filteredGames = games.filter((game) => {
    if (filter === 'Home') return game.is_home;
    if (filter === 'Away') return !game.is_home;
    if (filter === 'Theme Nights') {
      if (!game.theme_night) return false;
      const lowerTheme = game.theme_night.toLowerCase();
      if (
        lowerTheme.includes('watch') ||
        lowerTheme.includes('road trip') ||
        lowerTheme.includes('photo')
      ) {
        return false;
      }
      return true;
    }
    return true;
  });

  const evt = selectedGame?.supporterEvent;
  const isWatchParty =
    selectedGame?.theme_night?.toLowerCase().includes('watch') ||
    evt?.category?.toLowerCase().includes('watch');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* Filter Selector */}
      <View style={[styles.filterBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SCHEDULE_FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingVertical: 10 }}
          renderItem={({ item }) => {
            const isActive = item === filter;
            return (
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                  isActive && { backgroundColor: theme.accentGold, borderColor: theme.accentGold },
                ]}
                onPress={() => setFilter(item)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: theme.text },
                    isActive && { color: '#001417', fontWeight: '900' },
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Schedule Feed */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accentGold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.contentPadding}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accentGold}
              colors={[theme.accentGold, theme.accentOrange]}
            />
          }
        >
          {filteredGames.map((game) => {
            const isAway = !game.is_home;
            const hasAwayAction = isAway && (game.theme_night || game.supporterEvent);

            return (
              <View
                key={game.id}
                style={[
                  styles.gameCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                ]}
              >
                <View style={styles.topRow}>
                  <View
                    style={[
                      styles.locBadge,
                      { backgroundColor: game.is_home ? theme.accentGold : theme.subCardBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.locBadgeText,
                        { color: game.is_home ? '#001417' : theme.subText },
                      ]}
                    >
                      {game.is_home ? 'HOME' : 'AWAY'}
                    </Text>
                  </View>

                  <Text style={[styles.gameDate, { color: theme.accentGold }]}>
                    {game.date_display || game.game_date}
                  </Text>
                </View>

                {/* Matchup Center - Universally SJ Teal Circle */}
                <View style={styles.matchupRow}>
                  <View style={[styles.teamCircle, { backgroundColor: '#266B73' }]}>
                    <Text style={[styles.teamCircleText, { color: '#FFFFFF' }]}>
                      SJ
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.opponentName, { color: theme.text }]}>
                      {game.is_home ? `vs ${game.opponent}` : `@ ${game.opponent}`}
                    </Text>
                    <Text style={[styles.venueText, { color: theme.subText }]}>📍 {game.venue}</Text>
                    <Text style={[styles.timeText, { color: theme.accentOrange }]}>⏰ {game.game_time}</Text>
                  </View>
                </View>

                {/* Action Bar or Static Theme */}
                {hasAwayAction ? (
                  <TouchableOpacity
                    style={[styles.themeActionBar, { backgroundColor: theme.subCardBg, borderColor: theme.accentOrange }]}
                    onPress={() => openAwayActionModal(game)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.themeActionLeft}>
                      <Text style={styles.themeActionIcon}>{isWatchParty ? '📺' : '🚗'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.themeActionTitle, { color: theme.accentGold }]} numberOfLines={1}>
                          {evt?.title || game.theme_night}
                        </Text>
                        <Text style={[styles.themeActionSub, { color: theme.subText }]}>
                          Tap for supporter event status & details
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.themeActionBtnText, { color: theme.accentOrange }]}>Details ➔</Text>
                  </TouchableOpacity>
                ) : (
                  game.theme_night && (
                    <View style={[styles.staticThemeBar, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                      <Text style={[styles.staticThemeText, { color: theme.accentGold }]}>
                        🌟 {game.theme_night}
                      </Text>
                    </View>
                  )
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Away Game Info Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalBadgeText, { color: theme.accentOrange }]}>
                {evt?.badge || selectedGame?.theme_night || 'AWAY SUPPORTER EVENT'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.modalClose, { color: theme.subText }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalMatchupBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.modalMatchupTitle, { color: theme.text }]}>
                Barracuda @ {selectedGame?.opponent}
              </Text>
              <Text style={[styles.modalMatchupDetail, { color: theme.subText }]}>
                📍 {evt?.location || selectedGame?.venue}
              </Text>
              <Text style={[styles.modalMatchupDetail, { color: theme.accentGold }]}>
                📅 {selectedGame?.date_display || selectedGame?.game_date} • {selectedGame?.game_time}
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 250, marginVertical: 12 }}>
              <Text style={[styles.descTitle, { color: theme.accentGold }]}>
                {evt?.title || (isWatchParty ? 'Away Watch Party' : 'Road Game Invasion')}
              </Text>
              <Text style={[styles.descBody, { color: theme.text }]}>
                {evt?.description ||
                  (isWatchParty
                    ? 'Cheer on our Barracuda with sound on broadcast, raffle prizes, and Section 108 chant energy while the team is on the road!'
                    : 'Join the traveling Battery Pack contingent to bring Section 108 energy to opponent arenas!')}
              </Text>

              {evt?.location && (
                <Text style={[styles.descBody, { color: theme.subText, marginTop: 8 }]}>
                  • <Text style={{ fontWeight: '700', color: theme.text }}>Location Details:</Text> {evt.location}
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: theme.accentGold }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.modalConfirmBtnText]}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: { borderBottomWidth: 1 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: '700' },
  contentPadding: { padding: 14, paddingBottom: 40 },
  gameCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  locBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  locBadgeText: { fontSize: 10, fontWeight: '900' },
  gameDate: { fontSize: 12, fontWeight: '800' },
  matchupRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  teamCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  teamCircleText: { fontSize: 13, fontWeight: '900' },
  opponentName: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  venueText: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  timeText: { fontSize: 12, fontWeight: '800' },

  themeActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  themeActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  themeActionIcon: { fontSize: 18 },
  themeActionTitle: { fontSize: 12, fontWeight: '800' },
  themeActionSub: { fontSize: 10, fontWeight: '500' },
  themeActionBtnText: { fontSize: 12, fontWeight: '900' },

  staticThemeBar: { padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 6 },
  staticThemeText: { fontSize: 12, fontWeight: '700', lineHeight: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 16, borderWidth: 1, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalBadgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  modalClose: { fontSize: 18, fontWeight: '800' },
  modalMatchupBox: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  modalMatchupTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  modalMatchupDetail: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  descTitle: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  descBody: { fontSize: 12, lineHeight: 18 },
  modalConfirmBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  modalConfirmBtnText: { color: '#001417', fontSize: 14, fontWeight: '900' },
});