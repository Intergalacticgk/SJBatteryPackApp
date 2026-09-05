import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  SafeAreaView 
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

export interface GameStats {
  sog: [number, number]; // [SJ, Opponent]
  pp: [string, string];   // e.g. ["1/4 (25.0%)", "0/3 (0.0%)"]
  pim: [number, number];  // Penalty minutes
  foPct: [string, string];// Faceoff %
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
}

interface LastEncounterProps {
  opponentAbbr?: string;
  opponentName?: string;
  gameDate?: string;
  scoreSJ?: number;
  scoreOpp?: number;
  isWin?: boolean;
  gameFact?: string;
  stats?: GameStats;
}

interface TeamTheme {
  name: string;
  abbr: string;
  bg: string;
  text: string;
}

const OPPONENT_THEMES: Record<string, TeamTheme> = {
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

function getOpponentTheme(rawName: string, rawAbbr: string): TeamTheme {
  const lower = rawName.toLowerCase();
  for (const key of Object.keys(OPPONENT_THEMES)) {
    if (lower.includes(key)) return OPPONENT_THEMES[key];
  }
  const clean = rawName.replace(/(San Jose|San Diego|Colorado|Ontario|Bakersfield|Calgary|Abbotsford|Tucson|Coachella Valley|Henderson|Texas|Chicago)\s+/i, '').trim();
  return {
    name: clean || rawName,
    abbr: rawAbbr || clean.substring(0, 3).toUpperCase(),
    bg: '#002B49',
    text: '#CF4520',
  };
}

const DEFAULT_STATS: GameStats = {
  sog: [34, 28],
  pp: ['1/4 (25.0%)', '0/3 (0.0%)'],
  pim: [8, 10],
  foPct: ['54.2%', '45.8%'],
  periods: {
    p1: [1, 0],
    p2: [2, 1],
    p3: [1, 1],
  },
  scoringPlays: [
    { period: '1st', time: '14:22', team: 'SJ', scorer: 'C. Cassels (4)', assists: 'D. Guschin, S. Robins', type: 'EV' },
    { period: '2nd', time: '05:10', team: 'BAK', scorer: 'M. Hamblin (8)', assists: 'B. Kemp', type: 'EV' },
    { period: '2nd', time: '11:45', team: 'SJ', scorer: 'D. Guschin (12)', assists: 'E. Frisch, J. Bailey', type: 'PP' },
    { period: '2nd', time: '18:02', team: 'SJ', scorer: 'K. Kostin (6)', assists: 'F. Bystedt', type: 'EV' },
    { period: '3rd', time: '08:30', team: 'BAK', scorer: 'X. Bourgault (7)', assists: 'P. Broberg', type: 'EV' },
    { period: '3rd', time: '19:15', team: 'SJ', scorer: 'T. Bordeleau (9)', assists: 'Unassisted (EN)', type: 'EV' },
  ]
};

export default function LastEncounter({
  opponentAbbr = 'BAK',
  opponentName = 'Bakersfield Condors',
  gameDate = 'JAN 21, 2026',
  scoreSJ = 4,
  scoreOpp = 2,
  isWin = true,
  gameFact = 'Barracuda snapped a 3-game road skid with a dominant 3rd period forecheck in Kern County.',
  stats = DEFAULT_STATS
}: LastEncounterProps) {
  const { theme } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const opp = getOpponentTheme(opponentName, opponentAbbr);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>LAST ENCOUNTER</Text>
        <Text style={[styles.dateTag, { color: theme.subText }]}>{gameDate}</Text>
      </View>

      {/* Main Encounter Card */}
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={[styles.scoreBanner, { borderBottomColor: theme.borderColor }]}>
          
          {/* SJ Barracuda */}
          <View style={styles.teamCol}>
            <View style={[styles.teamBadge, styles.sjBadge]}>
              <Text style={styles.sjBadgeText}>SJ</Text>
            </View>
            <Text style={[styles.teamName, { color: theme.text }]}>Barracuda</Text>
            <Text style={[styles.scoreText, { color: theme.text }]}>{scoreSJ}</Text>
          </View>

          {/* Outcome Badge */}
          <View style={styles.outcomeCol}>
            <View 
              style={[
                styles.statusPill, 
                isWin ? styles.winPill : styles.lossPill
              ]}
            >
              <Text 
                style={[
                  styles.statusPillText, 
                  { color: isWin ? '#266B73' : '#FF5252' }
                ]}
              >
                {isWin ? 'FINAL (W)' : 'FINAL (L)'}
              </Text>
            </View>
            <Text style={[styles.vsDivider, { color: theme.subText }]}>—</Text>
          </View>

          {/* Opponent */}
          <View style={styles.teamCol}>
            <View style={[styles.teamBadge, { backgroundColor: opp.bg, borderColor: opp.text }]}>
              <Text style={[styles.teamBadgeText, { color: opp.text }]}>{opp.abbr}</Text>
            </View>
            <Text style={[styles.teamName, { color: opp.text }]} numberOfLines={1}>{opp.name}</Text>
            <Text style={[styles.scoreText, { color: theme.text }]}>{scoreOpp}</Text>
          </View>
        </View>

        {/* Fact snippet */}
        {gameFact ? (
          <View style={[styles.factContainer, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
            <Text style={styles.factIcon}>💡</Text>
            <Text style={[styles.factText, { color: theme.text }]}>{gameFact}</Text>
          </View>
        ) : null}

        {/* View Full Stats Button */}
        <TouchableOpacity 
          style={[styles.statsButton, { backgroundColor: theme.accentOrange }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.statsButtonText}>📊 View Stats & Key Plays</Text>
        </TouchableOpacity>
      </View>

      {/* 🏒 HOCKEY BOXSCORE MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.modalHeaderTitle, { color: theme.accentGold }]}>MATCH REPORT & STATS</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeIconBtn}>
                <Text style={[styles.closeIconText, { color: theme.accentGold }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              
              {/* Score Recap Banner */}
              <View style={[styles.modalScoreCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.modalGameSub, { color: theme.subText }]}>San Jose Barracuda vs {opp.name}</Text>
                <View style={styles.modalScoreNumbers}>
                  <Text style={[styles.modalLargeScore, { color: theme.text }]}>SJ {scoreSJ}</Text>
                  <Text style={[styles.modalScoreSep, { color: theme.accentGold }]}>-</Text>
                  <Text style={[styles.modalLargeScore, { color: theme.text }]}>{scoreOpp} {opp.abbr}</Text>
                </View>
              </View>

              {/* Period-by-Period Scoring */}
              <Text style={[styles.subSectionTitle, { color: theme.accentGold }]}>PERIOD BREAKDOWN</Text>
              <View style={[styles.tableCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                <View style={[styles.tableRowHeader, { borderBottomColor: theme.borderColor }]}>
                  <Text style={[styles.tableCellTeamHeader, { color: theme.subText }]}>Team</Text>
                  <Text style={[styles.tableCellHeader, { color: theme.subText }]}>1st</Text>
                  <Text style={[styles.tableCellHeader, { color: theme.subText }]}>2nd</Text>
                  <Text style={[styles.tableCellHeader, { color: theme.subText }]}>3rd</Text>
                  {stats.periods.ot && <Text style={[styles.tableCellHeader, { color: theme.subText }]}>OT</Text>}
                  <Text style={[styles.tableCellHeader, styles.boldCell, { color: theme.accentGold }]}>F</Text>
                </View>
                {/* SJ Row */}
                <View style={[styles.tableRow, { borderBottomColor: theme.borderColor }]}>
                  <Text style={[styles.tableCellTeamData, { color: theme.text, fontWeight: '800' }]}>SJ</Text>
                  <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p1[0]}</Text>
                  <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p2[0]}</Text>
                  <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p3[0]}</Text>
                  {stats.periods.ot && <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.ot[0]}</Text>}
                  <Text style={[styles.tableCellData, styles.boldCell, { color: theme.accentGold }]}>{scoreSJ}</Text>
                </View>
                {/* Opponent Row */}
                <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.tableCellTeamData, { color: opp.text, fontWeight: '800' }]}>{opp.abbr}</Text>
                  <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p1[1]}</Text>
                  <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p2[1]}</Text>
                  <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.p3[1]}</Text>
                  {stats.periods.ot && <Text style={[styles.tableCellData, { color: theme.text }]}>{stats.periods.ot[1]}</Text>}
                  <Text style={[styles.tableCellData, styles.boldCell, { color: theme.accentGold }]}>{scoreOpp}</Text>
                </View>
              </View>

              {/* Team Hockey Stats Comparison */}
              <Text style={[styles.subSectionTitle, { color: theme.accentGold }]}>TEAM COMPARISON</Text>
              <View style={[styles.statComparisonBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                
                {/* Team Abbreviation Header Row */}
                <View style={[styles.statHeaderRow, { borderBottomColor: theme.borderColor }]}>
                  <Text style={[styles.statHeaderLeft, { color: theme.accentGold }]}>SJ</Text>
                  <Text style={[styles.statHeaderCenter, { color: theme.subText }]}>Metric</Text>
                  <Text style={[styles.statHeaderRight, { color: opp.text }]}>{opp.abbr}</Text>
                </View>

                {/* Shots on Goal */}
                <View style={[styles.statRow, { borderBottomColor: theme.borderColor }]}>
                  <Text style={[styles.statValLeft, { color: theme.text }]}>{stats.sog[0]}</Text>
                  <Text style={[styles.statLabel, { color: theme.subText }]}>Shots on Goal (SOG)</Text>
                  <Text style={[styles.statValRight, { color: theme.text }]}>{stats.sog[1]}</Text>
                </View>

                {/* Power Play */}
                <View style={[styles.statRow, { borderBottomColor: theme.borderColor }]}>
                  <Text style={[styles.statValLeft, { color: theme.text }]}>{stats.pp[0]}</Text>
                  <Text style={[styles.statLabel, { color: theme.subText }]}>Power Play (PP)</Text>
                  <Text style={[styles.statValRight, { color: theme.text }]}>{stats.pp[1]}</Text>
                </View>

                {/* Penalty Minutes */}
                <View style={[styles.statRow, { borderBottomColor: theme.borderColor }]}>
                  <Text style={[styles.statValLeft, { color: theme.text }]}>{stats.pim[0]} min</Text>
                  <Text style={[styles.statLabel, { color: theme.subText }]}>Penalty Mins (PIM)</Text>
                  <Text style={[styles.statValRight, { color: theme.text }]}>{stats.pim[1]} min</Text>
                </View>

                {/* Faceoff Win % */}
                <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.statValLeft, { color: theme.text }]}>{stats.foPct[0]}</Text>
                  <Text style={[styles.statLabel, { color: theme.subText }]}>Faceoff Win %</Text>
                  <Text style={[styles.statValRight, { color: theme.text }]}>{stats.foPct[1]}</Text>
                </View>

              </View>

              {/* Key Plays / Scoring Summary */}
              <Text style={[styles.subSectionTitle, { color: theme.accentGold }]}>SCORING SUMMARY & KEY PLAYS</Text>
              <View style={[styles.playsList, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                {stats.scoringPlays.map((play, idx) => (
                  <View key={idx} style={[styles.playItem, { borderBottomColor: theme.borderColor }, idx === stats.scoringPlays.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.playBadgeCol}>
                      <View style={[styles.playTeamPill, play.team === 'SJ' ? styles.playTeamSJ : { backgroundColor: opp.bg }]}>
                        <Text style={[styles.playTeamText, play.team !== 'SJ' && { color: opp.text }]}>{play.team}</Text>
                      </View>
                      <Text style={[styles.playTimeText, { color: theme.subText }]}>{play.period} • {play.time}</Text>
                    </View>
                    <View style={styles.playDetailsCol}>
                      <Text style={[styles.playScorer, { color: theme.text }]}>{play.scorer} {play.type && play.type !== 'EV' ? `(${play.type})` : ''}</Text>
                      <Text style={[styles.playAssists, { color: theme.subText }]}>{play.assists}</Text>
                    </View>
                  </View>
                ))}
              </View>

            </ScrollView>

            {/* Modal Bottom Return Button */}
            <TouchableOpacity 
              style={[styles.modalReturnBtn, { backgroundColor: theme.bg, borderTopColor: theme.borderColor }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.modalReturnText, { color: theme.accentGold }]}>Close Report</Text>
            </TouchableOpacity>

          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dateTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    width: '100%',
  },
  scoreBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  teamCol: {
    alignItems: 'center',
    width: 90,
  },
  teamBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 4,
  },
  sjBadge: {
    backgroundColor: '#266B73',
    borderColor: '#000000',
  },
  sjBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  teamBadgeText: {
    fontWeight: '900',
    fontSize: 13,
  },
  teamName: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '900',
  },
  outcomeCol: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  winPill: {
    backgroundColor: 'transparent',
    borderColor: '#266B73',
  },
  lossPill: {
    backgroundColor: 'rgba(255, 82, 82, 0.18)',
    borderColor: '#FF5252',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  vsDivider: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  factContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  factIcon: {
    fontSize: 14,
  },
  factText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  statsButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  statsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeIconBtn: {
    padding: 4,
  },
  closeIconText: {
    fontSize: 18,
    fontWeight: '900',
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 30,
  },
  modalScoreCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  modalGameSub: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalScoreNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalLargeScore: {
    fontSize: 26,
    fontWeight: '900',
  },
  modalScoreSep: {
    fontSize: 24,
    fontWeight: '900',
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  tableCard: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  tableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 6,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tableCellTeamHeader: {
    flex: 1.5,
    textAlign: 'left',
    fontSize: 11,
    fontWeight: '700',
  },
  tableCellTeamData: {
    flex: 1.5,
    textAlign: 'left',
    fontSize: 12,
  },
  tableCellHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  tableCellData: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
  },
  boldCell: {
    fontWeight: '900',
  },
  statComparisonBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  statHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  statHeaderLeft: {
    fontWeight: '900',
    fontSize: 12,
    width: 80,
    textAlign: 'left',
  },
  statHeaderCenter: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
    letterSpacing: 0.5,
  },
  statHeaderRight: {
    fontWeight: '900',
    fontSize: 12,
    width: 80,
    textAlign: 'right',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statValLeft: {
    fontWeight: '900',
    fontSize: 13,
    width: 80,
    textAlign: 'left',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  statValRight: {
    fontWeight: '900',
    fontSize: 13,
    width: 80,
    textAlign: 'right',
  },
  playsList: {
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
  },
  playItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 10,
  },
  playBadgeCol: {
    alignItems: 'center',
    width: 65,
  },
  playTeamPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  playTeamSJ: {
    backgroundColor: '#266B73',
  },
  playTeamText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  playTimeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  playDetailsCol: {
    flex: 1,
  },
  playScorer: {
    fontSize: 12,
    fontWeight: '800',
  },
  playAssists: {
    fontSize: 10,
    fontWeight: '500',
  },
  modalReturnBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  modalReturnText: {
    fontSize: 14,
    fontWeight: '900',
  },
});