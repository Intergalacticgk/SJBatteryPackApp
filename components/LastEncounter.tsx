import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { supabase } from '../supabase';
import { useAppTheme } from '../context/ThemeContext';
import MatchReportModal, {
  GameStats,
  SJ_THEME,
  getOpponentTheme,
  mapGamecenterSummary,
} from './MatchReportModal';

export interface LastEncounterGame {
  id?: string | number;
  game_id?: string | number;
  opponent?: string | null;
  opponent_abbr?: string | null;
  game_date?: string | null;
  date_display?: string | null;
  home_away?: 'HOME' | 'AWAY' | string | null;
  home_score?: number | null;
  away_score?: number | null;
  theme_night?: string | null;
  status?: string | null;
  stats?: GameStats | null;
}

const GC_BASE = 'https://lscluster.hockeytech.com/feed/index.php?feed=gc&tab=gamesummary';
const GC_KEY = 'ccb91f29d6744675';

export default function LastEncounter() {
  const { theme } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [lastGame, setLastGame] = useState<LastEncounterGame | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadLastGame() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('schedule')
          .select('*')
          .eq('status', 'FINAL')
          .order('game_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;
        if (error || !data) return;

        const row = data as LastEncounterGame;
        setLastGame(row);

        if (row.stats) {
          setStats(row.stats);
          return;
        }

        if (!row.game_id) {
          return;
        }

        const isSJHome = row.home_away === 'HOME';
        const oppAbbr = row.opponent_abbr || 'OPP';
        const url = `${GC_BASE}&key=${GC_KEY}&client_code=ahl&game_id=${row.game_id}`;

        try {
          const res = await fetch(url);
          const json = await res.json();
          const gc = json?.GC?.Gamesummary;
          const mapped = mapGamecenterSummary(gc, isSJHome, oppAbbr);
          if (isMounted && mapped) setStats(mapped);
        } catch (apiErr) {
          console.warn('Gamecenter feed unavailable:', apiErr);
        }
      } catch (err) {
        console.warn('Error loading encounter:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadLastGame();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || !lastGame) return null;

  const opponentName = lastGame.opponent || 'Opponent';
  const opponentAbbr = lastGame.opponent_abbr || 'OPP';
  const gameDate = lastGame.date_display || lastGame.game_date || '';
  const isHome = lastGame.home_away === 'HOME';
  const scoreSJ = isHome ? (lastGame.home_score || 0) : (lastGame.away_score || 0);
  const scoreOpp = isHome ? (lastGame.away_score || 0) : (lastGame.home_score || 0);
  const isWin = scoreSJ > scoreOpp;
  const opp = getOpponentTheme(opponentName, opponentAbbr);
  const gameFact = lastGame.theme_night ? `Exhibition Matchup: ${lastGame.theme_night}` : '';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>LAST ENCOUNTER</Text>
        <Text style={[styles.dateTag, { color: theme.subText }]}>{gameDate}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={[styles.scoreBanner, { borderBottomColor: theme.borderColor }]}>
          <View style={styles.teamCol}>
            <View style={[styles.teamBadge, styles.sjBadge]}>
              <Text style={styles.sjBadgeText}>SJ</Text>
            </View>
            <Text style={[styles.teamName, { color: theme.text }]}>Barracuda</Text>
            <Text style={[styles.scoreText, { color: theme.text }]}>{scoreSJ}</Text>
          </View>

          <View style={styles.outcomeCol}>
            <View style={[styles.statusPill, isWin ? styles.winPill : styles.lossPill]}>
              <Text style={[styles.statusPillText, { color: isWin ? '#266B73' : '#FF5252' }]}>
                {isWin ? 'FINAL (W)' : 'FINAL (L)'}
              </Text>
            </View>
            <Text style={[styles.vsDivider, { color: theme.subText }]}>—</Text>
          </View>

          <View style={styles.teamCol}>
            <View style={[styles.teamBadge, { backgroundColor: opp.bg, borderColor: opp.text }]}>
              <Text style={[styles.teamBadgeText, { color: opp.text }]}>{opp.abbr}</Text>
            </View>
            <Text style={[styles.teamName, { color: opp.text }]} numberOfLines={1}>
              {opp.name}
            </Text>
            <Text style={[styles.scoreText, { color: theme.text }]}>{scoreOpp}</Text>
          </View>
        </View>

        {gameFact ? (
          <View style={[styles.factContainer, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
            <Text style={styles.factIcon}>💡</Text>
            <Text style={[styles.factText, { color: theme.text }]}>{gameFact}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.statsButton, { backgroundColor: theme.accentOrange }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.statsButtonText}>
            {stats ? '📊 View Stats & Key Plays' : '📊 View Match Report'}
          </Text>
        </TouchableOpacity>
      </View>

      <MatchReportModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        opponentName={opponentName}
        opponentAbbr={opponentAbbr}
        scoreSJ={scoreSJ}
        scoreOpp={scoreOpp}
        stats={stats}
        gameFact={gameFact || null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10, width: '100%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  dateTag: { fontSize: 11, fontWeight: '700' },
  card: { borderRadius: 14, padding: 14, borderWidth: 1, width: '100%' },
  scoreBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, paddingBottom: 10, borderBottomWidth: 1 },
  teamCol: { alignItems: 'center', width: 90 },
  teamBadge: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 4 },
  sjBadge: { backgroundColor: SJ_THEME.bg, borderColor: SJ_THEME.border },
  sjBadgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  teamBadgeText: { fontWeight: '900', fontSize: 13 },
  teamName: { fontSize: 11, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  scoreText: { fontSize: 24, fontWeight: '900' },
  outcomeCol: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1.5 },
  winPill: { backgroundColor: 'transparent', borderColor: '#266B73' },
  lossPill: { backgroundColor: 'rgba(255, 82, 82, 0.18)', borderColor: '#FF5252' },
  statusPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  vsDivider: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  factContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 10, gap: 8 },
  factIcon: { fontSize: 14 },
  factText: { fontSize: 11, fontWeight: '500', flex: 1, lineHeight: 16 },
  statsButton: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  statsButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
});
