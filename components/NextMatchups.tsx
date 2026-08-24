import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { fetchNextThreeGames, AHLGameSchedule } from '../services/ahlApi';
import { useAppTheme } from '../context/ThemeContext';

export default function NextMatchups() {
  const { theme } = useAppTheme();
  const [games, setGames] = useState<AHLGameSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      const data = await fetchNextThreeGames();
      setGames(data);
      setLoading(false);
    }
    loadGames();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>NEXT MATCHUPS</Text>
        <Text style={[styles.leagueTag, { color: theme.subText }]}>AHL PACIFIC</Text>
      </View>

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator color={theme.accentGold} size="small" />
        </View>
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.scrollList}
        >
          {games.map((game) => (
            <View 
              key={game.id} 
              style={[
                styles.matchupCard, 
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor }
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.badge, game.isHome ? styles.homeBadge : styles.awayBadge]}>
                  <Text style={styles.badgeText}>{game.isHome ? 'HOME' : 'AWAY'}</Text>
                </View>
                <Text style={[styles.dateText, { color: theme.subText }]}>{game.dayOfWeek}, {game.date}</Text>
              </View>

              <View style={styles.teamsRow}>
                <View style={styles.teamCol}>
                  <View style={[styles.teamCircle, { backgroundColor: theme.subCardBg, borderColor: theme.accentGold }]}>
                    <Text style={styles.teamCircleText}>SJ</Text>
                  </View>
                  <Text style={[styles.teamLabel, { color: theme.text }]}>Barracuda</Text>
                </View>

                <Text style={[styles.vsText, { color: theme.accentGold }]}>VS</Text>

                <View style={styles.teamCol}>
                  <View style={[styles.teamCircle, styles.opponentCircle]}>
                    <Text style={styles.teamCircleText}>{game.opponentAbbr}</Text>
                  </View>
                  <Text style={[styles.teamLabel, { color: theme.text }]} numberOfLines={1}>{game.opponentAbbr}</Text>
                </View>
              </View>

              <View style={[styles.cardFooter, { borderTopColor: theme.borderColor }]}>
                <Text style={[styles.timeText, { color: theme.text }]}>⏰ {game.time}</Text>
                <Text style={[styles.venueText, { color: theme.subText }]} numberOfLines={1}>📍 {game.venue}</Text>
                {game.themeNight && (
                  <Text style={[styles.themeText, { color: theme.accentGold }]} numberOfLines={1}>
                    🎉 {game.themeNight}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  leagueTag: { fontSize: 10, fontWeight: '700' },
  loaderBox: { height: 140, justifyContent: 'center', alignItems: 'center' },
  scrollList: { gap: 10 },
  matchupCard: { width: 220, borderRadius: 14, padding: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  homeBadge: { backgroundColor: '#00424A', borderWidth: 1, borderColor: '#FFB800' },
  awayBadge: { backgroundColor: 'rgba(221, 137, 67, 0.25)', borderWidth: 1, borderColor: '#DD8943' },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
  dateText: { fontSize: 11, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginVertical: 4 },
  teamCol: { alignItems: 'center', width: 70 },
  teamCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 3 },
  opponentCircle: { backgroundColor: '#002F35', borderColor: '#DD8943' },
  teamCircleText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  teamLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  vsText: { fontWeight: '900', fontSize: 11 },
  cardFooter: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, gap: 2 },
  timeText: { fontSize: 10, fontWeight: '700' },
  venueText: { fontSize: 9 },
  themeText: { fontSize: 9, fontWeight: '700' },
});