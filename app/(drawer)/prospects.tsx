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
import { useAppTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabase';

type RegionTab = 'SHARKS' | 'JUNIORS' | 'NCAA' | 'EUROPE';

interface Prospect {
  id: string;
  name: string;
  position: string;
  draft_year: number;
  draft_round: number;
  draft_pick: number;
  current_team: string;
  league: string;
  region: RegionTab;
  shoots_catches?: string;
  height?: string;
  weight?: string;
  birthdate?: string;
  birthplace?: string;
  image_url?: string;
  nhl_id?: string;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  plus_minus: number;
  pim: number;
  season?: string;
}

export default function ProspectsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<RegionTab>('SHARKS');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchProspects();

    const channel = supabase
      .channel('public:sharks_prospects_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sharks_prospects' }, () => {
        fetchProspects();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProspects = async () => {
    try {
      setLoading(true);
      let { data, error } = await supabase
        .from('sharks_prospects')
        .select('*')
        .eq('season', '2026-2027')
        .order('points', { ascending: false });

      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from('sharks_prospects')
          .select('*')
          .order('points', { ascending: false });
        data = fallback.data;
      }

      setProspects(data || []);
    } catch (err) {
      console.warn('Error fetching prospects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setFailedImages({});
    fetchProspects();
  }, []);

  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => p.region === activeTab);
  }, [prospects, activeTab]);

  const counts = useMemo(() => ({
    sharks: prospects.filter((p) => p.region === 'SHARKS').length,
    juniors: prospects.filter((p) => p.region === 'JUNIORS').length,
    ncaa: prospects.filter((p) => p.region === 'NCAA').length,
    europe: prospects.filter((p) => p.region === 'EUROPE').length,
  }), [prospects]);

  const renderProspectCard = ({ item }: { item: Prospect }) => {
    const headshotUri =
      item.image_url?.trim() ||
      (item.nhl_id ? `https://assets.nhle.com/mugs/nhl/latest/${item.nhl_id}.png` : null);

    const hasImage = Boolean(headshotUri) && !failedImages[item.id];

    return (
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={styles.cardHeader}>
          {hasImage ? (
            <View style={[styles.avatarContainer, { borderColor: item.region === 'SHARKS' ? '#00788C' : theme.accentOrange }]}>
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
            <View style={[styles.posBadge, { backgroundColor: item.region === 'SHARKS' ? '#00788C' : theme.accentOrange }]}>
              <Text style={styles.posBadgeText}>{item.position}</Text>
            </View>
          )}

          <View style={styles.infoContainer}>
            <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.teamText, { color: theme.accentGold }]}>
              {item.current_team} • {item.league}
            </Text>
            <Text style={[styles.subDetail, { color: theme.subText }]}>
              {item.region === 'SHARKS'
                ? `Pos: ${item.position} • Shoots: ${item.shoots_catches || 'L'}`
                : `Draft: ${item.draft_year && item.draft_round > 0 ? `${item.draft_year} (Rd ${item.draft_round}, #${item.draft_pick})` : 'Undrafted'}`}
            </Text>
          </View>

          <View style={styles.gpContainer}>
            <Text style={[styles.gpLabel, { color: theme.subText }]}>GP</Text>
            <Text style={[styles.gpVal, { color: theme.text }]}>{item.gp}</Text>
          </View>
        </View>

        <View style={[styles.statRow, { borderTopColor: theme.borderColor }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.subText }]}>GOALS</Text>
            <Text style={[styles.statVal, { color: '#00E5FF' }]}>{item.goals}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.subText }]}>ASSISTS</Text>
            <Text style={[styles.statVal, { color: '#FFB800' }]}>{item.assists}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.subText }]}>POINTS</Text>
            <Text style={[styles.statVal, { color: theme.accentGold }]}>{item.points ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.subText }]}>+/-</Text>
            <Text
              style={[
                styles.statVal,
                {
                  color:
                    item.plus_minus > 0
                      ? '#00FFCC'
                      : item.plus_minus < 0
                      ? '#FF4D4D'
                      : theme.subText,
                },
              ]}
            >
              {item.plus_minus > 0 ? `+${item.plus_minus}` : item.plus_minus}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.subText }]}>PIM</Text>
            <Text style={[styles.statVal, { color: theme.text }]}>{item.pim}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['left', 'right']}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'SHARKS' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('SHARKS')}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tabText, { color: activeTab === 'SHARKS' ? '#001417' : theme.subText }]}>
            🦈 SHARKS ({counts.sharks})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'JUNIORS' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('JUNIORS')}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tabText, { color: activeTab === 'JUNIORS' ? '#001417' : theme.subText }]}>
            CHL ({counts.juniors})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'NCAA' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('NCAA')}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tabText, { color: activeTab === 'NCAA' ? '#001417' : theme.subText }]}>
            NCAA ({counts.ncaa})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'EUROPE' && { backgroundColor: theme.accentGold }]}
          onPress={() => setActiveTab('EUROPE')}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tabText, { color: activeTab === 'EUROPE' ? '#001417' : theme.subText }]}>
            EUR ({counts.europe})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.banner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
        <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>🦈 SHARKS SYSTEM PIPELINE</Text>
        <Text style={[styles.bannerSubtitle, { color: theme.text }]}>
          • Official Live Feed •
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.accentGold} />
        </View>
      ) : (
        <FlatList
          data={filteredProspects}
          keyExtractor={(item) => item.id}
          renderItem={renderProspectCard}
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
              <Text style={{ color: theme.subText }}>No players found in this category.</Text>
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
    marginHorizontal: 10,
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
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listPadding: { paddingHorizontal: 10, paddingTop: 6 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 10, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
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
  posBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posBadgeText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  infoContainer: { flex: 1, marginLeft: 12, marginRight: 8 },
  playerName: { fontSize: 16, fontWeight: '900' },
  teamText: { fontSize: 11, fontWeight: '800', marginTop: 1 },
  subDetail: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  gpContainer: { alignItems: 'center', justifyContent: 'center', minWidth: 36 },
  gpLabel: { fontSize: 10, fontWeight: '800' },
  gpVal: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statVal: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  emptyContainer: { padding: 40, alignItems: 'center' },
});