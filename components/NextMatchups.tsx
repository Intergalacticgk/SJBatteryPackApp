import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../supabase';
import { useAppTheme } from '../context/ThemeContext';
import { SJ_THEME } from './MatchReportModal';

interface GameScheduleItem {
  id: string;
  game_date: string;
  date_display?: string;
  game_time: string;
  opponent: string;
  home_away: 'HOME' | 'AWAY';
  venue?: string;
  theme_night?: string;
  preview_text?: string | null;
}

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
  const lower = (fullName || '').toLowerCase();
  for (const key of Object.keys(TEAM_THEMES)) {
    if (lower.includes(key)) {
      return TEAM_THEMES[key];
    }
  }
  const cleanName = (fullName || '')
    .replace(/(San Jose|San Diego|Colorado|Ontario|Bakersfield|Calgary|Abbotsford|Tucson|Coachella Valley|Henderson|Texas|Chicago)\s+/i, '')
    .trim();

  return {
    name: cleanName || fullName || 'Opponent',
    abbr: cleanName ? cleanName.substring(0, 3).toUpperCase() : 'OPP',
    primaryColor: '#002F35',
    textColor: '#DD8943',
  };
}

export default function NextMatchups() {
  const { theme } = useAppTheme();
  const [games, setGames] = useState<GameScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSchedule = async () => {
      try {
        const todayString = new Date().toLocaleDateString('sv-SE');
        const { data, error } = await supabase
          .from('schedule')
          .select('*')
          .gte('game_date', todayString)
          .order('game_date', { ascending: true })
          .limit(4);

        if (error) throw error;
        if (isMounted && Array.isArray(data)) {
          setGames(data);
        }
      } catch (err) {
        console.warn('NextMatchups Supabase schedule query fallback:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSchedule();

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          {safeGames.map((game) => {
            const isHome = game.home_away === 'HOME';
            const opp = getTeamDetails(game.opponent);

            return (
              <View
                key={game.id || Math.random().toString()}
                style={[styles.matchupCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, isHome ? styles.homeBadge : styles.awayBadge]}>
                    <Text style={styles.badgeText}>{game.home_away}</Text>
                  </View>
                  <Text style={[styles.dateText, { color: theme.subText }]}>
                    {game.date_display || game.game_date}
                  </Text>
                </View>

                <View style={styles.teamsRow}>
                  <View style={styles.teamCol}>
                    <View style={[styles.teamCircle, styles.sjCircle]}>
                      <Text style={styles.sjCircleText}>SJ</Text>
                    </View>
                    <Text style={[styles.teamLabel, { color: theme.text }]}>Barracuda</Text>
                  </View>

                  <Text style={[styles.vsText, { color: theme.accentGold }]}>VS</Text>

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
                  <Text style={[styles.timeText, { color: theme.text }]}>⏰ {game.game_time}</Text>
                  <Text style={[styles.venueText, { color: theme.subText }]} numberOfLines={1}>
                    📍 {game.venue || (isHome ? 'Tech CU Arena' : 'Away Arena')}
                  </Text>
                  {game.theme_night ? (
                    <Text style={[styles.themeText, { color: theme.accentGold }]} numberOfLines={1}>
                      🎉 {game.theme_night}
                    </Text>
                  ) : null}
                </View>

                {game.preview_text ? (
                  <View style={[styles.previewBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.previewLabel, { color: theme.accentGold }]}>MATCHUP PREVIEW</Text>
                    <Text style={[styles.previewText, { color: theme.text }]}>{game.preview_text}</Text>
                  </View>
                ) : null}
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
  matchupCard: { width: 260, borderRadius: 14, padding: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  homeBadge: { backgroundColor: '#00424A', borderWidth: 1, borderColor: '#FFB800' },
  awayBadge: { backgroundColor: 'rgba(221, 137, 67, 0.25)', borderWidth: 1, borderColor: '#DD8943' },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
  dateText: { fontSize: 11, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginVertical: 4 },
  teamCol: { alignItems: 'center', width: 75 },
  teamCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 4 },
  sjCircle: { backgroundColor: SJ_THEME.bg, borderColor: SJ_THEME.border },
  sjCircleText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  teamCircleText: { fontWeight: '900', fontSize: 13 },
  teamLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  vsText: { fontWeight: '900', fontSize: 11 },
  cardFooter: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, gap: 2 },
  timeText: { fontSize: 10, fontWeight: '700' },
  venueText: { fontSize: 9 },
  themeText: { fontSize: 9, fontWeight: '700' },
  previewBox: { marginTop: 8, padding: 8, borderRadius: 8, borderWidth: 1 },
  previewLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginBottom: 3 },
  previewText: { fontSize: 10, fontWeight: '500', lineHeight: 14 },
});