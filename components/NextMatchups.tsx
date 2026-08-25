import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { fetchBarracudaSchedule, GameScheduleItem } from '../services/ahlApi';
import { useAppTheme } from '../context/ThemeContext';

interface TeamTheme {
  name: string;
  abbr: string;
  primaryColor: string;
  textColor: string;
}

const TEAM_THEMES: Record<string, TeamTheme> = {
  gulls: { name: 'Gulls', abbr: 'SD', primaryColor: '#002B49', textColor: '#F15A22' },
  roadrunners: { name: 'Roadrunners', abbr: 'TUC', primaryColor: '#8C2633', textColor: '#C4CED3' },
  wranglers: { name: 'Wranglers', abbr: 'CGY', primaryColor: '#C8102E', textColor: '#F1BE48' },
  firebirds: { name: 'Firebirds', abbr: 'CV', primaryColor: '#B22222', textColor: '#E87722' },
  canucks: { name: 'Canucks', abbr: 'ABB', primaryColor: '#00205B', textColor: '#00843D' },
  condors: { name: 'Condors', abbr: 'BAK', primaryColor: '#002B49', textColor: '#CF4520' },
  reign: { name: 'Reign', abbr: 'ONT', primaryColor: '#111111', textColor: '#A2AAAD' },
  knights: { name: 'Silver Knights', abbr: 'HSK', primaryColor: '#4A4A4A', textColor: '#C5B783' },
  stars: { name: 'Stars', abbr: 'TEX', primaryColor: '#006A4E', textColor: '#00B140' },
  wolves: { name: 'Wolves', abbr: 'CHI', primaryColor: '#5B0612', textColor: '#EAA11F' },
  eagles: { name: 'Eagles', abbr: 'COL', primaryColor: '#002B49', textColor: '#C8102E' },
};

function getTeamDetails(fullName: string): TeamTheme {
  const lower = fullName.toLowerCase();
  for (const key of Object.keys(TEAM_THEMES)) {
    if (lower.includes(key)) {
      return TEAM_THEMES[key];
    }
  }
  const cleanName = fullName.replace(/(San Jose|San Diego|Colorado|Ontario|Bakersfield|Calgary|Abbotsford|Tucson|Coachella Valley|Henderson|Texas|Chicago)\s+/i, '').trim();
  return {
    name: cleanName || fullName,
    abbr: cleanName.substring(0, 3).toUpperCase(),
    primaryColor: '#002F35',
    textColor: '#DD8943',
  };
}

export default function NextMatchups() {
  const { theme } = useAppTheme();
  const [games, setGames] = useState<GameScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchBarracudaSchedule()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setGames(data.slice(0, 4));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const safeGames = Array.isArray(games) && games.length > 0 ? games : [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>NEXT MATCHUPS</Text>
        <Text style={[styles.leagueTag, { color: theme.subText }]}>AHL PACIFIC</Text>
      </View>

      {loading && safeGames.length === 0 ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator color={theme.accentGold} size="small" />
        </View>
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.scrollList}
        >
          {safeGames.map((game) => {
            const isHome = game.homeAway === 'HOME';
            const opp = getTeamDetails(game.opponent);

            return (
              <View 
                key={game.id || Math.random().toString()} 
                style={[
                  styles.matchupCard, 
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor }
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, isHome ? styles.homeBadge : styles.awayBadge]}>
                    <Text style={styles.badgeText}>{game.homeAway}</Text>
                  </View>
                  <Text style={[styles.dateText, { color: theme.subText }]}>{game.date}</Text>
                </View>

                <View style={styles.teamsRow}>
                  {/* San Jose Barracuda: Teal fill + Orange border */}
                  <View style={styles.teamCol}>
                    <View style={[styles.teamCircle, { backgroundColor: '#002D33', borderColor: '#FF6B00' }]}>
                      <Text style={[styles.teamCircleText, { color: '#FFFFFF' }]}>SJ</Text>
                    </View>
                    <Text style={[styles.teamLabel, { color: theme.text }]}>Barracuda</Text>
                  </View>

                  <Text style={[styles.vsText, { color: theme.accentGold }]}>VS</Text>

                  {/* Opponent */}
                  <View style={styles.teamCol}>
                    <View style={[styles.teamCircle, { backgroundColor: opp.primaryColor, borderColor: opp.textColor }]}>
                      <Text style={[styles.teamCircleText, { color: opp.textColor }]}>{opp.abbr}</Text>
                    </View>
                    <Text style={[styles.teamLabel, { color: opp.textColor }]} numberOfLines={1}>
                      {opp.name}
                    </Text>
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
            );
          })}
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
  teamCol: { alignItems: 'center', width: 75 },
  teamCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 4 },
  teamCircleText: { fontWeight: '900', fontSize: 13 },
  teamLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  vsText: { fontWeight: '900', fontSize: 11 },
  cardFooter: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, gap: 2 },
  timeText: { fontSize: 10, fontWeight: '700' },
  venueText: { fontSize: 9 },
  themeText: { fontSize: 9, fontWeight: '700' },
});