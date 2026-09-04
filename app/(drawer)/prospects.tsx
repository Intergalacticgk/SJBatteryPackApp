import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  StatusBar,
  RefreshControl
} from 'react-native';
import { fetchSharksProspects, ProspectItem } from '../../services/ahlApi';
import { useAppTheme } from '../../context/ThemeContext';

interface ExtendedProspectItem extends ProspectItem {
  birthplace?: string;
  date_of_birth?: string;
}

export default function ProspectsScreen() {
  const { theme } = useAppTheme();
  const [prospects, setProspects] = useState<ExtendedProspectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Set default initial state to false so all are collapsed
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'San Jose Sharks (NHL)': false,
    'San Jose Barracuda (AHL)': false,
    'Wichita Thunder (ECHL)': false,
    'Juniors & NCAA / Europe': false,
  });

  const GROUPS: Array<'San Jose Sharks (NHL)' | 'San Jose Barracuda (AHL)' | 'Wichita Thunder (ECHL)' | 'Juniors & NCAA / Europe'> = [
    'San Jose Sharks (NHL)',
    'San Jose Barracuda (AHL)',
    'Wichita Thunder (ECHL)',
    'Juniors & NCAA / Europe',
  ];

  const loadData = async () => {
    try {
      const data = await fetchSharksProspects();
      setProspects(data);
    } catch (e) {
      console.warn('Error fetching prospects', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, []);

  const toggleGroup = (g: string) => {
    setExpandedGroups((prev) => ({ ...prev, [g]: !prev[g] }));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.accentGold} />
          <Text style={[styles.loadingText, { color: theme.accentGold }]}>Loading Sharks System Prospects...</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentGold} />}
        >
          <View style={[styles.banner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>🦈 THE FUTURE IS TEAL</Text>
            <Text style={[styles.bannerSub, { color: theme.subText }]}>Track players across the Sharks organization pipeline</Text>
          </View>

          {GROUPS.map((groupName) => {
            const playersInGroup = prospects.filter((p) => p.leagueGroup === groupName);
            const isExpanded = !!expandedGroups[groupName];

            return (
              <View key={groupName} style={[styles.groupCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(groupName)} activeOpacity={0.8}>
                  <View style={styles.groupHeaderLeft}>
                    <Text style={[styles.groupTitle, { color: theme.text }]}>{groupName}</Text>
                    <Text style={[styles.countText, { color: theme.subText }]}>({playersInGroup.length})</Text>
                  </View>
                  <Text style={[styles.arrow, { color: theme.accentGold }]}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.playersList}>
                    {playersInGroup.map((player) => (
                      <View key={player.id} style={[styles.playerItem, { borderTopColor: theme.borderColor }]}>
                        <View style={styles.playerTop}>
                          <Text style={[styles.playerName, { color: theme.text }]}>{player.name}</Text>
                          <View style={[styles.posBadge, { backgroundColor: theme.subCardBg }]}>
                            <Text style={[styles.posBadgeText, { color: theme.accentGold }]}>{player.position}</Text>
                          </View>
                        </View>
                        
                        <Text style={[styles.draftText, { color: theme.subText }]}>🎯 {player.draftInfo} • {player.currentTeam}</Text>
                        
                        {(player.birthplace || player.date_of_birth) && (
                           <Text style={[styles.bioText, { color: theme.subText }]}>
                             {player.birthplace ? `🌍 Born: ${player.birthplace} ` : ''}
                             {player.date_of_birth ? `🎂 DOB: ${player.date_of_birth}` : ''}
                           </Text>
                        )}

                        <View style={[styles.statsPill, { backgroundColor: theme.isDark ? '#001417' : '#E6ECEE' }]}>
                          <Text style={[styles.statsText, { color: theme.accentGold }]}>
                            GP: {player.gp}  |  {player.statsSummary}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollList: { padding: 14, paddingBottom: 40 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontWeight: '800' },
  banner: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  bannerSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  groupCard: { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupTitle: { fontSize: 14, fontWeight: '900' },
  countText: { fontSize: 12, fontWeight: '600' },
  arrow: { fontSize: 12, fontWeight: '900' },
  playersList: { paddingHorizontal: 12, paddingBottom: 6 },
  playerItem: { borderTopWidth: 1, paddingVertical: 10 },
  playerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerName: { fontSize: 14, fontWeight: '900' },
  posBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  posBadgeText: { fontSize: 10, fontWeight: '900' },
  draftText: { fontSize: 11, marginTop: 2 },
  bioText: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  statsPill: { marginTop: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  statsText: { fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },
});