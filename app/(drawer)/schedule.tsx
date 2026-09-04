import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

const TICKETMASTER_BARRACUDA_URL = 'https://www.ticketmaster.com/san-jose-barracuda-tickets/artist/2148253';

type ScheduleTab = 'ALL' | 'HOME' | 'AWAY' | 'THEME';

interface GameScheduleItem {
  id: string;
  game_date: string;
  game_time: string;
  opponent?: string;
  opponent_abbr?: string;
  home_away: 'HOME' | 'AWAY';
  venue?: string;
  theme_night?: string;
  promo?: string;
  status?: string;
  home_score?: number;
  away_score?: number;
}

const AHL_TEAM_COLORS: Record<string, { bg: string; text: string }> = {
  SD: { bg: '#FF4C00', text: '#FFFFFF' },   // San Diego Gulls
  TUC: { bg: '#8C2633', text: '#FFFFFF' },  // Tucson Roadrunners
  CGY: { bg: '#C8102E', text: '#FFFFFF' },  // Calgary Wranglers
  CV: { bg: '#D82232', text: '#FFFFFF' },   // Coachella Valley Firebirds
  ABB: { bg: '#00843D', text: '#FFFFFF' },  // Abbotsford Canucks
  BAK: { bg: '#002D62', text: '#FFFFFF' },  // Bakersfield Condors
  ONT: { bg: '#222222', text: '#FFFFFF' },  // Ontario Reign
  HSK: { bg: '#777777', text: '#FFFFFF' },  // Henderson Silver Knights
  TEX: { bg: '#006847', text: '#FFFFFF' },  // Texas Stars
  COL: { bg: '#6F263D', text: '#FFFFFF' },  // Colorado Eagles
  DEFAULT: { bg: '#1E293B', text: '#FFFFFF' }
};

export default function ScheduleScreen() {
  const { theme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<ScheduleTab>('ALL');
  const [games, setGames] = useState<GameScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('schedule')
        .select('*')
        .order('game_date', { ascending: true });

      if (error) throw error;
      if (data) {
        setGames(data as GameScheduleItem[]);
      }
    } catch (err) {
      console.warn('Could not fetch schedule, using local fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSchedule();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchSchedule();
    setLoading(true);
  }, []);

  const handleOpenTicketmaster = async () => {
    try {
      await WebBrowser.openBrowserAsync(TICKETMASTER_BARRACUDA_URL);
    } catch {
      Linking.openURL(TICKETMASTER_BARRACUDA_URL);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'TBD';
    if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) return `${timeStr} PST`;
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm} PST`;
  };

  const filteredGames = games.filter((game) => {
    const isHomeGame = game.home_away === 'HOME';

    if (activeTab === 'HOME') return isHomeGame;
    if (activeTab === 'AWAY') return !isHomeGame;
    if (activeTab === 'THEME') {
      const hasTheme = Boolean(game.theme_night?.trim() || game.promo?.trim());
      return isHomeGame && hasTheme;
    }
    return true; 
  });

  const getOpponentColors = (abbr?: string) => {
    const key = (abbr || '').toUpperCase().trim();
    return AHL_TEAM_COLORS[key] || AHL_TEAM_COLORS.DEFAULT;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      <View style={[styles.headerBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
        <Text style={[styles.headerTitle, { color: theme.accentGold }]}>2025–26 SEASON SCHEDULE</Text>
        <Text style={[styles.headerSub, { color: theme.text }]}>Defend The Reef at Tech CU Arena & on the road 🦈</Text>
      </View>

      <View style={[styles.tabsContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        {(['ALL', 'HOME', 'AWAY', 'THEME'] as ScheduleTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'ALL' ? 'All Games' : tab === 'HOME' ? 'Home' : tab === 'AWAY' ? 'Away' : '🎉 Theme Nights';

          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabPill,
                { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                isActive && { backgroundColor: theme.accentGold, borderColor: theme.accentGold },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: theme.subText }, isActive && { color: '#001417', fontWeight: '900' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={theme.accentGold} />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentGold} colors={[theme.accentGold, theme.accentOrange]} />}
        >
          {filteredGames.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.emptyText, { color: theme.subText }]}>No games scheduled under this category.</Text>
            </View>
          ) : (
            filteredGames.map((game, index) => {
              const isHomeGame = game.home_away === 'HOME';
              const oppColors = getOpponentColors(game.opponent_abbr);
              const themeTitle = game.theme_night || game.promo;
              const isFinal = game.status?.toUpperCase() === 'FINAL';

              return (
                <View key={game.id || String(index)} style={[styles.gameCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={[styles.gameCardHeader, { borderBottomColor: theme.borderColor }]}>
                    <Text style={[styles.gameDateText, { color: theme.accentGold }]}>📅 {game.game_date}</Text>
                    <Text style={[styles.gameTimeText, { color: theme.subText }]}>
                      {isFinal ? 'FINAL' : `⏰ ${formatTime(game.game_time)}`}
                    </Text>
                  </View>

                  <View style={styles.matchupRow}>
                    <View style={styles.teamColumn}>
                      <View style={[styles.badgeCircle, { backgroundColor: isHomeGame ? '#266B73' : oppColors.bg, borderColor: isHomeGame ? '#000' : '#80B3B8' }]}>
                        <Text style={[styles.badgeText, { color: isHomeGame ? '#FFF' : oppColors.text }]}>
                          {isHomeGame ? 'SJ' : game.opponent_abbr || 'OPP'}
                        </Text>
                      </View>
                      <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>{isHomeGame ? 'Barracuda' : game.opponent}</Text>
                      {isFinal && <Text style={[styles.scoreText, { color: theme.text }]}>{isHomeGame ? game.home_score : game.away_score}</Text>}
                    </View>

                    <View style={styles.vsContainer}>
                      <Text style={[styles.vsText, { color: theme.subText }]}>{isHomeGame ? 'VS' : '@'}</Text>
                    </View>

                    <View style={styles.teamColumn}>
                      <View style={[styles.badgeCircle, { backgroundColor: isHomeGame ? oppColors.bg : '#266B73', borderColor: isHomeGame ? '#80B3B8' : '#000' }]}>
                        <Text style={[styles.badgeText, { color: isHomeGame ? oppColors.text : '#FFF' }]}>
                          {isHomeGame ? game.opponent_abbr || 'OPP' : 'SJ'}
                        </Text>
                      </View>
                      <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>{isHomeGame ? game.opponent : 'Barracuda'}</Text>
                      {isFinal && <Text style={[styles.scoreText, { color: theme.text }]}>{isHomeGame ? game.away_score : game.home_score}</Text>}
                    </View>
                  </View>

                  {themeTitle && (
                    <View style={[styles.promoBox, { backgroundColor: theme.subCardBg, borderColor: theme.accentGold }]}>
                      <Text style={[styles.promoText, { color: theme.accentGold }]}>🎉 <Text style={{ fontWeight: '900' }}>Theme:</Text> {themeTitle}</Text>
                    </View>
                  )}

                  {!isFinal && isHomeGame && (
                    <View style={[styles.cardFooter, { borderTopColor: theme.borderColor }]}>
                      <TouchableOpacity style={[styles.buyTicketsBtn, { backgroundColor: theme.accentOrange }]} onPress={handleOpenTicketmaster} activeOpacity={0.85}>
                        <Text style={styles.buyTicketsText}>🎟️ Buy Tickets on Ticketmaster ➔</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBanner: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginHorizontal: 14, marginTop: 10, marginBottom: 8, borderWidth: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { fontSize: 12, textAlign: 'center', fontWeight: '600', marginTop: 2 },
  tabsContainer: { flexDirection: 'row', marginHorizontal: 14, padding: 6, borderRadius: 12, borderWidth: 1, gap: 6, justifyContent: 'space-between', marginBottom: 10 },
  tabPill: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 11, fontWeight: '800' },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 40 },
  gameCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  gameCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  gameDateText: { fontSize: 12, fontWeight: '800' },
  gameTimeText: { fontSize: 11, fontWeight: '700' },
  matchupRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10 },
  teamColumn: { alignItems: 'center', width: '38%' },
  badgeCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  badgeText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  teamName: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  scoreText: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  vsContainer: { width: 32, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 14, fontWeight: '900' },
  promoBox: { marginHorizontal: 12, marginBottom: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  promoText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  cardFooter: { padding: 10, borderTopWidth: 1 },
  buyTicketsBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buyTicketsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  emptyCard: { padding: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 13, fontWeight: '600' },
});