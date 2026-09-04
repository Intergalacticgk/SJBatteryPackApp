import React, { useState, useEffect } from 'react';
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
  home_team: string;
  away_team: string;
  home_abbr?: string;
  away_abbr?: string;
  opponent?: string;
  opponent_abbr?: string;
  is_home: boolean;
  location?: string;
  theme_night?: string;
  promo?: string;
  status?: string;
}

export default function ScheduleScreen() {
  const { theme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<ScheduleTab>('ALL');
  const [games, setGames] = useState<GameScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
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

  const handleOpenTicketmaster = async () => {
    try {
      await WebBrowser.openBrowserAsync(TICKETMASTER_BARRACUDA_URL);
    } catch {
      Linking.openURL(TICKETMASTER_BARRACUDA_URL);
    }
  };

  // Helper to format 24h or ISO time into 12-hour AM/PM PST
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'TBD';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm} PST`;
  };

  // 3. Tab Filter Logic (Excludes all away games when on the THEME tab)
  const filteredGames = games.filter((game) => {
    const isHomeGame =
      game.is_home === true ||
      game.home_team?.toLowerCase().includes('barracuda') ||
      game.home_abbr === 'SJ';

    if (activeTab === 'HOME') return isHomeGame;
    if (activeTab === 'AWAY') return !isHomeGame;
    if (activeTab === 'THEME') {
      // Strictly Home Games with a theme/promo defined
      const hasTheme = Boolean(game.theme_night || game.promo);
      return isHomeGame && hasTheme;
    }
    return true; // 'ALL'
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* Header Banner */}
      <View style={[styles.headerBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
        <Text style={[styles.headerTitle, { color: theme.accentGold }]}>2025–26 SEASON SCHEDULE</Text>
        <Text style={[styles.headerSub, { color: theme.text }]}>
          Defend The Reef at Tech CU Arena & on the road 🦈
        </Text>
      </View>

      {/* Tabs Row */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        {(['ALL', 'HOME', 'AWAY', 'THEME'] as ScheduleTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label =
            tab === 'ALL'
              ? 'All Games'
              : tab === 'HOME'
              ? 'Home'
              : tab === 'AWAY'
              ? 'Away'
              : '🎉 Theme Nights';

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
              <Text
                style={[
                  styles.tabText,
                  { color: theme.subText },
                  isActive && { color: '#001417', fontWeight: '900' },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Schedule Feed */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={theme.accentGold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredGames.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                No games scheduled under this category.
              </Text>
            </View>
          ) : (
            filteredGames.map((game, index) => {
              const isHomeGame =
                game.is_home === true ||
                game.home_team?.toLowerCase().includes('barracuda') ||
                game.home_abbr === 'SJ';

              const opponentName = isHomeGame ? game.away_team : game.home_team;
              const opponentAbbr = isHomeGame
                ? game.away_abbr || opponentName?.substring(0, 3).toUpperCase() || 'OPP'
                : game.home_abbr || opponentName?.substring(0, 3).toUpperCase() || 'OPP';

              const themeTitle = game.theme_night || game.promo;

              return (
                <View
                  key={game.id || String(index)}
                  style={[styles.gameCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  {/* Card Header: Date, Time & Arena */}
                  <View style={[styles.gameCardHeader, { borderBottomColor: theme.borderColor }]}>
                    <Text style={[styles.gameDateText, { color: theme.accentGold }]}>
                      📅 {game.game_date}
                    </Text>
                    <Text style={[styles.gameTimeText, { color: theme.subText }]}>
                      ⏰ {formatTime(game.game_time)}
                    </Text>
                  </View>

                  {/* Matchup Layout */}
                  <View style={styles.matchupRow}>
                    {/* Left Team (San Jose Barracuda) */}
                    <View style={styles.teamColumn}>
                      {/* 1. Teal Circle with Black Outline */}
                      <View style={styles.sjBadgeCircle}>
                        <Text style={styles.sjBadgeText}>SJ</Text>
                      </View>
                      <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>
                        Barracuda
                      </Text>
                      <Text style={[styles.homeAwayTag, { color: theme.accentGold }]}>
                        {isHomeGame ? 'HOME' : 'AWAY'}
                      </Text>
                    </View>

                    {/* VS / AT Divider */}
                    <View style={styles.vsContainer}>
                      <Text style={[styles.vsText, { color: theme.subText }]}>
                        {isHomeGame ? 'VS' : '@'}
                      </Text>
                    </View>

                    {/* Right Team (Opponent) */}
                    <View style={styles.teamColumn}>
                      <View style={styles.opponentBadgeCircle}>
                        <Text style={styles.opponentBadgeText}>{opponentAbbr}</Text>
                      </View>
                      <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>
                        {opponentName || 'Opponent'}
                      </Text>
                      <Text style={[styles.homeAwayTag, { color: theme.subText }]}>
                        {isHomeGame ? 'AWAY' : 'HOME'}
                      </Text>
                    </View>
                  </View>

                  {/* Theme / Promotional Banner (if applicable) */}
                  {themeTitle && (
                    <View style={[styles.promoBox, { backgroundColor: theme.subCardBg, borderColor: theme.accentGold }]}>
                      <Text style={[styles.promoText, { color: theme.accentGold }]}>
                        🎉 <Text style={{ fontWeight: '900' }}>Theme:</Text> {themeTitle}
                      </Text>
                    </View>
                  )}

                  {/* Card Actions: Buy Tickets */}
                  <View style={[styles.cardFooter, { borderTopColor: theme.borderColor }]}>
                    <TouchableOpacity
                      style={[styles.buyTicketsBtn, { backgroundColor: theme.accentOrange }]}
                      onPress={handleOpenTicketmaster}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.buyTicketsText}>🎟️ Buy Tickets on Ticketmaster ➔</Text>
                    </TouchableOpacity>
                  </View>
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
  headerBanner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { fontSize: 12, textAlign: 'center', fontWeight: '600', marginTop: 2 },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 14,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 11, fontWeight: '800' },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 40 },
  gameCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  gameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  gameDateText: { fontSize: 12, fontWeight: '800' },
  gameTimeText: { fontSize: 11, fontWeight: '700' },
  matchupRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  teamColumn: { alignItems: 'center', width: '38%' },

  // 1. Updated SJ Badge: Teal circle with Solid Black Outline
  sjBadgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#266B73',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  sjBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Opponent Team Badge
  opponentBadgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#002B49',
    borderWidth: 1.5,
    borderColor: '#80B3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  opponentBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  teamName: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  homeAwayTag: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  vsContainer: { width: 32, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 14, fontWeight: '900' },

  promoBox: {
    marginHorizontal: 12,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  promoText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  // 2. Buy Tickets Action Bar
  cardFooter: { padding: 10, borderTopWidth: 1 },
  buyTicketsBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyTicketsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

  emptyCard: { padding: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 13, fontWeight: '600' },
});