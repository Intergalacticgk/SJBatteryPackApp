import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabase';

type PositionFilter = 'ALL' | 'FORWARDS' | 'DEFENSE' | 'GOALIES';

// Home opener for the 2026-27 season. Individual player stat totals stay
// blanked out in the UI (rather than showing 0s, which read as "played and
// did nothing") until this specific game's status in `schedule` is FINAL --
// not just once the calendar date arrives, so stats don't leak in hours
// before puck drop and still show correctly once this game wraps up, even
// if it runs past midnight.
const HOME_OPENER_DATE = '2026-10-03';
const CURRENT_SEASON = '2026-2027';

interface Player {
  id: string;
  jersey_number: string;
  name: string;
  position: string;
  shoots_catches?: string;
  height?: string;
  weight?: string;
  birthdate?: string;
  birthplace?: string;
  image_url?: string;
  nhl_id?: string;
  season?: string;
  gp: number;
  goals?: number;
  assists?: number;
  points?: number;
  plus_minus?: number;
  pim?: number;
  wins?: number;
  losses?: number;
  ot_losses?: number;
  gaa?: string | number;
  sv_pct?: string | number;
  shutouts?: number;
}

export default function RosterScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PositionFilter>('ALL');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [dataSeason, setDataSeason] = useState<string | null>(null);
  const [homeOpenerFinal, setHomeOpenerFinal] = useState(false);

  useEffect(() => {
    fetchRoster();
    fetchHomeOpenerStatus();

    const channel = supabase
      .channel('public:barracuda_roster_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barracuda_roster' }, () => {
        fetchRoster();
      })
      .subscribe();

    const scheduleChannel = supabase
      .channel('public:barracuda_schedule_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, () => {
        fetchHomeOpenerStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(scheduleChannel);
    };
  }, []);

  const fetchHomeOpenerStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('schedule')
        .select('status')
        .eq('game_date', HOME_OPENER_DATE)
        .maybeSingle();

      if (!error && data) {
        setHomeOpenerFinal(data.status === 'FINAL');
      }
    } catch (err) {
      console.warn('Error fetching home opener status:', err);
    }
  };

  const fetchRoster = async () => {
    try {
      setLoading(true);
      let { data, error } = await supabase
        .from('barracuda_roster')
        .select('*')
        .eq('season', '2026-2027')
        .order('points', { ascending: false });

      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from('barracuda_roster')
          .select('*')
          .order('points', { ascending: false });
        data = fallback.data;
      }

      setPlayers(data || []);
      setDataSeason(data && data.length > 0 ? (data[0].season || null) : null);
    } catch (err) {
      console.warn('Error fetching roster:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setFailedImages({});
    fetchRoster();
    fetchHomeOpenerStatus();
  }, []);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const pos = (player.position || '').toUpperCase();
      if (activeTab === 'FORWARDS') {
        return pos.includes('F') || pos.includes('LW') || pos.includes('RW') || pos.includes('C');
      } else if (activeTab === 'DEFENSE') {
        return pos.includes('D');
      } else if (activeTab === 'GOALIES') {
        return pos.includes('G');
      }
      return true;
    });
  }, [players, activeTab]);

  const counts = useMemo(() => {
    const fCount = players.filter((p) => {
      const pos = (p.position || '').toUpperCase();
      return pos.includes('F') || pos.includes('LW') || pos.includes('RW') || pos.includes('C');
    }).length;

    const dCount = players.filter((p) => (p.position || '').toUpperCase().includes('D')).length;
    const gCount = players.filter((p) => (p.position || '').toUpperCase().includes('G')).length;

    return { all: players.length, f: fCount, d: dCount, g: gCount };
  }, [players]);

  const isPreseason = !homeOpenerFinal;
  const isStaleSeasonData = Boolean(dataSeason) && dataSeason !== CURRENT_SEASON;

  const formatGAA = (val: any) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const num = parseFloat(String(val));
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const formatSVPct = (val: any) => {
    if (val === undefined || val === null || val === '') return '.000';
    let s = String(val).trim();
    if (s.startsWith('0.')) s = s.substring(1);
    if (!s.startsWith('.')) s = '.' + s;
    return s.padEnd(4, '0').substring(0, 4);
  };

  const renderPlayerCard = ({ item }: { item: Player }) => {
    const isGoalie = (item.position || '').toUpperCase().includes('G');
    // Blank real numbers until the season actually starts, so 0s don't read
    // as "played and did nothing." Doesn't apply when we're showing labeled
    // prior-season data (isStaleSeasonData), since those are real totals.
    const blankStats = isPreseason && !isStaleSeasonData;
    // Only trust a photo URL the sync actually verified (HockeyTech's own
    // CDN, keyed by their live player_id). No client-side guessing from
    // nhl_id here anymore — that's what showed the wrong photo for players
    // like Luca Cagnoni.
    const headshotUri = item.image_url?.trim() || null;

    const hasImage = Boolean(headshotUri) && !failedImages[item.id];

    return (
      <View style={[styles.playerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={styles.cardTopRow}>
          {hasImage ? (
            <View style={[styles.avatarContainer, { borderColor: theme.accentOrange }]}>
              <Image
                source={{ uri: headshotUri! }}
                style={styles.playerAvatar}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
                onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
              />
            </View>
          ) : (
            <View style={[styles.jerseyBadge, { backgroundColor: theme.accentOrange }]}>
              <Text style={styles.jerseyText}>
                {item.jersey_number ? `#${item.jersey_number}` : item.position || '--'}
              </Text>
            </View>
          )}

          <View style={styles.infoContainer}>
            <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.playerPosition, { color: theme.accentGold }]}>
              #{item.jersey_number || '--'} • {isGoalie ? 'Goaltender' : item.position === 'D' ? 'Defenseman' : 'Forward'}
            </Text>

            {item.birthplace ? (
              <Text style={[styles.bioText, { color: theme.subText }]} numberOfLines={1}>
                🌎 Born: {item.birthplace}
              </Text>
            ) : null}

            {item.birthdate ? (
              <Text style={[styles.bioText, { color: theme.subText }]}>
                🎂 DOB: {item.birthdate}
              </Text>
            ) : null}
          </View>

          <View style={styles.gpContainer}>
            <Text style={[styles.gpLabel, { color: theme.subText }]}>GP</Text>
            <Text style={[styles.gpValue, { color: theme.text }]}>{blankStats ? '–' : (item.gp ?? 0)}</Text>
          </View>
        </View>

        {isGoalie ? (
          <View style={[styles.statRow, { borderTopColor: theme.borderColor }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxLabel, { color: theme.subText }]}>WINS</Text>
              <Text style={[styles.statBoxValue, { color: '#00E5FF' }]}>{blankStats ? '–' : (item.wins ?? 0)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxLabel, { color: theme.subText }]}>LOSS</Text>
              <Text style={[styles.statBoxValue, { color: '#FFB800' }]}>{blankStats ? '–' : (item.losses ?? 0)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxLabel, { color: theme.subText }]}>GAA</Text>
              <Text style={[styles.statBoxValue, { color: theme.accentGold }]}>{blankStats ? '–' : formatGAA(item.gaa)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxLabel, { color: theme.subText }]}>SV%</Text>
              <Text style={[styles.statBoxValue, { color: '#00FFCC' }]}>{blankStats ? '–' : formatSVPct(item.sv_pct)}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.statRow, { borderTopColor: theme.borderColor }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxLabel, { color: theme.subText }]}>GOALS</Text>
              <Text style={[styles.statBoxValue, { color: '#00E5FF' }]}>{blankStats ? '–' : (item.goals ?? 0)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxLabel, { color: theme.subText }]}>ASSISTS</Text>
              <Text style={[styles.statBoxValue, { color: '#FFB800' }]}>{blankStats ? '–' : (item.assists ?? 0)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxLabel, { color: theme.subText }]}>POINTS</Text>
              <Text style={[styles.statBoxValue, { color: theme.accentGold }]}>{blankStats ? '–' : (item.points ?? 0)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxLabel, { color: theme.subText }]}>+/-</Text>
              <Text
                style={[
                  styles.statBoxValue,
                  {
                    color:
                      (item.plus_minus || 0) > 0
                        ? '#00FFCC'
                        : (item.plus_minus || 0) < 0
                        ? '#FF4D4D'
                        : theme.subText,
                  },
                ]}
              >
                {blankStats ? '–' : (item.plus_minus || 0) > 0 ? `+${item.plus_minus}` : item.plus_minus ?? 0}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['left', 'right']}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ALL' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('ALL')}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.tabText, { color: activeTab === 'ALL' ? '#001417' : theme.subText }]}
          >
            ALL ({counts.all})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'FORWARDS' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('FORWARDS')}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.tabText, { color: activeTab === 'FORWARDS' ? '#001417' : theme.subText }]}
          >
            FORWARDS ({counts.f})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'DEFENSE' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('DEFENSE')}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.tabText, { color: activeTab === 'DEFENSE' ? '#001417' : theme.subText }]}
          >
            DEFENSE ({counts.d})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'GOALIES' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('GOALIES')}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.tabText, { color: activeTab === 'GOALIES' ? '#001417' : theme.subText }]}
          >
            GOALIES ({counts.g})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.headerBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
        <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>🏒 BARRACUDA ROSTER & STATS</Text>
        <Text style={[styles.bannerSubtitle, { color: theme.text }]}>
          • Official AHL Feed •
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.accentGold} />
        </View>
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={(item) => item.id}
          renderItem={renderPlayerCard}
          contentContainerStyle={[styles.listPadding, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accentGold}
              colors={[theme.accentGold, theme.accentOrange]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.subText }]}>No players found in this category.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
  },
  headerBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerNote: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  bannerSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listPadding: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  playerCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#001E22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerAvatar: {
    width: '100%',
    height: '100%',
  },
  jerseyBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jerseyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '900',
  },
  playerPosition: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  bioText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  gpContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  gpLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  gpValue: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statBoxValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
});