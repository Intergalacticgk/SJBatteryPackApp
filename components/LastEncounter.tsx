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

export interface GameStats {
  sog: [number, number]; // [SJ, Opponent]
  pp: [string, string];   // e.g. ["1/4 (25%)", "0/3 (0%)"]
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
    type?: string; // 'EV', 'PP', 'SH'
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
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>LAST ENCOUNTER</Text>
        <Text style={styles.dateTag}>{gameDate}</Text>
      </View>

      {/* Main Encounter Card */}
      <View style={styles.card}>
        <View style={styles.scoreBanner}>
          {/* SJ */}
          <View style={styles.teamCol}>
            <View style={styles.teamBadge}>
              <Text style={styles.teamBadgeText}>SJ</Text>
            </View>
            <Text style={styles.teamName}>Barracuda</Text>
            <Text style={styles.scoreText}>{scoreSJ}</Text>
          </View>

          {/* Outcome Badge */}
          <View style={styles.outcomeCol}>
            <View style={[styles.statusPill, isWin ? styles.winPill : styles.lossPill]}>
              <Text style={styles.statusPillText}>{isWin ? 'FINAL (W)' : 'FINAL (L)'}</Text>
            </View>
            <Text style={styles.vsDivider}>—</Text>
          </View>

          {/* Opponent */}
          <View style={styles.teamCol}>
            <View style={[styles.teamBadge, styles.oppBadge]}>
              <Text style={styles.teamBadgeText}>{opponentAbbr}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={1}>{opponentAbbr}</Text>
            <Text style={styles.scoreText}>{scoreOpp}</Text>
          </View>
        </View>

        {/* Fact snippet */}
        <View style={styles.factContainer}>
          <Text style={styles.factIcon}>💡</Text>
          <Text style={styles.factText}>{gameFact}</Text>
        </View>

        {/* View Full Stats Button */}
        <TouchableOpacity 
          style={styles.statsButton}
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
          <SafeAreaView style={styles.modalContainer}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>MATCH REPORT & STATS</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeIconBtn}>
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              
              {/* Score Recap Banner */}
              <View style={styles.modalScoreCard}>
                <Text style={styles.modalGameSub}>San Jose Barracuda vs {opponentName}</Text>
                <View style={styles.modalScoreNumbers}>
                  <Text style={styles.modalLargeScore}>SJ {scoreSJ}</Text>
                  <Text style={styles.modalScoreSep}>-</Text>
                  <Text style={styles.modalLargeScore}>{scoreOpp} {opponentAbbr}</Text>
                </View>
              </View>

              {/* Period-by-Period Scoring */}
              <Text style={styles.subSectionTitle}>PERIOD BREAKDOWN</Text>
              <View style={styles.tableCard}>
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.tableCell, styles.tableCellTeam]}>Team</Text>
                  <Text style={styles.tableCell}>1st</Text>
                  <Text style={styles.tableCell}>2nd</Text>
                  <Text style={styles.tableCell}>3rd</Text>
                  {stats.periods.ot && <Text style={styles.tableCell}>OT</Text>}
                  <Text style={[styles.tableCell, styles.boldCell]}>T</Text>
                </View>
                {/* SJ Row */}
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCellTeam, styles.tableCellText]}>SJ</Text>
                  <Text style={styles.tableCellText}>{stats.periods.p1[0]}</Text>
                  <Text style={styles.tableCellText}>{stats.periods.p2[0]}</Text>
                  <Text style={styles.tableCellText}>{stats.periods.p3[0]}</Text>
                  {stats.periods.ot && <Text style={styles.tableCellText}>{stats.periods.ot[0]}</Text>}
                  <Text style={[styles.tableCellText, styles.boldCell]}>{scoreSJ}</Text>
                </View>
                {/* Opponent Row */}
                <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.tableCellTeam, styles.tableCellText]}>{opponentAbbr}</Text>
                  <Text style={styles.tableCellText}>{stats.periods.p1[1]}</Text>
                  <Text style={styles.tableCellText}>{stats.periods.p2[1]}</Text>
                  <Text style={styles.tableCellText}>{stats.periods.p3[1]}</Text>
                  {stats.periods.ot && <Text style={styles.tableCellText}>{stats.periods.ot[1]}</Text>}
                  <Text style={[styles.tableCellText, styles.boldCell]}>{scoreOpp}</Text>
                </View>
              </View>

              {/* Team Hockey Stats Comparison */}
              <Text style={styles.subSectionTitle}>TEAM COMPARISON</Text>
              <View style={styles.statComparisonBox}>
                
                {/* Shots on Goal */}
                <View style={styles.statRow}>
                  <Text style={styles.statValLeft}>{stats.sog[0]}</Text>
                  <Text style={styles.statLabel}>Shots on Goal (SOG)</Text>
                  <Text style={styles.statValRight}>{stats.sog[1]}</Text>
                </View>

                {/* Power Play */}
                <View style={styles.statRow}>
                  <Text style={styles.statValLeft}>{stats.pp[0]}</Text>
                  <Text style={styles.statLabel}>Power Play (PP)</Text>
                  <Text style={styles.statValRight}>{stats.pp[1]}</Text>
                </View>

                {/* Penalty Minutes */}
                <View style={styles.statRow}>
                  <Text style={styles.statValLeft}>{stats.pim[0]} min</Text>
                  <Text style={styles.statLabel}>Penalty Mins (PIM)</Text>
                  <Text style={styles.statValRight}>{stats.pim[1]} min</Text>
                </View>

                {/* Faceoff Win % */}
                <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.statValLeft}>{stats.foPct[0]}</Text>
                  <Text style={styles.statLabel}>Faceoff Win %</Text>
                  <Text style={styles.statValRight}>{stats.foPct[1]}</Text>
                </View>

              </View>

              {/* Key Plays / Scoring Summary */}
              <Text style={styles.subSectionTitle}>SCORING SUMMARY & KEY PLAYS</Text>
              <View style={styles.playsList}>
                {stats.scoringPlays.map((play, idx) => (
                  <View key={idx} style={styles.playItem}>
                    <View style={styles.playBadgeCol}>
                      <View style={[styles.playTeamPill, play.team === 'SJ' ? styles.playTeamSJ : styles.playTeamOpp]}>
                        <Text style={styles.playTeamText}>{play.team}</Text>
                      </View>
                      <Text style={styles.playTimeText}>{play.period} • {play.time}</Text>
                    </View>
                    <View style={styles.playDetailsCol}>
                      <Text style={styles.playScorer}>{play.scorer} {play.type && play.type !== 'EV' ? `(${play.type})` : ''}</Text>
                      <Text style={styles.playAssists}>{play.assists}</Text>
                    </View>
                  </View>
                ))}
              </View>

            </ScrollView>

            {/* Modal Bottom Return Button */}
            <TouchableOpacity 
              style={styles.modalReturnBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalReturnText}>Close Report</Text>
            </TouchableOpacity>

          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFB800',
    letterSpacing: 1,
  },
  dateTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#80B3B8',
  },
  card: {
    backgroundColor: '#001E22',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.25)',
  },
  scoreBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  teamCol: {
    alignItems: 'center',
    width: 80,
  },
  teamBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00424A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFB800',
    marginBottom: 4,
  },
  oppBadge: {
    backgroundColor: '#002F35',
    borderColor: '#DD8943',
  },
  teamBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  teamName: {
    color: '#80B3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  outcomeCol: {
    alignItems: 'center',
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  winPill: {
    backgroundColor: 'rgba(38, 166, 91, 0.25)',
    borderWidth: 1,
    borderColor: '#2ecc71',
  },
  lossPill: {
    backgroundColor: 'rgba(231, 76, 60, 0.25)',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  vsDivider: {
    color: '#80B3B8',
    fontSize: 14,
    marginTop: 4,
  },
  factContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 47, 53, 0.6)',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  factIcon: {
    fontSize: 14,
  },
  factText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  statsButton: {
    backgroundColor: '#DD8943',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  statsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#001E22',
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderTitle: {
    color: '#FFB800',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeIconBtn: {
    padding: 4,
  },
  closeIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 30,
  },
  modalScoreCard: {
    backgroundColor: '#002F35',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.2)',
  },
  modalGameSub: {
    color: '#80B3B8',
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
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  modalScoreSep: {
    color: '#FFB800',
    fontSize: 24,
    fontWeight: '900',
  },
  subSectionTitle: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  tableCard: {
    backgroundColor: '#002F35',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  tableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 6,
  },
  tableCellTeam: {
    flex: 2,
    textAlign: 'left',
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#80B3B8',
    fontWeight: '700',
  },
  tableCellText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#FFFFFF',
  },
  boldCell: {
    fontWeight: '900',
    color: '#FFB800',
  },
  statComparisonBox: {
    backgroundColor: '#002F35',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  statValLeft: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    width: 80,
    textAlign: 'left',
  },
  statLabel: {
    color: '#80B3B8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  statValRight: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    width: 80,
    textAlign: 'right',
  },
  playsList: {
    backgroundColor: '#002F35',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  playItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: '#00424A',
  },
  playTeamOpp: {
    backgroundColor: '#DD8943',
  },
  playTeamText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  playTimeText: {
    color: '#80B3B8',
    fontSize: 9,
    fontWeight: '600',
  },
  playDetailsCol: {
    flex: 1,
  },
  playScorer: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  playAssists: {
    color: '#80B3B8',
    fontSize: 10,
    fontWeight: '500',
  },
  modalReturnBtn: {
    backgroundColor: '#001417',
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 184, 0, 0.2)',
  },
  modalReturnText: {
    color: '#FFB800',
    fontSize: 14,
    fontWeight: '900',
  },
});