import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';
import MatchReportModal, { GameStats, SJ_THEME, mapGamecenterSummary } from '../../components/MatchReportModal';

const GC_BASE = 'https://lscluster.hockeytech.com/feed/index.php?feed=gc&tab=gamesummary';
const GC_KEY = 'ccb91f29d6744675';

export interface GameScheduleItem {
  id: string;
  game_id?: string | null;
  game_date: string;
  date_display: string;
  game_time: string;
  opponent: string;
  opponent_abbr: string;
  is_home: boolean;
  venue: string;
  theme_night?: string;
  supporterEvent?: any;
  status?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  stats?: GameStats | null;
}

interface MonthGroup {
  monthKey: string;
  monthTitle: string;
  data: GameScheduleItem[];
}

const SCHEDULE_FILTERS = ['All Games', 'Home', 'Away', 'Theme Nights'] as const;

export default function ScheduleScreen() {
  const { theme } = useAppTheme();
  const [filter, setFilter] = useState<typeof SCHEDULE_FILTERS[number]>('All Games');
  const [games, setGames] = useState<GameScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [selectedGame, setSelectedGame] = useState<GameScheduleItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Match Report & Stats popup — same box score shown on the Home screen's
  // Last Encounter card, available here for any FINAL game so a fan who
  // missed it can pull up the stats from the schedule itself.
  const [reportGame, setReportGame] = useState<GameScheduleItem | null>(null);
  const [reportStats, setReportStats] = useState<GameStats | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const fetchScheduleAndEvents = async (isMounted = true) => {
    try {
      const [scheduleRes, eventsRes] = await Promise.all([
        supabase.from('schedule').select('*').order('game_date', { ascending: true }),
        supabase.from('supporter_events').select('*'),
      ]);

      const eventsList = Array.isArray(eventsRes?.data) ? eventsRes.data : [];

      if (isMounted && !scheduleRes?.error && Array.isArray(scheduleRes?.data)) {
        const mapped: GameScheduleItem[] = scheduleRes.data
          .filter((item) => item != null)
          .map((item: any) => {
            const gameDate = typeof item.game_date === 'string' ? item.game_date : '';
            
            const matchedEvent = eventsList.find(
              (e: any) =>
                e &&
                (e.event_date === gameDate ||
                  (item.theme_night && e.title?.toLowerCase().includes(item.theme_night.toLowerCase())))
            );

            const venueStr = String(item.venue || '').toLowerCase();
            const homeAwayStr = String(item.home_away || '').toUpperCase();

            const isHome = 
              item.is_home === true ||
              homeAwayStr === 'HOME' ||
              homeAwayStr === 'H' ||
              venueStr.includes('tech cu');

            return {
              id: String(item.id || Math.random()),
              game_id: item.game_id || null,
              game_date: gameDate,
              date_display: item.date_display || gameDate,
              game_time: item.game_time || '7:00 PM',
              opponent: item.opponent || 'Opponent',
              opponent_abbr: item.opponent_abbr || 'OPP',
              is_home: isHome,
              venue: item.venue || (isHome ? 'Tech CU Arena' : 'Opponent Arena'),
              theme_night: item.theme_night || undefined,
              supporterEvent: matchedEvent || undefined,
              status: item.status || null,
              home_score: item.home_score ?? null,
              away_score: item.away_score ?? null,
              stats: item.stats || null,
            };
          });

        setGames(mapped);
      }
    } catch (err) {
      console.warn('Schedule fetch error:', err);
    } finally {
      if (isMounted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchScheduleAndEvents(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchScheduleAndEvents(mounted);
    return () => {
      mounted = false;
    };
  }, []);

  const openAwayActionModal = (game: GameScheduleItem) => {
    setSelectedGame(game);
    setModalVisible(true);
  };

  const openMatchReport = async (game: GameScheduleItem) => {
    setReportGame(game);
    setReportModalVisible(true);

    if (game.stats) {
      setReportStats(game.stats);
      return;
    }

    setReportStats(null);
    if (!game.game_id) return;

    setReportLoading(true);
    try {
      const url = `${GC_BASE}&key=${GC_KEY}&client_code=ahl&game_id=${game.game_id}`;
      const res = await fetch(url);
      const json = await res.json();
      const gc = json?.GC?.Gamesummary;
      const mapped = mapGamecenterSummary(gc, game.is_home, game.opponent_abbr);
      if (mapped) setReportStats(mapped);
    } catch (err) {
      console.warn('Gamecenter feed unavailable:', err);
    } finally {
      setReportLoading(false);
    }
  };

  const filteredGames = useMemo(() => {
    if (!Array.isArray(games)) return [];
    return games.filter((game) => {
      if (!game) return false;
      if (filter === 'Home') return game.is_home;
      if (filter === 'Away') return !game.is_home;
      if (filter === 'Theme Nights') {
        if (!game.theme_night) return false;
        const lowerTheme = String(game.theme_night).toLowerCase();
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
  }, [games, filter]);

  const groupedMonths: MonthGroup[] = useMemo(() => {
    const groups: Record<string, { title: string; data: GameScheduleItem[] }> = {};

    filteredGames.forEach((game) => {
      if (!game) return;
      const dateParts = String(game.game_date || '').split('-');
      let monthKey = 'Upcoming';
      let monthTitle = 'Upcoming Games';

      if (dateParts.length >= 2 && dateParts[0] && dateParts[1]) {
        const year = parseInt(dateParts[0], 10);
        const monthIndex = parseInt(dateParts[1], 10) - 1;
        if (!isNaN(year) && !isNaN(monthIndex)) {
          const dateObj = new Date(year, monthIndex, 1);
          monthKey = `${dateParts[0]}-${dateParts[1]}`;
          monthTitle = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
      }

      if (!groups[monthKey]) {
        groups[monthKey] = { title: monthTitle, data: [] };
      }
      groups[monthKey].data.push(game);
    });

    return Object.keys(groups).map((key) => ({
      monthKey: key,
      monthTitle: groups[key].title,
      data: groups[key].data,
    }));
  }, [filteredGames]);

  useEffect(() => {
    if (groupedMonths.length > 0 && Object.keys(expandedMonths).length === 0) {
      const currentMonthKey = new Date().toISOString().slice(0, 7);
      const initialMap: Record<string, boolean> = {};

      let hasActiveMonth = false;
      groupedMonths.forEach((grp) => {
        if (grp.monthKey === currentMonthKey) {
          initialMap[grp.monthKey] = true;
          hasActiveMonth = true;
        }
      });

      if (!hasActiveMonth && groupedMonths[0]) {
        initialMap[groupedMonths[0].monthKey] = true;
      }

      setExpandedMonths(initialMap);
    }
  }, [groupedMonths]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const evt = selectedGame?.supporterEvent;
  const isWatchParty =
    selectedGame?.theme_night?.toLowerCase().includes('watch') ||
    evt?.category?.toLowerCase().includes('watch');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme?.bg || '#001E22' }]} edges={['left', 'right']}>
      <StatusBar style={theme?.isDark ? 'light' : 'dark'} />

      <View style={[styles.filterBar, { backgroundColor: theme?.cardBg || '#00262B', borderBottomColor: theme?.borderColor || '#003D47' }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SCHEDULE_FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterListContainer}
          renderItem={({ item }) => {
            const isActive = item === filter;
            return (
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: theme?.subCardBg || '#00333A', borderColor: theme?.borderColor || '#003D47' },
                  isActive && { backgroundColor: theme?.accentGold || '#FFB800', borderColor: theme?.accentGold || '#FFB800' },
                ]}
                onPress={() => setFilter(item)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: theme?.text || '#FFFFFF' },
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

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme?.accentGold || '#FFB800'} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.contentPadding}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme?.accentGold || '#FFB800'}
              colors={[theme?.accentGold || '#FFB800', theme?.accentOrange || '#FF671F']}
            />
          }
        >
          {groupedMonths.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: theme?.cardBg || '#00262B', borderColor: theme?.borderColor || '#003D47' }]}>
              <Text style={[styles.emptyText, { color: theme?.subText || '#80B3B8' }]}>
                No games found for "{filter}".
              </Text>
            </View>
          ) : (
            groupedMonths.map((group) => {
              const isExpanded = !!expandedMonths[group.monthKey];

              return (
                <View
                  key={group.monthKey}
                  style={[styles.monthCard, { backgroundColor: theme?.cardBg || '#00262B', borderColor: theme?.borderColor || '#003D47' }]}
                >
                  <TouchableOpacity
                    style={styles.monthHeader}
                    onPress={() => toggleMonth(group.monthKey)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.monthHeaderLeft}>
                      <Text style={[styles.monthTitle, { color: theme?.text || '#FFFFFF' }]}>{group.monthTitle}</Text>
                      <Text style={[styles.monthCount, { color: theme?.subText || '#80B3B8' }]}>({group.data.length})</Text>
                    </View>
                    <Text style={[styles.monthArrow, { color: theme?.accentGold || '#FFB800' }]}>
                      {isExpanded ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.monthGamesContainer}>
                      {group.data.map((game) => {
                        const isAway = !game.is_home;
                        const hasAwayAction = isAway && (game.theme_night || game.supporterEvent);

                        const isFinal = String(game.status || '').toUpperCase() === 'FINAL';
                        const sjScore = isFinal
                          ? (game.is_home ? game.home_score : game.away_score)
                          : null;
                        const oppScore = isFinal
                          ? (game.is_home ? game.away_score : game.home_score)
                          : null;
                        const sjWon = sjScore != null && oppScore != null && sjScore > oppScore;

                        return (
                          <View
                            key={game.id}
                            style={[
                              styles.gameCard,
                              { backgroundColor: theme?.subCardBg || '#00333A', borderColor: theme?.borderColor || '#003D47' },
                            ]}
                          >
                            <View style={styles.topRow}>
                              <View
                                style={[
                                  styles.locBadge,
                                  { backgroundColor: game.is_home ? (theme?.accentGold || '#FFB800') : (theme?.cardBg || '#00262B') },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.locBadgeText,
                                    { color: game.is_home ? '#001417' : (theme?.subText || '#80B3B8') },
                                  ]}
                                >
                                  {game.is_home ? 'HOME' : 'AWAY'}
                                </Text>
                              </View>

                              <Text style={[styles.gameDate, { color: theme?.accentGold || '#FFB800' }]}>
                                {game.date_display || game.game_date}
                              </Text>
                            </View>

                            <View style={styles.matchupRow}>
                              <View style={[styles.teamCircle, { backgroundColor: SJ_THEME.bg, borderWidth: 2, borderColor: SJ_THEME.border }]}>
                                <Text style={[styles.teamCircleText, { color: '#FFFFFF' }]}>SJ</Text>
                              </View>

                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.opponentName, { color: theme?.text || '#FFFFFF' }]}>
                                  {game.is_home ? `vs ${game.opponent}` : `@ ${game.opponent}`}
                                </Text>
                                <Text style={[styles.venueText, { color: theme?.subText || '#80B3B8' }]}>📍 {game.venue}</Text>
                                {isFinal ? (
                                  <Text
                                    style={[
                                      styles.timeText,
                                      { color: sjWon ? '#2FD675' : '#FF5252' },
                                    ]}
                                  >
                                    {sjWon ? 'W' : 'L'} {sjScore}-{oppScore}
                                  </Text>
                                ) : (
                                  <Text style={[styles.timeText, { color: theme?.accentOrange || '#FF671F' }]}>⏰ {game.game_time}</Text>
                                )}
                              </View>

                              {isFinal && (
                                <View
                                  style={[
                                    styles.resultBadge,
                                    { backgroundColor: sjWon ? 'rgba(47, 214, 117, 0.18)' : 'rgba(255, 82, 82, 0.18)', borderColor: sjWon ? '#2FD675' : '#FF5252' },
                                  ]}
                                >
                                  <Text style={[styles.resultBadgeText, { color: sjWon ? '#2FD675' : '#FF5252' }]}>
                                    FINAL
                                  </Text>
                                </View>
                              )}
                            </View>

                            {isFinal && (
                              <TouchableOpacity
                                style={[styles.reportBar, { backgroundColor: theme?.cardBg || '#00262B', borderColor: theme?.accentGold || '#FFB800' }]}
                                onPress={() => openMatchReport(game)}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.reportBarText, { color: theme?.accentGold || '#FFB800' }]}>
                                  📊 View Match Report & Stats
                                </Text>
                              </TouchableOpacity>
                            )}

                            {hasAwayAction ? (
                              <TouchableOpacity
                                style={[
                                  styles.themeActionBar,
                                  { backgroundColor: theme?.cardBg || '#00262B', borderColor: theme?.accentOrange || '#FF671F' },
                                ]}
                                onPress={() => openAwayActionModal(game)}
                                activeOpacity={0.8}
                              >
                                <View style={styles.themeActionLeft}>
                                  <Text style={styles.themeActionIcon}>{isWatchParty ? '📺' : '🚗'}</Text>
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={[styles.themeActionTitle, { color: theme?.accentGold || '#FFB800' }]}
                                      numberOfLines={1}
                                    >
                                      {evt?.title || game.theme_night}
                                    </Text>
                                    <Text style={[styles.themeActionSub, { color: theme?.subText || '#80B3B8' }]}>
                                      Tap for supporter event status & details
                                    </Text>
                                  </View>
                                </View>
                                <Text style={[styles.themeActionBtnText, { color: theme?.accentOrange || '#FF671F' }]}>
                                  Details ➔
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              game.theme_night && (
                                <View
                                  style={[
                                    styles.staticThemeBar,
                                    { backgroundColor: theme?.cardBg || '#00262B', borderColor: theme?.borderColor || '#003D47' },
                                  ]}
                                >
                                  <Text style={[styles.staticThemeText, { color: theme?.accentGold || '#FFB800' }]}>
                                    🌟 {game.theme_night}
                                  </Text>
                                </View>
                              )
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme?.cardBg || '#00262B', borderColor: theme?.accentGold || '#FFB800' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalBadgeText, { color: theme?.accentOrange || '#FF671F' }]}>
                {evt?.badge || selectedGame?.theme_night || 'AWAY SUPPORTER EVENT'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.modalClose, { color: theme?.subText || '#80B3B8' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalMatchupBox, { backgroundColor: theme?.subCardBg || '#00333A', borderColor: theme?.borderColor || '#003D47' }]}>
              <Text style={[styles.modalMatchupTitle, { color: theme?.text || '#FFFFFF' }]}>
                Barracuda @ {selectedGame?.opponent}
              </Text>
              <Text style={[styles.modalMatchupDetail, { color: theme?.subText || '#80B3B8' }]}>
                📍 {evt?.location || selectedGame?.venue}
              </Text>
              <Text style={[styles.modalMatchupDetail, { color: theme?.accentGold || '#FFB800' }]}>
                📅 {selectedGame?.date_display || selectedGame?.game_date} • {selectedGame?.game_time}
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 250, marginVertical: 12 }}>
              <Text style={[styles.descTitle, { color: theme?.accentGold || '#FFB800' }]}>
                {evt?.title || (isWatchParty ? 'Away Watch Party' : 'Road Game Invasion')}
              </Text>
              <Text style={[styles.descBody, { color: theme?.text || '#FFFFFF' }]}>
                {evt?.description ||
                  (isWatchParty
                    ? 'Cheer on our Barracuda with sound on broadcast, raffle prizes, and Section 108 chant energy while the team is on the road!'
                    : 'Join the traveling Battery Pack contingent to bring Section 108 energy to opponent arenas!')}
              </Text>

              {evt?.location && (
                <Text style={[styles.descBody, { color: theme?.subText || '#80B3B8', marginTop: 8 }]}>
                  • <Text style={{ fontWeight: '700', color: theme?.text || '#FFFFFF' }}>Location Details:</Text> {evt.location}
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: theme?.accentGold || '#FFB800' }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalConfirmBtnText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MatchReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        opponentName={reportGame?.opponent || 'Opponent'}
        opponentAbbr={reportGame?.opponent_abbr}
        scoreSJ={
          reportGame
            ? (reportGame.is_home ? reportGame.home_score : reportGame.away_score) || 0
            : 0
        }
        scoreOpp={
          reportGame
            ? (reportGame.is_home ? reportGame.away_score : reportGame.home_score) || 0
            : 0
        }
        loading={reportLoading}
        stats={reportStats}
        gameFact={reportGame?.theme_night ? `Theme Night: ${reportGame.theme_night}` : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: { borderBottomWidth: 1 },
  filterListContainer: { paddingHorizontal: 14, gap: 8, paddingVertical: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: '700' },
  contentPadding: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30 },
  emptyContainer: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginTop: 12 },
  emptyText: { fontSize: 13, fontWeight: '600' },

  monthCard: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthTitle: { fontSize: 15, fontWeight: '900' },
  monthCount: { fontSize: 13, fontWeight: '700' },
  monthArrow: { fontSize: 12, fontWeight: '900' },
  monthGamesContainer: { paddingHorizontal: 10, paddingBottom: 2 },

  gameCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  locBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  locBadgeText: { fontSize: 10, fontWeight: '900' },
  gameDate: { fontSize: 12, fontWeight: '800' },
  matchupRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  teamCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  teamCircleText: { fontSize: 13, fontWeight: '900' },
  opponentName: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  venueText: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  timeText: { fontSize: 11, fontWeight: '800' },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  resultBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  themeActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  themeActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  themeActionIcon: { fontSize: 18 },
  themeActionTitle: { fontSize: 12, fontWeight: '800' },
  themeActionSub: { fontSize: 10, fontWeight: '500' },
  themeActionBtnText: { fontSize: 12, fontWeight: '900' },

  staticThemeBar: { padding: 8, borderRadius: 8, borderWidth: 1, marginTop: 4 },
  staticThemeText: { fontSize: 11, fontWeight: '700', lineHeight: 15 },

  reportBar: { paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', marginTop: 4 },
  reportBarText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },

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