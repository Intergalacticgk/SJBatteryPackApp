import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface GameStats {
  sog: [number, number];
  pp: [string, string];
  pim: [number, number];
  foPct: [string, string];
  periods: {
    p1: [number, number];
    p2: [number, number];
    p3: [number, number];
    ot?: [number, number];
  };
  scoringPlays: {
    period: string;
    time: string;
    team: string;
    scorer: string;
    assists: string;
    type?: string;
  }[];
  // AHL Gamecenter's own MVP picks (meta.mvp1/2/3 / the "mvps" array), in
  // 1st/2nd/3rd order — this IS the "three stars of the game".
  threeStars?: {
    rank: number;
    name: string;
    team: string;
  }[];
}

export interface TeamTheme {
  name: string;
  abbr: string;
  bg: string;
  text: string;
  border?: string;
}

// Shared opponent color/abbreviation lookup — kept here so both the Home
// screen's Last Encounter card and the Schedule drawer's per-game Match
// Report modal render identical team badges.
export const OPPONENT_THEMES: Record<string, TeamTheme> = {
  condors: { name: 'Condors', abbr: 'BAK', bg: '#002B49', text: '#CF4520' },
  reign: { name: 'Reign', abbr: 'ONT', bg: '#111111', text: '#A2AAAD' },
  gulls: { name: 'Gulls', abbr: 'SD', bg: '#002B49', text: '#F15A22' },
  firebirds: { name: 'Firebirds', abbr: 'CV', bg: '#B22222', text: '#E87722' },
  canucks: { name: 'Canucks', abbr: 'ABB', bg: '#00205B', text: '#00843D' },
  eagles: { name: 'Eagles', abbr: 'COL', bg: '#002B49', text: '#C8102E' },
  roadrunners: { name: 'Roadrunners', abbr: 'TUC', bg: '#8C2633', text: '#C4CED3' },
  wranglers: { name: 'Wranglers', abbr: 'CGY', bg: '#C8102E', text: '#F1BE48' },
  knights: { name: 'Silver Knights', abbr: 'HSK', bg: '#4A4A4A', text: '#C5B783' },
  stars: { name: 'Stars', abbr: 'TEX', bg: '#006A4E', text: '#00B140' },
  wolves: { name: 'Wolves', abbr: 'CHI', bg: '#5B0612', text: '#EAA11F' },
};

// White outline (not black) on the SJ circle badge everywhere it appears —
// Home's Last Encounter card, the Schedule drawer's game cards, the Next
// Matchups carousel, and this Match Report modal — so it pops against the
// teal fill. Single source of truth here; every badge below reads
// SJ_THEME.border instead of hardcoding a color.
export const SJ_THEME: TeamTheme = { name: 'Barracuda', abbr: 'SJ', bg: '#266B73', text: '#FFFFFF', border: '#FFFFFF' };

export function getOpponentTheme(rawName: string, rawAbbr?: string | null): TeamTheme {
  const lower = (rawName || '').toLowerCase();
  for (const key of Object.keys(OPPONENT_THEMES)) {
    if (lower.includes(key)) return OPPONENT_THEMES[key];
  }
  const clean = (rawName || '')
    .replace(/(San Jose|San Diego|Colorado|Ontario|Bakersfield|Calgary|Abbotsford|Tucson|Coachella Valley|Henderson|Texas|Chicago)\s+/i, '')
    .trim();

  return {
    name: clean || rawName || 'Opponent',
    abbr: rawAbbr || clean.substring(0, 3).toUpperCase() || 'OPP',
    bg: '#002B49',
    text: '#CF4520',
  };
}

// Builds a "F. Lastname" style display from a scoredBy/assist object.
// HockeyTech's feed gives firstName/lastName as separate fields — there is
// no combined ".name" on the scorer object.
export function formatPlayerName(player: any): string {
  if (!player) return '';
  const first = (player.firstName || player.first_name || '').trim();
  const last = (player.lastName || player.last_name || '').trim();
  if (!first && !last) {
    // Some feeds only expose a preformatted name
    return (player.name || '').trim();
  }
  const initial = first ? `${first.charAt(0).toUpperCase()}.` : '';
  return `${initial} ${last}`.trim();
}

// Pure mapper — no fetch calls, easy to reuse and test.
// Parses the AHL "Gamecenter" feed (feed=gc&tab=gamesummary), the source
// confirmed live against real data — including its native "mvps" array,
// which is the three stars of the game.
export function mapGamecenterSummary(
  gc: any,
  isSJHome: boolean,
  oppAbbr: string
): GameStats | null {
  if (!gc || !gc.periods || !gc.home || !gc.visitor) return null;

  const homeSog = Number(gc.totalShots?.home || 0);
  const visSog = Number(gc.totalShots?.visitor || 0);

  const homePP = `${gc.powerPlayGoals?.home || 0}/${gc.powerPlayCount?.home || 0}`;
  const visPP = `${gc.powerPlayGoals?.visitor || 0}/${gc.powerPlayCount?.visitor || 0}`;

  const homePim = Number(gc.pimTotal?.home || 0);
  const visPim = Number(gc.pimTotal?.visitor || 0);

  // Faceoff totals are present on this feed but come back all-zero on games
  // where the stat wasn't tracked — show "—" rather than a fake 0.0%/50%.
  const homeFo = gc.totalFaceoffs?.home;
  const visFo = gc.totalFaceoffs?.visitor;
  const foPctHome = homeFo?.att ? `${((homeFo.won / homeFo.att) * 100).toFixed(1)}%` : '—';
  const foPctVis = visFo?.att ? `${((visFo.won / visFo.att) * 100).toFixed(1)}%` : '—';

  // goalsByPeriod is keyed "1".."4" (4 = OT, only present if the game went
  // past regulation). A shootout is tracked separately (shootoutDetail /
  // meta.shootout), not as an extra period.
  const homeGoalsByP = gc.goalsByPeriod?.home || {};
  const visGoalsByP = gc.goalsByPeriod?.visitor || {};

  const homeP1 = Number(homeGoalsByP['1'] || 0);
  const visP1 = Number(visGoalsByP['1'] || 0);
  const homeP2 = Number(homeGoalsByP['2'] || 0);
  const visP2 = Number(visGoalsByP['2'] || 0);
  const homeP3 = Number(homeGoalsByP['3'] || 0);
  const visP3 = Number(visGoalsByP['3'] || 0);
  const hasOT = homeGoalsByP['4'] != null || visGoalsByP['4'] != null;
  const homeOT = Number(homeGoalsByP['4'] || 0);
  const visOT = Number(visGoalsByP['4'] || 0);

  const periodInfo: Record<string, any> = gc.periods || {};

  const plays = (gc.goals || []).map((g: any) => {
    const scorerName = formatPlayerName(g.goal_scorer) || 'Goal';
    const assists = [g.assist1_player, g.assist2_player].filter(Boolean);
    const assistNames = assists.map((a: any) => formatPlayerName(a)).filter(Boolean).join(', ');
    // Each goal carries its own home/visitor flag directly — no need to
    // cross-reference team ids.
    const scoredByHome = String(g.home) === '1';
    const isSJGoal = isSJHome ? scoredByHome : !scoredByHome;
    const pInfo = periodInfo[String(g.period_id)];

    return {
      period: pInfo?.short_name || pInfo?.long_name || '—',
      time: g.time || '—',
      team: isSJGoal ? 'SJ' : oppAbbr,
      scorer: scorerName,
      assists: assistNames || 'Unassisted',
      type: g.goal_type || (g.short_handed === '1' ? 'SH' : g.empty_net === '1' ? 'EN' : 'EV'),
    };
  });

  const threeStars = (gc.mvps || []).map((m: any, idx: number) => {
    const isSJStar = isSJHome ? Number(m.home) === 1 : Number(m.home) === 0;
    return {
      rank: idx + 1,
      name: formatPlayerName(m),
      team: isSJStar ? 'SJ' : oppAbbr,
    };
  });

  return {
    sog: isSJHome ? [homeSog, visSog] : [visSog, homeSog],
    pp: isSJHome ? [homePP, visPP] : [visPP, homePP],
    pim: isSJHome ? [homePim, visPim] : [visPim, homePim],
    foPct: isSJHome ? [foPctHome, foPctVis] : [foPctVis, foPctHome],
    periods: {
      p1: isSJHome ? [homeP1, visP1] : [visP1, homeP1],
      p2: isSJHome ? [homeP2, visP2] : [visP2, homeP2],
      p3: isSJHome ? [homeP3, visP3] : [visP3, homeP3],
      ot: hasOT ? (isSJHome ? [homeOT, visOT] : [visOT, homeOT]) : undefined,
    },
    scoringPlays: plays,
    threeStars,
  };
}

export interface MatchReportModalProps {
  visible: boolean;
  onClose: () => void;
  opponentName: string;
  opponentAbbr?: string | null;
  scoreSJ: number;
  scoreOpp: number;
  loading?: boolean;
  stats: GameStats | null;
  gameFact?: string | null;
}

// The Match Report & Stats popup — shared by the Home screen's Last
// Encounter card and the per-game cards in the Barracuda Schedule drawer,
// so a fan who missed a game can pull up the same box score from either
// place. Note AHL's own Gamecenter feed (feed=gc&tab=gamesummary) has no
// prose recap/summary field (confirmed directly against the feed) — only
// structured stats — so there's no "AI recap" section here, matching what
// the data actually supports.
export default function MatchReportModal({
  visible,
  onClose,
  opponentName,
  opponentAbbr,
  scoreSJ,
  scoreOpp,
  loading,
  stats,
  gameFact,
}: MatchReportModalProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const opp = getOpponentTheme(opponentName, opponentAbbr);
  const isWin = scoreSJ > scoreOpp;

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.accentGold,
            },
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
            <Text style={[styles.modalHeaderTitle, { color: theme.accentGold }]}>MATCH REPORT & STATS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Text style={[styles.closeIconText, { color: theme.accentGold }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Same fix as the Reef Know Before You Go modal: wrap the
              ScrollView in its own flex:1 + overflow:hidden container so
              Android gives it a real bounded height instead of letting
              content overflow past the modal. */}
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={[
                styles.modalScroll,
                { paddingBottom: Math.max(insets.bottom, 24) + 24 },
              ]}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              <View style={[styles.modalScoreCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.modalGameSub, { color: theme.subText }]}>San Jose Barracuda vs {opp.name}</Text>

                <View style={styles.modalBadgeRow}>
                  <View style={styles.modalBadgeCol}>
                    <View style={[styles.modalTeamBadge, { backgroundColor: SJ_THEME.bg, borderColor: SJ_THEME.border }]}>
                      <Text style={[styles.modalTeamBadgeText, { color: SJ_THEME.text }]}>{SJ_THEME.abbr}</Text>
                    </View>
                    <Text style={[styles.modalLargeScore, { color: theme.text }]}>{scoreSJ}</Text>
                  </View>

                  <Text style={[styles.modalScoreSep, { color: theme.accentGold }]}>-</Text>

                  <View style={styles.modalBadgeCol}>
                    <View style={[styles.modalTeamBadge, { backgroundColor: opp.bg, borderColor: opp.text }]}>
                      <Text style={[styles.modalTeamBadgeText, { color: opp.text }]}>{opp.abbr}</Text>
                    </View>
                    <Text style={[styles.modalLargeScore, { color: theme.text }]}>{scoreOpp}</Text>
                  </View>
                </View>

                <View style={[styles.modalResultPill, isWin ? styles.winPill : styles.lossPill]}>
                  <Text style={[styles.modalResultPillText, { color: isWin ? '#266B73' : '#FF5252' }]}>
                    {isWin ? 'FINAL (W)' : 'FINAL (L)'}
                  </Text>
                </View>
              </View>

              {gameFact ? (
                <View style={[styles.factContainer, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                  <Text style={styles.factIcon}>💡</Text>
                  <Text style={[styles.factText, { color: theme.text }]}>{gameFact}</Text>
                </View>
              ) : null}

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={theme.accentGold} size="small" />
                </View>
              ) : stats ? (
                <>
                  <Text style={[styles.subSectionTitle, { color: theme.accentGold }]}>PERIOD BREAKDOWN</Text>
                  <View style={[styles.tableCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                    <View style={[styles.tableRowHeader, { borderBottomColor: theme.borderColor }]}>
                      <Text style={[styles.tableCellTeamHeader, { color: theme.subText }]}>Team</Text>
                      <Text style={[styles.tableCellHeader, { color: theme.subText }]}>1st</Text>
                      <Text style={[styles.tableCellHeader, { color: theme.subText }]}>2nd</Text>
                      <Text style={[styles.tableCellHeader, { color: theme.subText }]}>3rd</Text>
                      {stats.periods.ot ? <Text style={[styles.tableCellHeader, { color: theme.subText }]}>OT</Text> : null}
                      <Text style={[styles.tableCellHeader, styles.boldCell, { color: theme.accentGold }]}>F</Text>
                    </View>

                    <View style={[styles.tableRow, { borderBottomColor: theme.borderColor }]}>
                      <Text style={[styles.tableCellTeamData, { color: theme.text, fontWeight: '800' }]}>SJ</Text>
                      <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p1[0]}</Text>
                      <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p2[0]}</Text>
                      <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p3[0]}</Text>
                      {stats.periods.ot ? <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.ot[0]}</Text> : null}
                      <Text style={[styles.tableCellData, styles.boldCell, { color: theme.accentGold }]}>{scoreSJ}</Text>
                    </View>

                    <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                      <Text style={[styles.tableCellTeamData, { color: opp.text, fontWeight: '800' }]}>{opp.abbr}</Text>
                      <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p1[1]}</Text>
                      <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p2[1]}</Text>
                      <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p3[1]}</Text>
                      {stats.periods.ot ? <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.ot[1]}</Text> : null}
                      <Text style={[styles.tableCellData, styles.boldCell, { color: theme.accentGold }]}>{scoreOpp}</Text>
                    </View>
                  </View>

                  <Text style={[styles.subSectionTitle, { color: theme.accentGold }]}>TEAM COMPARISON</Text>
                  <View style={[styles.statComparisonBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                    <View style={[styles.statHeaderRow, { borderBottomColor: theme.borderColor }]}>
                      <Text style={[styles.statHeaderLeft, { color: theme.accentGold }]}>SJ</Text>
                      <Text style={[styles.statHeaderCenter, { color: theme.subText }]}>Metric</Text>
                      <Text style={[styles.statHeaderRight, { color: opp.text }]}>{opp.abbr}</Text>
                    </View>

                    <View style={[styles.statRow, { borderBottomColor: theme.borderColor }]}>
                      <Text style={[styles.statValLeft, { color: theme.text }]}>{stats.sog[0]}</Text>
                      <Text style={[styles.statLabel, { color: theme.subText }]}>Shots on Goal (SOG)</Text>
                      <Text style={[styles.statValRight, { color: theme.text }]}>{stats.sog[1]}</Text>
                    </View>

                    <View style={[styles.statRow, { borderBottomColor: theme.borderColor }]}>
                      <Text style={[styles.statValLeft, { color: theme.text }]}>{stats.pp[0]}</Text>
                      <Text style={[styles.statLabel, { color: theme.subText }]}>Power Play (PP)</Text>
                      <Text style={[styles.statValRight, { color: theme.text }]}>{stats.pp[1]}</Text>
                    </View>

                    <View style={[styles.statRow, { borderBottomColor: theme.borderColor }]}>
                      <Text style={[styles.statValLeft, { color: theme.text }]}>{stats.pim[0]} min</Text>
                      <Text style={[styles.statLabel, { color: theme.subText }]}>Penalty Mins (PIM)</Text>
                      <Text style={[styles.statValRight, { color: theme.text }]}>{stats.pim[1]} min</Text>
                    </View>

                    <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                      <Text style={[styles.statValLeft, { color: theme.text }]}>{stats.foPct[0]}</Text>
                      <Text style={[styles.statLabel, { color: theme.subText }]}>Faceoff Win %</Text>
                      <Text style={[styles.statValRight, { color: theme.text }]}>{stats.foPct[1]}</Text>
                    </View>
                  </View>

                  <Text style={[styles.subSectionTitle, { color: theme.accentGold }]}>SCORING SUMMARY & KEY PLAYS</Text>
                  <View style={[styles.playsList, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                    {stats.scoringPlays.map((play, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.playItem,
                          { borderBottomColor: theme.borderColor },
                          idx === stats.scoringPlays.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={styles.playBadgeCol}>
                          <View style={[styles.playTeamPill, play.team === 'SJ' ? styles.playTeamSJ : { backgroundColor: opp.bg }]}>
                            <Text style={[styles.playTeamText, play.team !== 'SJ' && { color: opp.text }]}>{play.team}</Text>
                          </View>
                          <Text style={[styles.playTimeText, { color: theme.subText }]}>
                            {play.period} • {play.time}
                          </Text>
                        </View>
                        <View style={styles.playDetailsCol}>
                          <Text style={[styles.playScorer, { color: theme.text }]}>
                            {play.scorer} {play.type && play.type !== 'EV' ? `(${play.type})` : ''}
                          </Text>
                          <Text style={[styles.playAssists, { color: theme.subText }]}>{play.assists}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {stats.threeStars && stats.threeStars.length > 0 && (
                    <>
                      <Text style={[styles.subSectionTitle, { color: theme.accentGold }]}>3 STARS OF THE GAME</Text>
                      <View style={[styles.starsList, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                        {stats.threeStars.map((star) => (
                          <View
                            key={star.rank}
                            style={[
                              styles.starItem,
                              { borderBottomColor: theme.borderColor },
                              star.rank === stats.threeStars!.length && { borderBottomWidth: 0 },
                            ]}
                          >
                            <View style={[styles.starRankBadge, { borderColor: theme.accentGold }]}>
                              <Text style={[styles.starRankText, { color: theme.accentGold }]}>{'★'.repeat(4 - star.rank)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.starName, { color: theme.text }]}>{star.name}</Text>
                            </View>
                            <View
                              style={[
                                styles.playTeamPill,
                                star.team === 'SJ' ? styles.playTeamSJ : { backgroundColor: opp.bg },
                              ]}
                            >
                              <Text style={[styles.playTeamText, star.team !== 'SJ' && { color: opp.text }]}>{star.team}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </>
              ) : (
                <View style={[styles.emptyStatsBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.emptyStatsText, { color: theme.subText }]}>
                    Full box score isn't available for this game yet. Check back soon.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[styles.modalReturnBtn, { backgroundColor: theme.bg, borderTopColor: theme.borderColor }]}
            onPress={onClose}
          >
            <Text style={[styles.modalReturnText, { color: theme.accentGold }]}>Close Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'flex-end', paddingBottom: 16 },
  modalContainer: { height: SCREEN_HEIGHT * 0.82, borderRadius: 20, borderWidth: 1, overflow: 'hidden', flexDirection: 'column' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalHeaderTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  closeIconBtn: { padding: 4 },
  closeIconText: { fontSize: 18, fontWeight: '900' },
  modalScrollView: { flex: 1 },
  modalScroll: { padding: 16, paddingBottom: 40 },
  modalScoreCard: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16, borderWidth: 1 },
  modalGameSub: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  modalBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  modalBadgeCol: { alignItems: 'center', gap: 6 },
  modalTeamBadge: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  modalTeamBadgeText: { fontWeight: '900', fontSize: 14 },
  modalLargeScore: { fontSize: 26, fontWeight: '900' },
  modalScoreSep: { fontSize: 24, fontWeight: '900' },
  modalResultPill: { marginTop: 12, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5 },
  winPill: { backgroundColor: 'transparent', borderColor: '#266B73' },
  lossPill: { backgroundColor: 'rgba(255, 82, 82, 0.18)', borderColor: '#FF5252' },
  modalResultPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  factContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 16, gap: 8 },
  factIcon: { fontSize: 14 },
  factText: { fontSize: 11, fontWeight: '500', flex: 1, lineHeight: 16 },
  loadingBox: { paddingVertical: 30, alignItems: 'center' },
  subSectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, marginTop: 10, marginBottom: 8 },
  tableCard: { borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1 },
  tableRowHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 6, alignItems: 'center' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 8, alignItems: 'center' },
  tableCellTeamHeader: { flex: 1.5, textAlign: 'left', fontSize: 11, fontWeight: '700' },
  tableCellTeamData: { flex: 1.5, textAlign: 'left', fontSize: 12 },
  tableCellHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  tableCellData: { flex: 1, textAlign: 'center', fontSize: 12 },
  boldCell: { fontWeight: '900' },
  statComparisonBox: { borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1 },
  statHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1 },
  statHeaderLeft: { fontWeight: '900', fontSize: 12, width: 80, textAlign: 'left' },
  statHeaderCenter: { fontSize: 10, fontWeight: '700', textAlign: 'center', flex: 1, letterSpacing: 0.5 },
  statHeaderRight: { fontWeight: '900', fontSize: 12, width: 80, textAlign: 'right' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  statValLeft: { fontWeight: '900', fontSize: 13, width: 80, textAlign: 'left' },
  statLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center', flex: 1 },
  statValRight: { fontWeight: '900', fontSize: 13, width: 80, textAlign: 'right' },
  playsList: { borderRadius: 10, padding: 10, gap: 8, borderWidth: 1 },
  playItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, gap: 10 },
  playBadgeCol: { alignItems: 'center', width: 65 },
  playTeamPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 2 },
  playTeamSJ: { backgroundColor: '#266B73' },
  playTeamText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  playTimeText: { fontSize: 9, fontWeight: '600' },
  playDetailsCol: { flex: 1 },
  playScorer: { fontSize: 12, fontWeight: '800' },
  playAssists: { fontSize: 10, fontWeight: '500' },
  starsList: { borderRadius: 10, padding: 10, gap: 4, borderWidth: 1 },
  starItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, gap: 10 },
  starRankBadge: { width: 44, alignItems: 'center' },
  starRankText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  starName: { fontSize: 13, fontWeight: '800' },
  emptyStatsBox: { padding: 20, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  emptyStatsText: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  modalReturnBtn: { paddingVertical: 14, alignItems: 'center', borderTopWidth: 1 },
  modalReturnText: { fontSize: 14, fontWeight: '900' },
});
