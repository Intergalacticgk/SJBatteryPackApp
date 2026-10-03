import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { supabase } from '../supabase';

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
  conference?: 'WEST' | 'EAST';
  division?: 'PACIFIC' | 'CENTRAL' | 'ATLANTIC' | 'NORTH';
}

type ViewScope = 'DIVISION' | 'CONFERENCE' | 'LEAGUE';
type DivisionType = 'PACIFIC' | 'CENTRAL' | 'ATLANTIC' | 'NORTH';
type ConferenceType = 'WEST' | 'EAST';

const DIVISIONS: { id: DivisionType; label: string }[] = [
  { id: 'PACIFIC', label: 'Pacific' },
  { id: 'CENTRAL', label: 'Central' },
  { id: 'ATLANTIC', label: 'Atlantic' },
  { id: 'NORTH', label: 'North' },
];

const CONFERENCES: { id: ConferenceType; label: string }[] = [
  { id: 'WEST', label: 'Western Conf' },
  { id: 'EAST', label: 'Eastern Conf' },
];

const BASE_FALLBACK_DIVISIONS: Record<DivisionType, StandingRow[]> = {
  PACIFIC: [
    { rank: 1, abbr: 'ONT', name: 'Reign', badgeBg: '#000000', badgeText: '#FFFFFF', gp: 72, w: 47, l: 20, otl: 3, sol: 2, pts: 99, pct: '.688', diff: '+50', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 2, abbr: 'COL', name: 'Eagles', badgeBg: '#19398A', badgeText: '#FFD457', gp: 72, w: 41, l: 20, otl: 6, sol: 5, pts: 93, pct: '.646', diff: '+39', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 3, abbr: 'HSK', name: 'Silver Knights', badgeBg: '#000000', badgeText: '#B4975B', gp: 72, w: 39, l: 21, otl: 7, sol: 5, pts: 90, pct: '.625', diff: '+38', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 4, abbr: 'CV', name: 'Firebirds', badgeBg: '#001425', badgeText: '#FF681D', gp: 72, w: 41, l: 25, otl: 6, sol: 0, pts: 88, pct: '.611', diff: '+17', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 5, abbr: 'BAK', name: 'Condors', badgeBg: '#152342', badgeText: '#DF4E10', gp: 72, w: 37, l: 23, otl: 11, sol: 1, pts: 86, pct: '.597', diff: '+8', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 6, abbr: 'SJ', name: 'Barracuda', badgeBg: '#266B73', badgeText: '#FFFFFF', gp: 72, w: 40, l: 28, otl: 2, sol: 2, pts: 84, pct: '.583', diff: '+13', isCuda: true, conference: 'WEST', division: 'PACIFIC' },
    { rank: 7, abbr: 'SD', name: 'Gulls', badgeBg: '#FF4C00', badgeText: '#000000', gp: 72, w: 33, l: 27, otl: 8, sol: 4, pts: 78, pct: '.542', diff: '-4', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 8, abbr: 'TUC', name: 'Roadrunners', badgeBg: '#8E0A26', badgeText: '#FFFFFF', gp: 72, w: 34, l: 28, otl: 10, sol: 0, pts: 78, pct: '.542', diff: '-9', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 9, abbr: 'ABB', name: 'Canucks', badgeBg: '#0E1C2C', badgeText: '#FFFFFF', gp: 72, w: 28, l: 37, otl: 4, sol: 3, pts: 63, pct: '.438', diff: '-61', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 10, abbr: 'CGY', name: 'Wranglers', badgeBg: '#C2273D', badgeText: '#FFFFFF', gp: 72, w: 23, l: 34, otl: 10, sol: 5, pts: 61, pct: '.424', diff: '-66', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
  ],
  CENTRAL: [
    { rank: 1, abbr: 'GR', name: 'Griffins', badgeBg: '#E51636', badgeText: '#FFFFFF', gp: 72, w: 51, l: 16, otl: 4, sol: 1, pts: 107, pct: '.743', diff: '+96', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 2, abbr: 'CHI', name: 'Wolves', badgeBg: '#E03A3E', badgeText: '#FFFFFF', gp: 72, w: 36, l: 21, otl: 8, sol: 7, pts: 87, pct: '.604', diff: '+7', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 3, abbr: 'TEX', name: 'Stars', badgeBg: '#1B6031', badgeText: '#FFFFFF', gp: 72, w: 37, l: 29, otl: 4, sol: 2, pts: 80, pct: '.556', diff: '-6', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 4, abbr: 'MB', name: 'Moose', badgeBg: '#041E41', badgeText: '#FFFFFF', gp: 72, w: 35, l: 29, otl: 5, sol: 3, pts: 78, pct: '.542', diff: '-31', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 5, abbr: 'MIL', name: 'Admirals', badgeBg: '#0E2B58', badgeText: '#FFFFFF', gp: 72, w: 32, l: 33, otl: 4, sol: 3, pts: 71, pct: '.493', diff: '-15', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 6, abbr: 'IA', name: 'Wild', badgeBg: '#144733', badgeText: '#DFCAA3', gp: 72, w: 27, l: 36, otl: 6, sol: 3, pts: 63, pct: '.438', diff: '-47', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 7, abbr: 'RFD', name: 'IceHogs', badgeBg: '#DB1931', badgeText: '#FFFFFF', gp: 72, w: 28, l: 39, otl: 3, sol: 2, pts: 61, pct: '.424', diff: '-49', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
  ],
  ATLANTIC: [
    { rank: 1, abbr: 'PRO', name: 'Bruins', badgeBg: '#000000', badgeText: '#FBB337', gp: 72, w: 54, l: 16, otl: 2, sol: 0, pts: 110, pct: '.764', diff: '+77', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 2, abbr: 'WBS', name: 'Penguins', badgeBg: '#000000', badgeText: '#FEC23D', gp: 72, w: 46, l: 17, otl: 7, sol: 2, pts: 101, pct: '.701', diff: '+57', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 3, abbr: 'CLT', name: 'Checkers', badgeBg: '#E51A38', badgeText: '#FFFFFF', gp: 72, w: 44, l: 23, otl: 5, sol: 0, pts: 93, pct: '.646', diff: '+51', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 4, abbr: 'HER', name: 'Bears', badgeBg: '#472A2B', badgeText: '#FFFFFF', gp: 72, w: 32, l: 31, otl: 6, sol: 3, pts: 73, pct: '.507', diff: '-20', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 5, abbr: 'SPR', name: 'Thunderbirds', badgeBg: '#041E41', badgeText: '#FFFFFF', gp: 72, w: 32, l: 32, otl: 6, sol: 2, pts: 72, pct: '.500', diff: '-33', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 6, abbr: 'LV', name: 'Phantoms', badgeBg: '#000000', badgeText: '#F58220', gp: 72, w: 31, l: 35, otl: 3, sol: 3, pts: 68, pct: '.472', diff: '-37', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 7, abbr: 'HFD', name: 'Wolf Pack', badgeBg: '#00548E', badgeText: '#FFFFFF', gp: 72, w: 26, l: 38, otl: 5, sol: 3, pts: 60, pct: '.417', diff: '-63', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
  ],
  NORTH: [
    { rank: 1, abbr: 'LAV', name: 'Rocket', badgeBg: '#001E61', badgeText: '#FFFFFF', gp: 72, w: 41, l: 23, otl: 3, sol: 5, pts: 90, pct: '.625', diff: '+33', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 2, abbr: 'SYR', name: 'Crunch', badgeBg: '#1D427C', badgeText: '#FFFFFF', gp: 72, w: 41, l: 24, otl: 3, sol: 4, pts: 89, pct: '.618', diff: '+48', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 3, abbr: 'CLE', name: 'Monsters', badgeBg: '#005695', badgeText: '#FFFFFF', gp: 72, w: 37, l: 26, otl: 6, sol: 3, pts: 83, pct: '.576', diff: '-10', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 4, abbr: 'TOR', name: 'Marlies', badgeBg: '#003E7E', badgeText: '#FFFFFF', gp: 72, w: 36, l: 26, otl: 5, sol: 5, pts: 82, pct: '.569', diff: '+1', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 5, abbr: 'ROC', name: 'Americans', badgeBg: '#393A87', badgeText: '#FFFFFF', gp: 72, w: 31, l: 31, otl: 6, sol: 4, pts: 72, pct: '.500', diff: '-21', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 6, abbr: 'UTC', name: 'Comets', badgeBg: '#CF2031', badgeText: '#FFFFFF', gp: 72, w: 30, l: 31, otl: 6, sol: 5, pts: 71, pct: '.493', diff: '-21', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 7, abbr: 'BEL', name: 'Senators', badgeBg: '#E3173E', badgeText: '#FFFFFF', gp: 72, w: 28, l: 35, otl: 8, sol: 1, pts: 65, pct: '.451', diff: '-39', isCuda: false, conference: 'EAST', division: 'NORTH' },
    // Hamilton Hammers: new for 2026-27, relocated from Bridgeport (NY Islanders affiliate), replacing
    // Bridgeport Islanders in the Atlantic division and joining the North instead (per HockeyTech feed).
    { rank: 8, abbr: 'HAM', name: 'Hammers', badgeBg: '#00539B', badgeText: '#FFFFFF', gp: 0, w: 0, l: 0, otl: 0, sol: 0, pts: 0, pct: '.000', diff: '+0', isCuda: false, conference: 'EAST', division: 'NORTH' },
  ],
};

// Lookup of display name + badge colors by team abbreviation (team_id), built from the
// fallback data above so every division's teams resolve consistently without a separate map.
const ABBR_META: Record<string, { name: string; bg: string; text: string }> = {};
(Object.values(BASE_FALLBACK_DIVISIONS) as StandingRow[][]).forEach((rows) => {
  rows.forEach((r) => {
    ABBR_META[r.abbr] = { name: r.name, bg: r.badgeBg, text: r.badgeText };
  });
});

const DIVISION_CONFERENCE: Record<DivisionType, ConferenceType> = {
  PACIFIC: 'WEST',
  CENTRAL: 'WEST',
  ATLANTIC: 'EAST',
  NORTH: 'EAST',
};

export default function Standings() {
  const { theme } = useAppTheme();
  
  // Default selection remains Pacific Division
  const [scope, setScope] = useState<ViewScope>('DIVISION');
  const [selectedDivision, setSelectedDivision] = useState<DivisionType>('PACIFIC');
  const [selectedConference, setSelectedConference] = useState<ConferenceType>('WEST');

  // Live standings grouped by division, pulled from Supabase. Seeded with the static
  // fallback so the UI never flashes empty while the first fetch is in flight.
  const [liveByDivision, setLiveByDivision] = useState<Record<DivisionType, StandingRow[]>>(
    BASE_FALLBACK_DIVISIONS
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLiveStandings();
  }, []);

  const fetchLiveStandings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('standings')
        .select('*')
        .order('rank', { ascending: true });

      if (error) throw error;

      if (Array.isArray(data) && data.length > 0) {
        const grouped: Record<DivisionType, StandingRow[]> = {
          PACIFIC: [],
          CENTRAL: [],
          ATLANTIC: [],
          NORTH: [],
        };

        data.forEach((t: any) => {
          const divisionKey = String(t.division || '').toUpperCase() as DivisionType;
          if (!grouped[divisionKey]) return; // skip any unrecognized division label

          const abbr = String(t.team_id || t.team_code || '').toUpperCase();
          const meta = ABBR_META[abbr];
          const lowerName = String(t.team_name || '').toLowerCase();
          const isCuda = abbr === 'SJ' || lowerName.includes('barracuda');
          const diffVal = Number(t.goals_for || 0) - Number(t.goals_against || 0);

          grouped[divisionKey].push({
            rank: Number(t.rank || grouped[divisionKey].length + 1),
            abbr: meta ? abbr : abbr || (t.team_name || '???').substring(0, 3).toUpperCase(),
            name:
              meta?.name ||
              String(t.team_name || '')
                .replace('San Jose ', '')
                .replace('Coachella Valley ', ''),
            badgeBg: meta?.bg || '#333333',
            badgeText: meta?.text || '#FFFFFF',
            gp: Number(t.games_played || 0),
            w: Number(t.wins || 0),
            l: Number(t.losses || 0),
            otl: Number(t.ot_losses || 0),
            sol: Number(t.sol_losses || 0),
            pts: Number(t.points || 0),
            pct: String(t.win_percentage || '.000'),
            diff: diffVal >= 0 ? `+${diffVal}` : `${diffVal}`,
            isCuda,
            conference: DIVISION_CONFERENCE[divisionKey],
            division: divisionKey,
          });
        });

        // Fall back to static data per-division only if that division came back empty
        // (e.g. a partial sync failure), otherwise keep it sorted by rank.
        (Object.keys(grouped) as DivisionType[]).forEach((key) => {
          if (grouped[key].length === 0) {
            grouped[key] = BASE_FALLBACK_DIVISIONS[key];
          } else {
            grouped[key].sort((a, b) => a.rank - b.rank);
          }
        });

        setLiveByDivision(grouped);
      } else {
        setLiveByDivision(BASE_FALLBACK_DIVISIONS);
      }
    } catch {
      setLiveByDivision(BASE_FALLBACK_DIVISIONS);
    } finally {
      setLoading(false);
    }
  };

  // Compile all league teams from the live, per-division data
  const allTeams: StandingRow[] = useMemo(() => {
    return [
      ...liveByDivision.PACIFIC,
      ...liveByDivision.CENTRAL,
      ...liveByDivision.ATLANTIC,
      ...liveByDivision.NORTH,
    ];
  }, [liveByDivision]);

  // Compute displayed list based on chosen view mode
  const currentTeams: StandingRow[] = useMemo(() => {
    if (scope === 'DIVISION') {
      return liveByDivision[selectedDivision];
    }

    if (scope === 'CONFERENCE') {
      const confTeams = allTeams.filter((t) => t.conference === selectedConference);
      return confTeams
        .slice()
        .sort((a, b) => b.pts - a.pts || parseFloat(b.pct) - parseFloat(a.pct))
        .map((t, i) => ({ ...t, rank: i + 1 }));
    }

    // LEAGUE-WIDE SCOPE
    return allTeams
      .slice()
      .sort((a, b) => b.pts - a.pts || parseFloat(b.pct) - parseFloat(a.pct))
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }, [scope, selectedDivision, selectedConference, liveByDivision, allTeams]);

  // Dynamic header title and season label
  const getHeaderTitle = () => {
    if (scope === 'DIVISION') return `AHL ${selectedDivision} STANDINGS`;
    if (scope === 'CONFERENCE') return `AHL ${selectedConference === 'WEST' ? 'WESTERN' : 'EASTERN'} CONFERENCE`;
    return 'AHL LEAGUE STANDINGS';
  };

  const currentSeasonLabel = '2026–2027';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
          {getHeaderTitle()}
        </Text>
        <Text style={[styles.seasonTag, { color: theme.subText }]}>
          {currentSeasonLabel}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        {/* Tier 1: Primary View Scope Pills (Division / Conference / League) */}
        <View style={[styles.scopeBar, { backgroundColor: theme.subCardBg }]}>
          {(['DIVISION', 'CONFERENCE', 'LEAGUE'] as ViewScope[]).map((sc) => {
            const isSelected = scope === sc;
            return (
              <TouchableOpacity
                key={sc}
                style={[
                  styles.scopeBtn,
                  isSelected && { backgroundColor: theme.accentGold },
                ]}
                onPress={() => setScope(sc)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.scopeBtnText,
                    { color: isSelected ? '#001417' : theme.subText },
                    isSelected && { fontWeight: '900' },
                  ]}
                >
                  {sc === 'DIVISION' ? 'Divisions' : sc === 'CONFERENCE' ? 'Conferences' : 'League'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tier 2: Sub-Filter Options */}
        {scope === 'DIVISION' && (
          <View style={[styles.subFilterRow, { borderBottomColor: theme.borderColor }]}>
            {DIVISIONS.map((div) => {
              const isSelected = selectedDivision === div.id;
              return (
                <TouchableOpacity
                  key={div.id}
                  style={[
                    styles.subPill,
                    { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                    isSelected && { backgroundColor: theme.accentOrange, borderColor: theme.accentOrange },
                  ]}
                  onPress={() => setSelectedDivision(div.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.subPillText,
                      { color: isSelected ? '#FFFFFF' : theme.subText },
                      isSelected && { fontWeight: '900' },
                    ]}
                  >
                    {div.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {scope === 'CONFERENCE' && (
          <View style={[styles.subFilterRow, { borderBottomColor: theme.borderColor }]}>
            {CONFERENCES.map((conf) => {
              const isSelected = selectedConference === conf.id;
              return (
                <TouchableOpacity
                  key={conf.id}
                  style={[
                    styles.subPill,
                    { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                    isSelected && { backgroundColor: theme.accentOrange, borderColor: theme.accentOrange },
                  ]}
                  onPress={() => setSelectedConference(conf.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.subPillText,
                      { color: isSelected ? '#FFFFFF' : theme.subText },
                      isSelected && { fontWeight: '900' },
                    ]}
                  >
                    {conf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {loading && currentTeams.length === 0 ? (
          <ActivityIndicator size="small" color={theme.accentGold} style={{ padding: 20 }} />
        ) : (
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
                // Playoff line: Division (Pacific=7, others=5), Conference=8, League=16
                const isPlayoffCutoff =
                  scope === 'DIVISION'
                    ? (selectedDivision === 'PACIFIC' ? idx === 6 : idx === 4)
                    : scope === 'CONFERENCE'
                    ? idx === 7
                    : idx === 15;

                const isPositive = team.diff.startsWith('+');

                return (
                  <React.Fragment key={`${team.abbr}-${idx}`}>
                    <View
                      style={[
                        styles.tableRow,
                        { borderBottomColor: theme.borderColor },
                        team.isCuda && {
                          backgroundColor: theme.isDark ? 'rgba(0, 66, 74, 0.75)' : 'rgba(255, 184, 0, 0.2)',
                          borderRadius: 8,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tdCell,
                          styles.rankCol,
                          { color: team.isCuda ? theme.accentGold : theme.text, fontWeight: '800' },
                        ]}
                      >
                        {team.rank}
                      </Text>
                      <View style={[styles.teamCellWrapper, styles.teamCol]}>
                        <View
                          style={[
                            styles.teamMiniBadge,
                            { backgroundColor: team.badgeBg },
                            team.isCuda && styles.cudaBadgeBorder,
                          ]}
                        >
                          <Text style={[styles.teamMiniBadgeText, { color: team.badgeText }]}>{team.abbr}</Text>
                        </View>
                        <Text
                          style={[
                            styles.tdCell,
                            { color: team.isCuda ? theme.accentGold : theme.text },
                            team.isCuda && { fontWeight: '900' },
                          ]}
                          numberOfLines={1}
                        >
                          {team.name}
                        </Text>
                      </View>
                      <Text style={[styles.tdCell, styles.statCol, { color: theme.text }]}>{team.gp}</Text>
                      <Text style={[styles.tdCell, styles.recordCol, { color: theme.text }]}>
                        {`${team.w}-${team.l}-${team.otl}-${team.sol}`}
                      </Text>
                      <Text
                        style={[styles.tdCell, styles.statCol, { color: theme.accentGold, fontWeight: '900' }]}
                      >
                        {team.pts}
                      </Text>
                      <Text style={[styles.tdCell, styles.statCol, { color: theme.subText }]}>{team.pct}</Text>
                      <Text
                        style={[
                          styles.tdCell,
                          styles.statCol,
                          { color: isPositive ? '#2ecc71' : '#e74c3c', fontWeight: '700' },
                        ]}
                      >
                        {team.diff}
                      </Text>
                    </View>

                    {isPlayoffCutoff && (
                      <View style={[styles.playoffLine, { borderTopColor: theme.accentOrange }]}>
                        <Text style={[styles.playoffLineText, { color: theme.accentOrange }]}>
                          — CALDER CUP PLAYOFF LINE —
                        </Text>
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
  container: { marginVertical: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  seasonTag: { fontSize: 10, fontWeight: '700' },
  card: { borderRadius: 14, padding: 12, borderWidth: 1 },

  // Primary Scope Selector
  scopeBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Sub-Filter Row
  subFilterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  subPill: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPillText: {
    fontSize: 10,
    fontWeight: '700',
  },

  scrollContainer: { flexGrow: 1 },
  table: { width: '100%', minWidth: 460 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 6, marginBottom: 4, alignItems: 'center' },
  thCell: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1 },
  teamCellWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamMiniBadge: { width: 34, height: 20, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  cudaBadgeBorder: { borderWidth: 1, borderColor: '#000000' },
  teamMiniBadgeText: { fontSize: 9, fontWeight: '900' },
  tdCell: { fontSize: 11, fontWeight: '600' },
  rankCol: { width: 30, textAlign: 'center' },
  teamCol: { flex: 2.2, minWidth: 130, paddingLeft: 4 },
  statCol: { flex: 0.9, minWidth: 44, textAlign: 'center' },
  recordCol: { flex: 1.6, minWidth: 90, textAlign: 'center' },
  playoffLine: { borderTopWidth: 1, marginVertical: 4, paddingTop: 3, alignItems: 'center' },
  playoffLineText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
});