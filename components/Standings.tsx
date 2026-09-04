import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

interface StandingRow {
  rank: number;
  abbr: string;
  name: string;
  badgeBg: string;
  badgeText: string;
  gp: number;
  w: number;
  l: number;
  otl: number;
  sol: number;
  pts: number;
  pct: string;
  diff: string;
  isCuda: boolean;
}

const OFFICIAL_STANDINGS: Record<string, StandingRow[]> = {
  PACIFIC: [
    { rank: 1, abbr: 'ONT', name: 'Reign', badgeBg: '#111111', badgeText: '#A2AAAD', gp: 72, w: 47, l: 20, otl: 3, sol: 2, pts: 99, pct: '.688', diff: '+50', isCuda: false },
    { rank: 2, abbr: 'COL', name: 'Eagles', badgeBg: '#002B49', badgeText: '#C8102E', gp: 72, w: 41, l: 20, otl: 6, sol: 5, pts: 93, pct: '.646', diff: '+39', isCuda: false },
    { rank: 3, abbr: 'HSK', name: 'Silver Knights', badgeBg: '#4A4A4A', badgeText: '#C5B783', gp: 72, w: 39, l: 21, otl: 7, sol: 5, pts: 90, pct: '.625', diff: '+38', isCuda: false },
    { rank: 4, abbr: 'CV', name: 'Firebirds', badgeBg: '#B22222', badgeText: '#E87722', gp: 72, w: 41, l: 25, otl: 6, sol: 0, pts: 88, pct: '.611', diff: '+17', isCuda: false },
    { rank: 5, abbr: 'BAK', name: 'Condors', badgeBg: '#002B49', badgeText: '#CF4520', gp: 72, w: 37, l: 23, otl: 11, sol: 1, pts: 86, pct: '.597', diff: '+8', isCuda: false },
    { rank: 6, abbr: 'SJ', name: 'Barracuda', badgeBg: '#FF6B00', badgeText: '#FFFFFF', gp: 72, w: 40, l: 28, otl: 2, sol: 2, pts: 84, pct: '.583', diff: '+13', isCuda: true },
    { rank: 7, abbr: 'SD', name: 'Gulls', badgeBg: '#002B49', badgeText: '#F15A22', gp: 72, w: 33, l: 27, otl: 8, sol: 4, pts: 78, pct: '.542', diff: '-4', isCuda: false },
    { rank: 8, abbr: 'TUC', name: 'Roadrunners', badgeBg: '#8C2633', badgeText: '#C4CED3', gp: 72, w: 34, l: 28, otl: 10, sol: 0, pts: 78, pct: '.542', diff: '-9', isCuda: false },
    { rank: 9, abbr: 'ABB', name: 'Canucks', badgeBg: '#00205B', badgeText: '#00843D', gp: 72, w: 28, l: 37, otl: 4, sol: 3, pts: 63, pct: '.438', diff: '-61', isCuda: false },
    { rank: 10, abbr: 'CGY', name: 'Wranglers', badgeBg: '#C8102E', badgeText: '#F1BE48', gp: 72, w: 23, l: 34, otl: 10, sol: 5, pts: 61, pct: '.424', diff: '-66', isCuda: false },
  ],
  CENTRAL: [
    { rank: 1, abbr: 'GR', name: 'Griffins', badgeBg: '#B31B1B', badgeText: '#DAA520', gp: 72, w: 51, l: 16, otl: 4, sol: 1, pts: 107, pct: '.743', diff: '+96', isCuda: false },
    { rank: 2, abbr: 'CHI', name: 'Wolves', badgeBg: '#5B0612', badgeText: '#EAA11F', gp: 72, w: 36, l: 21, otl: 8, sol: 7, pts: 87, pct: '.604', diff: '+7', isCuda: false },
    { rank: 3, abbr: 'TEX', name: 'Stars', badgeBg: '#006A4E', badgeText: '#00B140', gp: 72, w: 37, l: 29, otl: 4, sol: 2, pts: 80, pct: '.556', diff: '-6', isCuda: false },
    { rank: 4, abbr: 'MB', name: 'Moose', badgeBg: '#00205B', badgeText: '#A2AAAD', gp: 72, w: 35, l: 29, otl: 5, sol: 3, pts: 78, pct: '.542', diff: '-31', isCuda: false },
    { rank: 5, abbr: 'MIL', name: 'Admirals', badgeBg: '#002B49', badgeText: '#87CEEB', gp: 72, w: 32, l: 33, otl: 4, sol: 3, pts: 71, pct: '.493', diff: '-15', isCuda: false },
    { rank: 6, abbr: 'IA', name: 'Wild', badgeBg: '#154734', badgeText: '#DDCBA4', gp: 72, w: 27, l: 36, otl: 6, sol: 3, pts: 63, pct: '.438', diff: '-47', isCuda: false },
    { rank: 7, abbr: 'RFD', name: 'IceHogs', badgeBg: '#CC0000', badgeText: '#000000', gp: 72, w: 28, l: 39, otl: 3, sol: 2, pts: 61, pct: '.424', diff: '-49', isCuda: false },
  ],
  ATLANTIC: [
    { rank: 1, abbr: 'PRO', name: 'Bruins', badgeBg: '#000000', badgeText: '#FFB81C', gp: 72, w: 54, l: 16, otl: 2, sol: 0, pts: 110, pct: '.764', diff: '+77', isCuda: false },
    { rank: 2, abbr: 'WBS', name: 'Penguins', badgeBg: '#000000', badgeText: '#CFC493', gp: 72, w: 46, l: 17, otl: 7, sol: 2, pts: 101, pct: '.701', diff: '+57', isCuda: false },
    { rank: 3, abbr: 'CLT', name: 'Checkers', badgeBg: '#CC0000', badgeText: '#002B49', gp: 72, w: 44, l: 23, otl: 5, sol: 0, pts: 93, pct: '.646', diff: '+51', isCuda: false },
    { rank: 4, abbr: 'BRI', name: 'Islanders', badgeBg: '#00539B', badgeText: '#F47920', gp: 72, w: 34, l: 30, otl: 3, sol: 5, pts: 76, pct: '.528', diff: '-3', isCuda: false },
    { rank: 5, abbr: 'HER', name: 'Bears', badgeBg: '#4A2A18', badgeText: '#D1AB66', gp: 72, w: 32, l: 31, otl: 6, sol: 3, pts: 73, pct: '.507', diff: '-20', isCuda: false },
    { rank: 6, abbr: 'SPR', name: 'Thunderbirds', badgeBg: '#002B49', badgeText: '#39A9DC', gp: 72, w: 32, l: 32, otl: 6, sol: 2, pts: 72, pct: '.500', diff: '-33', isCuda: false },
    { rank: 7, abbr: 'LV', name: 'Phantoms', badgeBg: '#F47920', badgeText: '#000000', gp: 72, w: 31, l: 35, otl: 3, sol: 3, pts: 68, pct: '.472', diff: '-37', isCuda: false },
    { rank: 8, abbr: 'HFD', name: 'Wolf Pack', badgeBg: '#00205B', badgeText: '#C8102E', gp: 72, w: 26, l: 38, otl: 5, sol: 3, pts: 60, pct: '.417', diff: '-63', isCuda: false },
  ],
  NORTH: [
    { rank: 1, abbr: 'LAV', name: 'Rocket', badgeBg: '#00205B', badgeText: '#C8102E', gp: 72, w: 41, l: 23, otl: 3, sol: 5, pts: 90, pct: '.625', diff: '+33', isCuda: false },
    { rank: 2, abbr: 'SYR', name: 'Crunch', badgeBg: '#00205B', badgeText: '#A2AAAD', gp: 72, w: 41, l: 24, otl: 3, sol: 4, pts: 89, pct: '.618', diff: '+48', isCuda: false },
    { rank: 3, abbr: 'CLE', name: 'Monsters', badgeBg: '#000000', badgeText: '#872434', gp: 72, w: 37, l: 26, otl: 6, sol: 3, pts: 83, pct: '.576', diff: '-10', isCuda: false },
    { rank: 4, abbr: 'TOR', name: 'Marlies', badgeBg: '#00205B', badgeText: '#FFFFFF', gp: 72, w: 36, l: 26, otl: 5, sol: 5, pts: 82, pct: '.569', diff: '+1', isCuda: false },
    { rank: 5, abbr: 'ROC', name: 'Americans', badgeBg: '#C8102E', badgeText: '#00205B', gp: 72, w: 31, l: 31, otl: 6, sol: 4, pts: 72, pct: '.500', diff: '-21', isCuda: false },
    { rank: 6, abbr: 'UTC', name: 'Comets', badgeBg: '#00205B', badgeText: '#00843D', gp: 72, w: 30, l: 31, otl: 6, sol: 5, pts: 71, pct: '.493', diff: '-21', isCuda: false },
    { rank: 7, abbr: 'BEL', name: 'Senators', badgeBg: '#000000', badgeText: '#C8102E', gp: 72, w: 28, l: 35, otl: 8, sol: 1, pts: 65, pct: '.451', diff: '-39', isCuda: false },
  ],
};

export default function Standings() {
  const { theme } = useAppTheme();
  const [conference, setConference] = useState<'WEST' | 'EAST'>('WEST');
  const [division, setDivision] = useState<string>('PACIFIC');

  const handleConfChange = (conf: 'WEST' | 'EAST') => {
    setConference(conf);
    setDivision(conf === 'WEST' ? 'PACIFIC' : 'ATLANTIC');
  };

  const currentTeams = OFFICIAL_STANDINGS[division] || OFFICIAL_STANDINGS.PACIFIC;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>AHL STANDINGS</Text>
        <Text style={[styles.seasonTag, { color: theme.subText }]}>2025–26 FINAL</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        {/* Conference Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: theme.subCardBg }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, conference === 'WEST' && { backgroundColor: theme.accentGold }]}
            onPress={() => handleConfChange('WEST')}
          >
            <Text style={[styles.toggleBtnText, { color: conference === 'WEST' ? '#001417' : theme.subText }, conference === 'WEST' && { fontWeight: '900' }]}>
              Western Conference
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, conference === 'EAST' && { backgroundColor: theme.accentGold }]}
            onPress={() => handleConfChange('EAST')}
          >
            <Text style={[styles.toggleBtnText, { color: conference === 'EAST' ? '#001417' : theme.subText }, conference === 'EAST' && { fontWeight: '900' }]}>
              Eastern Conference
            </Text>
          </TouchableOpacity>
        </View>

        {/* Division Sub-Pills */}
        <View style={styles.divisionRow}>
          {conference === 'WEST' ? (
            <>
              <TouchableOpacity
                style={[styles.divPill, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }, division === 'PACIFIC' && { backgroundColor: theme.accentOrange, borderColor: theme.accentOrange }]}
                onPress={() => setDivision('PACIFIC')}
              >
                <Text style={[styles.divPillText, { color: division === 'PACIFIC' ? '#FFFFFF' : theme.subText }]}>Pacific</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.divPill, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }, division === 'CENTRAL' && { backgroundColor: theme.accentOrange, borderColor: theme.accentOrange }]}
                onPress={() => setDivision('CENTRAL')}
              >
                <Text style={[styles.divPillText, { color: division === 'CENTRAL' ? '#FFFFFF' : theme.subText }]}>Central</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.divPill, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }, division === 'ATLANTIC' && { backgroundColor: theme.accentOrange, borderColor: theme.accentOrange }]}
                onPress={() => setDivision('ATLANTIC')}
              >
                <Text style={[styles.divPillText, { color: division === 'ATLANTIC' ? '#FFFFFF' : theme.subText }]}>Atlantic</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.divPill, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }, division === 'NORTH' && { backgroundColor: theme.accentOrange, borderColor: theme.accentOrange }]}
                onPress={() => setDivision('NORTH')}
              >
                <Text style={[styles.divPillText, { color: division === 'NORTH' ? '#FFFFFF' : theme.subText }]}>North</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Horizontal ScrollView with flexGrow to expand on wide tablet displays while remaining scrollable on small devices */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          <View style={styles.table}>
            <View style={[styles.tableHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.thCell, styles.rankCol, { color: theme.subText }]}>#</Text>
              <Text style={[styles.thCell, styles.teamCol, { color: theme.subText }]}>Team</Text>
              <Text style={[styles.thCell, styles.statCol, { color: theme.subText }]}>GP</Text>
              <Text style={[styles.thCell, styles.recordCol, { color: theme.subText }]}>W-L-OTL-SOL</Text>
              <Text style={[styles.thCell, styles.statCol, { color: theme.accentGold }]}>PTS</Text>
              <Text style={[styles.thCell, styles.statCol, { color: theme.subText }]}>PCT</Text>
              <Text style={[styles.thCell, styles.statCol, { color: theme.subText }]}>DIFF</Text>
            </View>

            {currentTeams.map((team, idx) => {
              const isPlayoffCutoff = division === 'PACIFIC' ? idx === 6 : idx === 4;
              const isPositive = team.diff.startsWith('+');

              return (
                <React.Fragment key={team.abbr + idx}>
                  <View 
                    style={[
                      styles.tableRow, 
                      { borderBottomColor: theme.borderColor }, 
                      team.isCuda && { backgroundColor: theme.isDark ? 'rgba(0, 66, 74, 0.75)' : 'rgba(255, 184, 0, 0.2)', borderRadius: 8 }
                    ]}
                  >
                    <Text style={[styles.tdCell, styles.rankCol, { color: team.isCuda ? theme.accentGold : theme.text, fontWeight: '800' }]}>{team.rank}</Text>
                    <View style={[styles.teamCellWrapper, styles.teamCol]}>
                      <View style={[styles.teamMiniBadge, { backgroundColor: team.badgeBg }]}>
                        <Text style={[styles.teamMiniBadgeText, { color: team.badgeText }]}>{team.abbr}</Text>
                      </View>
                      <Text style={[styles.tdCell, { color: team.isCuda ? theme.accentGold : theme.text }, team.isCuda && { fontWeight: '900' }]} numberOfLines={1}>
                        {team.name}
                      </Text>
                    </View>
                    <Text style={[styles.tdCell, styles.statCol, { color: theme.text }]}>{team.gp}</Text>
                    <Text style={[styles.tdCell, styles.recordCol, { color: theme.text }]}>{`${team.w}-${team.l}-${team.otl}-${team.sol}`}</Text>
                    <Text style={[styles.tdCell, styles.statCol, { color: theme.accentGold, fontWeight: '900' }]}>{team.pts}</Text>
                    <Text style={[styles.tdCell, styles.statCol, { color: theme.subText }]}>{team.pct}</Text>
                    <Text style={[styles.tdCell, styles.statCol, { color: isPositive ? '#2ecc71' : '#e74c3c', fontWeight: '700' }]}>{team.diff}</Text>
                  </View>

                  {isPlayoffCutoff && (
                    <View style={[styles.playoffLine, { borderTopColor: theme.accentOrange }]}>
                      <Text style={[styles.playoffLineText, { color: theme.accentOrange }]}>— CALDER CUP PLAYOFF LINE —</Text>
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  seasonTag: { fontSize: 10, fontWeight: '700' },
  card: { borderRadius: 14, padding: 12, borderWidth: 1 },
  toggleContainer: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 8 },
  toggleBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  toggleBtnText: { fontSize: 11, fontWeight: '700' },
  divisionRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  divPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  divPillText: { fontSize: 10, fontWeight: '800' },

  // Allows table to fill 100% of the screen width on iPad while retaining horizontal scrolling on smaller screens
  scrollContainer: { flexGrow: 1 },
  table: { width: '100%', minWidth: 460 },

  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 6, marginBottom: 4, alignItems: 'center' },
  thCell: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1 },
  teamCellWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamMiniBadge: { width: 34, height: 20, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  teamMiniBadgeText: { fontSize: 9, fontWeight: '900' },
  tdCell: { fontSize: 11, fontWeight: '600' },

  // Responsive proportional columns
  rankCol: { width: 30, textAlign: 'center' },
  teamCol: { flex: 2.2, minWidth: 130, paddingLeft: 4 },
  statCol: { flex: 0.9, minWidth: 44, textAlign: 'center' },
  recordCol: { flex: 1.6, minWidth: 90, textAlign: 'center' },

  playoffLine: { borderTopWidth: 1, marginVertical: 4, paddingTop: 3, alignItems: 'center' },
  playoffLineText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
});