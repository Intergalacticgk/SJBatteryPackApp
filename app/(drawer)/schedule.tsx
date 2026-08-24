import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  StatusBar 
} from 'react-native';
import { fetchFullSeasonSchedule, AHLGameSchedule } from '../../services/ahlApi';
import { useAppTheme } from '../../context/ThemeContext';

export default function ScheduleScreen() {
  const { theme } = useAppTheme();
  const [scheduleData, setScheduleData] = useState<Record<string, AHLGameSchedule[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({
    OCT: true, // Default first month open
  });

  const MONTHS_ORDER = ['OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR'];

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchFullSeasonSchedule();
      setScheduleData(data);
      setLoading(false);
    }
    loadData();
  }, []);

  const toggleMonth = (m: string) => {
    setExpandedMonths((prev) => ({ ...prev, [m]: !prev[m] }));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.accentGold} />
          <Text style={[styles.loadingText, { color: theme.accentGold }]}>Loading Full Season Schedule...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList}>
          
          <View style={[styles.headerBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>2026-27 BARRACUDA SCHEDULE</Text>
            <Text style={[styles.bannerSub, { color: theme.subText }]}>Tap any month to expand & view matchups</Text>
          </View>

          {MONTHS_ORDER.map((m) => {
            const games = scheduleData[m] || [];
            const isExpanded = !!expandedMonths[m];

            return (
              <View key={m} style={[styles.monthCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                {/* Month Header / Accordion Toggle */}
                <TouchableOpacity 
                  style={styles.monthHeader}
                  onPress={() => toggleMonth(m)}
                  activeOpacity={0.8}
                >
                  <View style={styles.monthHeaderLeft}>
                    <View style={[styles.monthBadge, { backgroundColor: theme.subCardBg }]}>
                      <Text style={[styles.monthBadgeText, { color: theme.accentGold }]}>{m}</Text>
                    </View>
                    <Text style={[styles.monthTitleText, { color: theme.text }]}>
                      {m === 'OCT' && 'October 2026'}
                      {m === 'NOV' && 'November 2026'}
                      {m === 'DEC' && 'December 2026'}
                      {m === 'JAN' && 'January 2027'}
                      {m === 'FEB' && 'February 2027'}
                      {m === 'MAR' && 'March 2027'}
                      {m === 'APR' && 'April 2027'}
                    </Text>
                    <Text style={[styles.gameCountPill, { color: theme.subText }]}>({games.length} Games)</Text>
                  </View>
                  <Text style={[styles.arrowIcon, { color: theme.accentGold }]}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {/* Expanded Month Matchups */}
                {isExpanded && (
                  <View style={styles.gamesList}>
                    {games.length === 0 ? (
                      <Text style={[styles.noGamesText, { color: theme.subText }]}>No games scheduled for {m}</Text>
                    ) : (
                      games.map((game) => {
                        const isFinal = game.status.toLowerCase().includes('final') || game.scoreSJ !== undefined;
                        const isWin = (game.scoreSJ || 0) > (game.scoreOpp || 0);

                        return (
                          <View key={game.id} style={[styles.gameItem, { borderTopColor: theme.borderColor }]}>
                            <View style={styles.gameItemTop}>
                              <View style={styles.badgeRow}>
                                <View style={[styles.badge, game.isHome ? styles.homeBadge : styles.awayBadge]}>
                                  <Text style={styles.badgeText}>{game.isHome ? 'HOME' : 'AWAY'}</Text>
                                </View>
                                {isFinal && (
                                  <View style={[styles.badge, isWin ? styles.winBadge : styles.lossBadge]}>
                                    <Text style={styles.badgeText}>{isWin ? 'FINAL (W)' : 'FINAL (L)'}</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.gameDateText, { color: theme.subText }]}>{game.dayOfWeek}, {game.date}</Text>
                            </View>

                            <View style={styles.matchupRow}>
                              <Text style={[styles.teamName, { color: theme.text }]}>SJ Barracuda</Text>
                              {isFinal ? (
                                <Text style={[styles.finalScore, { color: theme.accentGold }]}>
                                  {game.scoreSJ} - {game.scoreOpp}
                                </Text>
                              ) : (
                                <Text style={[styles.vsText, { color: theme.accentGold }]}>VS</Text>
                              )}
                              <Text style={[styles.teamName, { color: theme.text, textAlign: 'right' }]} numberOfLines={1}>
                                {game.opponentName}
                              </Text>
                            </View>

                            <View style={styles.gameFooter}>
                              <Text style={[styles.venueText, { color: theme.subText }]}>📍 {game.venue}</Text>
                              <Text style={[styles.timeText, { color: theme.text }]}>
                                {isFinal ? 'Final' : `⏰ ${game.time}`}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollList: { padding: 14, paddingBottom: 40 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontWeight: '800' },
  headerBanner: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  bannerSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  monthCard: { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  monthBadgeText: { fontWeight: '900', fontSize: 11 },
  monthTitleText: { fontWeight: '800', fontSize: 14 },
  gameCountPill: { fontSize: 11, fontWeight: '600' },
  arrowIcon: { fontSize: 12, fontWeight: '900' },
  gamesList: { paddingHorizontal: 12, paddingBottom: 6 },
  noGamesText: { paddingVertical: 10, textAlign: 'center', fontStyle: 'italic', fontSize: 12 },
  gameItem: { borderTopWidth: 1, paddingVertical: 10 },
  gameItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  homeBadge: { backgroundColor: '#00424A' },
  awayBadge: { backgroundColor: '#DD8943' },
  winBadge: { backgroundColor: '#2ecc71' },
  lossBadge: { backgroundColor: '#e74c3c' },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  gameDateText: { fontSize: 11, fontWeight: '700' },
  matchupRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  teamName: { fontSize: 13, fontWeight: '800', width: '38%' },
  finalScore: { fontSize: 16, fontWeight: '900', textAlign: 'center', width: '24%' },
  vsText: { fontSize: 12, fontWeight: '900', textAlign: 'center', width: '24%' },
  gameFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  venueText: { fontSize: 10 },
  timeText: { fontSize: 10, fontWeight: '700' },
});