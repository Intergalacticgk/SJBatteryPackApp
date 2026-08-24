import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { fetchLiveStandings, AHLStandingRow } from '../services/ahlApi';

const DEFAULT_PACIFIC: AHLStandingRow[] = [
  { rank: 1, abbr: 'CGY', name: 'Calgary Wranglers', division: 'PACIFIC', conference: 'WEST', gp: 44, w: 28, l: 12, otl: 2, sol: 2, pts: 60, ptsPct: '.682', diff: '+28', isCuda: false },
  { rank: 2, abbr: 'CV', name: 'Coachella Valley', division: 'PACIFIC', conference: 'WEST', gp: 42, w: 26, l: 12, otl: 2, sol: 2, pts: 56, ptsPct: '.667', diff: '+22', isCuda: false },
  { rank: 3, abbr: 'SJ', name: 'San Jose Barracuda', division: 'PACIFIC', conference: 'WEST', gp: 43, w: 24, l: 14, otl: 3, sol: 2, pts: 53, ptsPct: '.616', diff: '+16', isCuda: true },
  { rank: 4, abbr: 'COL', name: 'Colorado Eagles', division: 'PACIFIC', conference: 'WEST', gp: 43, w: 23, l: 15, otl: 3, sol: 2, pts: 51, ptsPct: '.593', diff: '+10', isCuda: false },
  { rank: 5, abbr: 'ONT', name: 'Ontario Reign', division: 'PACIFIC', conference: 'WEST', gp: 42, w: 22, l: 16, otl: 3, sol: 1, pts: 48, ptsPct: '.571', diff: '+4', isCuda: false },
  { rank: 6, abbr: 'BAK', name: 'Bakersfield Condors', division: 'PACIFIC', conference: 'WEST', gp: 41, w: 20, l: 16, otl: 3, sol: 2, pts: 45, ptsPct: '.549', diff: '-2', isCuda: false },
  { rank: 7, abbr: 'ABB', name: 'Abbotsford Canucks', division: 'PACIFIC', conference: 'WEST', gp: 42, w: 19, l: 19, otl: 2, sol: 2, pts: 42, ptsPct: '.500', diff: '-6', isCuda: false },
];

export default function Standings() {
  const [conference, setConference] = useState<'WEST' | 'EAST'>('WEST');
  const [division, setDivision] = useState<string>('PACIFIC');
  const [standingsData, setStandingsData] = useState<Record<string, AHLStandingRow[]>>({ PACIFIC: DEFAULT_PACIFIC });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStandings() {
      const data = await fetchLiveStandings();
      if (data && Object.keys(data).length > 0 && data.PACIFIC && data.PACIFIC.length > 0) {
        setStandingsData(data);
      }
      setLoading(false);
    }
    loadStandings();
  }, []);

  const handleConfChange = (conf: 'WEST' | 'EAST') => {
    setConference(conf);
    setDivision(conf === 'WEST' ? 'PACIFIC' : 'ATLANTIC');
  };

  const currentTeams = standingsData[division] || [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>AHL STANDINGS</Text>
        <Text style={styles.seasonTag}>LIVE AHL FEED</Text>
      </View>

      <View style={styles.card}>
        {/* Conference Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleBtn, conference === 'WEST' && styles.toggleBtnActive]}
            onPress={() => handleConfChange('WEST')}
          >
            <Text style={[styles.toggleBtnText, conference === 'WEST' && styles.toggleBtnTextActive]}>
              Western Conference
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleBtn, conference === 'EAST' && styles.toggleBtnActive]}
            onPress={() => handleConfChange('EAST')}
          >
            <Text style={[styles.toggleBtnText, conference === 'EAST' && styles.toggleBtnTextActive]}>
              Eastern Conference
            </Text>
          </TouchableOpacity>
        </View>

        {/* Division Filter Sub-pills */}
        <View style={styles.divisionRow}>
          {conference === 'WEST' ? (
            <>
              <TouchableOpacity 
                style={[styles.divPill, division === 'PACIFIC' && styles.divPillActive]}
                onPress={() => setDivision('PACIFIC')}
              >
                <Text style={[styles.divPillText, division === 'PACIFIC' && styles.divPillTextActive]}>Pacific</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.divPill, division === 'CENTRAL' && styles.divPillActive]}
                onPress={() => setDivision('CENTRAL')}
              >
                <Text style={[styles.divPillText, division === 'CENTRAL' && styles.divPillTextActive]}>Central</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.divPill, division === 'ATLANTIC' && styles.divPillActive]}
                onPress={() => setDivision('ATLANTIC')}
              >
                <Text style={[styles.divPillText, division === 'ATLANTIC' && styles.divPillTextActive]}>Atlantic</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.divPill, division === 'NORTH' && styles.divPillActive]}
                onPress={() => setDivision('NORTH')}
              >
                <Text style={[styles.divPillText, division === 'NORTH' && styles.divPillTextActive]}>North</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#FFB800" size="small" style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, styles.rankCol]}>#</Text>
                <Text style={[styles.thCell, styles.teamCol]}>Team</Text>
                <Text style={[styles.thCell, styles.statCol]}>GP</Text>
                <Text style={[styles.thCell, styles.recordCol]}>W-L-OTL</Text>
                <Text style={[styles.thCell, styles.statCol, styles.boldCol]}>PTS</Text>
                <Text style={[styles.thCell, styles.statCol]}>PTS%</Text>
                <Text style={[styles.thCell, styles.statCol]}>DIFF</Text>
              </View>

              {currentTeams.map((team, idx) => {
                const isPlayoffCutoff = division === 'PACIFIC' ? idx === 6 : idx === 4;
                return (
                  <React.Fragment key={team.abbr + idx}>
                    <View style={[styles.tableRow, team.isCuda && styles.cudaRow]}>
                      <Text style={[styles.tdCell, styles.rankCol, team.isCuda && styles.cudaText]}>{team.rank}</Text>
                      <View style={[styles.teamCellWrapper, styles.teamCol]}>
                        <View style={[styles.teamMiniBadge, team.isCuda && styles.cudaBadge]}>
                          <Text style={styles.teamMiniBadgeText}>{team.abbr}</Text>
                        </View>
                        <Text style={[styles.tdCell, team.isCuda && styles.cudaBoldText]} numberOfLines={1}>
                          {team.name}
                        </Text>
                      </View>
                      <Text style={[styles.tdCell, styles.statCol]}>{team.gp}</Text>
                      <Text style={[styles.tdCell, styles.recordCol]}>{`${team.w}-${team.l}-${team.otl}`}</Text>
                      <Text style={[styles.tdCell, styles.statCol, styles.ptsText]}>{team.pts}</Text>
                      <Text style={[styles.tdCell, styles.statCol]}>{team.ptsPct}</Text>
                      <Text style={[styles.tdCell, styles.statCol, team.diff.startsWith('+') ? styles.plusDiff : styles.minusDiff]}>
                        {team.diff}
                      </Text>
                    </View>

                    {isPlayoffCutoff && (
                      <View style={styles.playoffLine}>
                        <Text style={styles.playoffLineText}>— CALDER CUP PLAYOFF LINE —</Text>
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10, paddingHorizontal: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#FFB800', letterSpacing: 1 },
  seasonTag: { fontSize: 10, fontWeight: '700', color: '#80B3B8' },
  card: { backgroundColor: '#001E22', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255, 184, 0, 0.25)' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#001417', borderRadius: 10, padding: 3, marginBottom: 8 },
  toggleBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#00424A', borderWidth: 1, borderColor: '#FFB800' },
  toggleBtnText: { color: '#80B3B8', fontSize: 11, fontWeight: '700' },
  toggleBtnTextActive: { color: '#FFFFFF', fontWeight: '900' },
  divisionRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  divPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(0, 47, 53, 0.5)', borderWidth: 1, borderColor: 'rgba(255, 184, 0, 0.15)' },
  divPillActive: { backgroundColor: '#DD8943', borderColor: '#DD8943' },
  divPillText: { color: '#80B3B8', fontSize: 10, fontWeight: '700' },
  divPillTextActive: { color: '#FFFFFF', fontWeight: '900' },
  table: { minWidth: 420 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)', paddingBottom: 6, marginBottom: 4 },
  thCell: { color: '#80B3B8', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.04)' },
  cudaRow: { backgroundColor: 'rgba(0, 66, 74, 0.8)', borderRadius: 8, borderWidth: 1, borderColor: '#FFB800', marginVertical: 2, paddingVertical: 7 },
  teamCellWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamMiniBadge: { width: 28, height: 18, borderRadius: 4, backgroundColor: '#002F35', justifyContent: 'center', alignItems: 'center' },
  cudaBadge: { backgroundColor: '#FFB800' },
  teamMiniBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  tdCell: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  rankCol: { width: 24, textAlign: 'center' },
  teamCol: { width: 155 },
  statCol: { width: 44, textAlign: 'center' },
  recordCol: { width: 72, textAlign: 'center' },
  boldCol: { color: '#FFB800' },
  ptsText: { color: '#FFB800', fontWeight: '900' },
  plusDiff: { color: '#2ecc71', fontWeight: '700' },
  minusDiff: { color: '#e74c3c', fontWeight: '700' },
  cudaText: { color: '#FFB800', fontWeight: '900' },
  cudaBoldText: { color: '#FFFFFF', fontWeight: '900' },
  playoffLine: { borderTopWidth: 1, borderTopColor: '#DD8943', marginVertical: 4, paddingTop: 3, alignItems: 'center' },
  playoffLineText: { color: '#DD8943', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }
});