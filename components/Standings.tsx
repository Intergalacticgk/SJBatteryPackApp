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

const TEAM_BADGES: Record<string, { abbr: string; bg: string; text: string }> = {
  'ontario reign': { abbr: 'ONT', bg: '#111111', text: '#FFFFFF' },
  'colorado eagles': { abbr: 'COL', bg: '#6F263D', text: '#FFFFFF' },
  'henderson silver knights': { abbr: 'HSK', bg: '#777777', text: '#FFFFFF' },
  'coachella valley firebirds': { abbr: 'CV', bg: '#D82232', text: '#FFFFFF' },
  'bakersfield condors': { abbr: 'BAK', bg: '#002D62', text: '#FFFFFF' },
  'san jose barracuda': { abbr: 'SJ', bg: '#266B73', text: '#FFFFFF' },
  'san diego gulls': { abbr: 'SD', bg: '#FF4C00', text: '#FFFFFF' },
  'tucson roadrunners': { abbr: 'TUC', bg: '#8C2633', text: '#FFFFFF' },
  'abbotsford canucks': { abbr: 'ABB', bg: '#00843D', text: '#FFFFFF' },
  'calgary wranglers': { abbr: 'CGY', bg: '#C8102E', text: '#FFFFFF' },
};

const BASE_FALLBACK_DIVISIONS: Record<DivisionType, StandingRow[]> = {
  PACIFIC: [
    { rank: 1, abbr: 'ONT', name: 'Reign', badgeBg: '#111111', badgeText: '#FFFFFF', gp: 72, w: 47, l: 20, otl: 3, sol: 2, pts: 99, pct: '.688', diff: '+50', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 2, abbr: 'COL', name: 'Eagles', badgeBg: '#6F263D', badgeText: '#FFFFFF', gp: 72, w: 41, l: 20, otl: 6, sol: 5, pts: 93, pct: '.646', diff: '+39', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 3, abbr: 'HSK', name: 'Silver Knights', badgeBg: '#777777', badgeText: '#FFFFFF', gp: 72, w: 39, l: 21, otl: 7, sol: 5, pts: 90, pct: '.625', diff: '+38', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 4, abbr: 'CV', name: 'Firebirds', badgeBg: '#D82232', badgeText: '#FFFFFF', gp: 72, w: 41, l: 25, otl: 6, sol: 0, pts: 88, pct: '.611', diff: '+17', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 5, abbr: 'BAK', name: 'Condors', badgeBg: '#002D62', badgeText: '#FFFFFF', gp: 72, w: 37, l: 23, otl: 11, sol: 1, pts: 86, pct: '.597', diff: '+8', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 6, abbr: 'SJ', name: 'Barracuda', badgeBg: '#266B73', badgeText: '#FFFFFF', gp: 72, w: 40, l: 28, otl: 2, sol: 2, pts: 84, pct: '.583', diff: '+13', isCuda: true, conference: 'WEST', division: 'PACIFIC' },
    { rank: 7, abbr: 'SD', name: 'Gulls', badgeBg: '#FF4C00', badgeText: '#FFFFFF', gp: 72, w: 33, l: 27, otl: 8, sol: 4, pts: 78, pct: '.542', diff: '-4', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 8, abbr: 'TUC', name: 'Roadrunners', badgeBg: '#8C2633', badgeText: '#FFFFFF', gp: 72, w: 34, l: 28, otl: 10, sol: 0, pts: 78, pct: '.542', diff: '-9', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 9, abbr: 'ABB', name: 'Canucks', badgeBg: '#00843D', badgeText: '#FFFFFF', gp: 72, w: 28, l: 37, otl: 4, sol: 3, pts: 63, pct: '.438', diff: '-61', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
    { rank: 10, abbr: 'CGY', name: 'Wranglers', badgeBg: '#C8102E', badgeText: '#FFFFFF', gp: 72, w: 23, l: 34, otl: 10, sol: 5, pts: 61, pct: '.424', diff: '-66', isCuda: false, conference: 'WEST', division: 'PACIFIC' },
  ],
  CENTRAL: [
    { rank: 1, abbr: 'GR', name: 'Griffins', badgeBg: '#C8102E', badgeText: '#002D62', gp: 72, w: 51, l: 16, otl: 4, sol: 1, pts: 107, pct: '.743', diff: '+96', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 2, abbr: 'CHI', name: 'Wolves', badgeBg: '#8B0000', badgeText: '#FFFFFF', gp: 72, w: 36, l: 21, otl: 8, sol: 7, pts: 87, pct: '.604', diff: '+7', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 3, abbr: 'TEX', name: 'Stars', badgeBg: '#006847', badgeText: '#FFFFFF', gp: 72, w: 37, l: 29, otl: 4, sol: 2, pts: 80, pct: '.556', diff: '-6', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 4, abbr: 'MB', name: 'Moose', badgeBg: '#002D62', badgeText: '#A2AAAD', gp: 72, w: 35, l: 29, otl: 5, sol: 3, pts: 78, pct: '.542', diff: '-31', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 5, abbr: 'MIL', name: 'Admirals', badgeBg: '#002D62', badgeText: '#A2AAAD', gp: 72, w: 32, l: 33, otl: 4, sol: 3, pts: 71, pct: '.493', diff: '-15', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 6, abbr: 'IA', name: 'Wild', badgeBg: '#154734', badgeText: '#DDCBA4', gp: 72, w: 27, l: 36, otl: 6, sol: 3, pts: 63, pct: '.438', diff: '-47', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
    { rank: 7, abbr: 'RFD', name: 'IceHogs', badgeBg: '#C8102E', badgeText: '#000000', gp: 72, w: 28, l: 39, otl: 3, sol: 2, pts: 61, pct: '.424', diff: '-49', isCuda: false, conference: 'WEST', division: 'CENTRAL' },
  ],
  ATLANTIC: [
    { rank: 1, abbr: 'PRO', name: 'Bruins', badgeBg: '#000000', badgeText: '#FFB81C', gp: 72, w: 54, l: 16, otl: 2, sol: 0, pts: 110, pct: '.764', diff: '+77', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 2, abbr: 'WBS', name: 'Penguins', badgeBg: '#000000', badgeText: '#CFC493', gp: 72, w: 46, l: 17, otl: 7, sol: 2, pts: 101, pct: '.701', diff: '+57', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 3, abbr: 'CLT', name: 'Checkers', badgeBg: '#C8102E', badgeText: '#002D62', gp: 72, w: 44, l: 23, otl: 5, sol: 0, pts: 93, pct: '.646', diff: '+51', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 4, abbr: 'BRI', name: 'Islanders', badgeBg: '#00539B', badgeText: '#F47920', gp: 72, w: 34, l: 30, otl: 3, sol: 5, pts: 76, pct: '.528', diff: '-3', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 5, abbr: 'HER', name: 'Bears', badgeBg: '#4A2A18', badgeText: '#D1AB66', gp: 72, w: 32, l: 31, otl: 6, sol: 3, pts: 73, pct: '.507', diff: '-20', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 6, abbr: 'SPR', name: 'Thunderbirds', badgeBg: '#002D62', badgeText: '#39A9DC', gp: 72, w: 32, l: 32, otl: 6, sol: 2, pts: 72, pct: '.500', diff: '-33', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 7, abbr: 'LV', name: 'Phantoms', badgeBg: '#F47920', badgeText: '#000000', gp: 72, w: 31, l: 35, otl: 3, sol: 3, pts: 68, pct: '.472', diff: '-37', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
    { rank: 8, abbr: 'HFD', name: 'Wolf Pack', badgeBg: '#002D62', badgeText: '#C8102E', gp: 72, w: 26, l: 38, otl: 5, sol: 3, pts: 60, pct: '.417', diff: '-63', isCuda: false, conference: 'EAST', division: 'ATLANTIC' },
  ],
  NORTH: [
    { rank: 1, abbr: 'LAV', name: 'Rocket', badgeBg: '#002D62', badgeText: '#C8102E', gp: 72, w: 41, l: 23, otl: 3, sol: 5, pts: 90, pct: '.625', diff: '+33', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 2, abbr: 'SYR', name: 'Crunch', badgeBg: '#002D62', badgeText: '#A2AAAD', gp: 72, w: 41, l: 24, otl: 3, sol: 4, pts: 89, pct: '.618', diff: '+48', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 3, abbr: 'CLE', name: 'Monsters', badgeBg: '#000000', badgeText: '#872434', gp: 72, w: 37, l: 26, otl: 6, sol: 3, pts: 83, pct: '.576', diff: '-10', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 4, abbr: 'TOR', name: 'Marlies', badgeBg: '#002D62', badgeText: '#FFFFFF', gp: 72, w: 36, l: 26, otl: 5, sol: 5, pts: 82, pct: '.569', diff: '+1', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 5, abbr: 'ROC', name: 'Americans', badgeBg: '#C8102E', badgeText: '#002D62', gp: 72, w: 31, l: 31, otl: 6, sol: 4, pts: 72, pct: '.500', diff: '-21', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 6, abbr: 'UTC', name: 'Comets', badgeBg: '#002D62', badgeText: '#00843D', gp: 72, w: 30, l: 31, otl: 6, sol: 5, pts: 71, pct: '.493', diff: '-21', isCuda: false, conference: 'EAST', division: 'NORTH' },
    { rank: 7, abbr: 'BEL', name: 'Senators', badgeBg: '#000000', badgeText: '#C8102E', gp: 72, w: 28, l: 35, otl: 8, sol: 1, pts: 65, pct: '.451', diff: '-39', isCuda: false, conference: 'EAST', division: 'NORTH' },
  ],
};

export default function Standings() {
  const { theme } = useAppTheme();
  
  // Default selection remains Pacific Division
  const [scope, setScope] = useState<ViewScope>('DIVISION');
  const [selectedDivision, setSelectedDivision] = useState<DivisionType>('PACIFIC');
  const [selectedConference, setSelectedConference] = useState<ConferenceType>('WEST');

  const [livePacific, setLivePacific] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [is2026SeasonActive, setIs2026SeasonActive] = useState(false);

  useEffect(() => {
    fetchLivePacificStandings();
  }, []);

  const fetchLivePacificStandings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('standings')
        .select('*')
        .order('rank', { ascending: true });

      if (error) throw error;

      if (Array.isArray(data) && data.length > 0) {
        const totalGP = data.reduce((acc, row) => acc + (Number(row.games_played) || 0), 0);
        const avgGP = totalGP / data.length;
        if (avgGP > 0 && avgGP < 60) {
          setIs2026SeasonActive(true);
        }

        const formatted: StandingRow[] = data.map((t: any, idx: number) => {
          const lowerName = (t.team_name || '').toLowerCase();
          const badgeMeta = Object.keys(TEAM_BADGES).find((k) => lowerName.includes(k))
            ? TEAM_BADGES[Object.keys(TEAM_BADGES).find((k) => lowerName.includes(k))!]
            : { abbr: t.team_name.substring(0, 3).toUpperCase(), bg: '#333333', text: '#FFFFFF' };

          const isCuda = lowerName.includes('barracuda');
          const diffVal = Number(t.goals_for || 0) - Number(t.goals_against || 0);

          return {
            rank: Number(t.rank || idx + 1),
            abbr: badgeMeta.abbr,
            name: t.team_name.replace('San Jose ', '').replace('Coachella Valley ', ''),
            badgeBg: badgeMeta.bg,
            badgeText: badgeMeta.text,
            gp: Number(t.games_played || 0),
            w: Number(t.wins || 0),
            l: Number(t.losses || 0),
            otl: Number(t.ot_losses || 0),
            sol: Number(t.sol_losses || 0),
            pts: Number(t.points || 0),
            pct: String(t.win_percentage || '.000'),
            diff: diffVal >= 0 ? `+${diffVal}` : `${diffVal}`,
            isCuda,
            conference: 'WEST',
            division: 'PACIFIC',
          };
        });
        setLivePacific(formatted);
      } else {
        setLivePacific(BASE_FALLBACK_DIVISIONS.PACIFIC);
      }
    } catch {
      setLivePacific(BASE_FALLBACK_DIVISIONS.PACIFIC);
    } finally {
      setLoading(false);
    }
  };

  // Compile all league teams (incorporating live Pacific rows where available)
  const allTeams: StandingRow[] = useMemo(() => {
    const pacificSquads = livePacific.length > 0 ? livePacific : BASE_FALLBACK_DIVISIONS.PACIFIC;
    return [
      ...pacificSquads,
      ...BASE_FALLBACK_DIVISIONS.CENTRAL,
      ...BASE_FALLBACK_DIVISIONS.ATLANTIC,
      ...BASE_FALLBACK_DIVISIONS.NORTH,
    ];
  }, [livePacific]);

  // Compute displayed list based on chosen view mode
  const currentTeams: StandingRow[] = useMemo(() => {
    if (scope === 'DIVISION') {
      if (selectedDivision === 'PACIFIC' && livePacific.length > 0) {
        return livePacific;
      }
      return BASE_FALLBACK_DIVISIONS[selectedDivision];
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
  }, [scope, selectedDivision, selectedConference, livePacific, allTeams]);

  // Dynamic header title and season label
  const getHeaderTitle = () => {
    if (scope === 'DIVISION') return `AHL ${selectedDivision} STANDINGS`;
    if (scope === 'CONFERENCE') return `AHL ${selectedConference === 'WEST' ? 'WESTERN' : 'EASTERN'} CONFERENCE`;
    return 'AHL LEAGUE STANDINGS';
  };

  const currentSeasonLabel = is2026SeasonActive ? '2026–2027' : '2025–2026 TOTALS';

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

        {loading && scope === 'DIVISION' && selectedDivision === 'PACIFIC' ? (
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