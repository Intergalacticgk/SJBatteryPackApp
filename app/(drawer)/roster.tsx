import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl
} from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import { fetchBarracudaRoster, RosterPlayer } from '../../services/ahlApi';

// Extending your RosterPlayer interface if your API supports these fields
interface ExtendedPlayer extends RosterPlayer {
  birthplace?: string;
  date_of_birth?: string;
}

export default function RosterScreen() {
  const { theme } = useAppTheme();
  const [selectedPos, setSelectedPos] = useState<'ALL' | 'F' | 'D' | 'G'>('ALL');
  const [players, setPlayers] = useState<ExtendedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Accordion state for 'ALL' tab
  const [forwardsOpen, setForwardsOpen] = useState(true);
  const [defenseOpen, setDefenseOpen] = useState(true);
  const [goaliesOpen, setGoaliesOpen] = useState(true);

  const loadRoster = async () => {
    try {
      const data = await fetchBarracudaRoster();
      if (Array.isArray(data)) {
        setPlayers(data);
      }
    } catch (e) {
      console.warn('Roster load fallback active', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRoster();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    loadRoster().finally(() => {
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, []);

  const safePlayers = Array.isArray(players) ? players : [];
  const forwardsList = safePlayers.filter((p) => p?.position === 'F');
  const defenseList = safePlayers.filter((p) => p?.position === 'D');
  const goaliesList = safePlayers.filter((p) => p?.position === 'G');

  const renderPlayerCard = (item: ExtendedPlayer) => {
    if (!item) return null;
    const isGoalie = item.position === 'G';

    return (
      <View key={item.id || item.number || Math.random().toString()} style={[styles.playerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={styles.playerTop}>
          <View style={[styles.numberBadge, { backgroundColor: theme.accentOrange }]}>
            <Text style={styles.numberText}>#{item.number || '0'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.playerName, { color: theme.text }]}>{item.name || 'Player'}</Text>
            <Text style={[styles.playerPos, { color: theme.accentGold }]}>
              {item.position === 'F' ? 'Forward' : item.position === 'D' ? 'Defenseman' : 'Goaltender'}
            </Text>
            {item.birthplace && (
              <Text style={[styles.bioText, { color: theme.subText }]}>🌍 Born: {item.birthplace}</Text>
            )}
            {item.date_of_birth && (
              <Text style={[styles.bioText, { color: theme.subText }]}>🎂 DOB: {item.date_of_birth}</Text>
            )}
          </View>
          <View style={styles.gpContainer}>
            <Text style={[styles.gpVal, { color: theme.text }]}>{item.gp ?? 0}</Text>
            <Text style={[styles.gpLabel, { color: theme.subText }]}>GP</Text>
          </View>
        </View>

        {isGoalie ? (
          <View style={[styles.statRow, { backgroundColor: theme.subCardBg, borderTopColor: theme.borderColor }]}>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{item.wins ?? 0}-{item.losses ?? 0}-{item.otl ?? 0}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>RECORD</Text></View>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.accentGold }]}>{item.gaa || '0.00'}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>GAA</Text></View>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.accentGold }]}>{item.svPct || '.000'}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>SV%</Text></View>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{item.so ?? 0}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>SO</Text></View>
          </View>
        ) : (
          <View style={[styles.statRow, { backgroundColor: theme.subCardBg, borderTopColor: theme.borderColor }]}>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.accentGold }]}>{item.goals ?? 0}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>G</Text></View>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.accentGold }]}>{item.assists ?? 0}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>A</Text></View>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.accentGold }]}>{item.points ?? 0}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>PTS</Text></View>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{(item.plusMinus ?? 0) > 0 ? `+${item.plusMinus}` : item.plusMinus ?? 0}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>+/-</Text></View>
            <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{item.pim ?? 0}</Text><Text style={[styles.statLabel, { color: theme.subText }]}>PIM</Text></View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity style={[styles.tabBtn, selectedPos === 'ALL' && { backgroundColor: theme.accentGold }]} onPress={() => setSelectedPos('ALL')}>
          <Text style={[styles.tabBtnText, { color: selectedPos === 'ALL' ? '#001417' : theme.text }]}>ALL ({safePlayers.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, selectedPos === 'F' && { backgroundColor: theme.accentGold }]} onPress={() => setSelectedPos('F')}>
          <Text style={[styles.tabBtnText, { color: selectedPos === 'F' ? '#001417' : theme.text }]}>FORWARDS ({forwardsList.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, selectedPos === 'D' && { backgroundColor: theme.accentGold }]} onPress={() => setSelectedPos('D')}>
          <Text style={[styles.tabBtnText, { color: selectedPos === 'D' ? '#001417' : theme.text }]}>DEFENSE ({defenseList.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, selectedPos === 'G' && { backgroundColor: theme.accentGold }]} onPress={() => setSelectedPos('G')}>
          <Text style={[styles.tabBtnText, { color: selectedPos === 'G' ? '#001417' : theme.text }]}>GOALIES ({goaliesList.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.contentPadding}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentGold} />}
      >
        <View style={[styles.headerCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.headerTitle, { color: theme.accentGold }]}>🏒 BARRACUDA ROSTER & STATS</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>2025–26 Official Final Season Totals</Text>
        </View>

        {loading && safePlayers.length === 0 ? (
          <ActivityIndicator size="large" color={theme.accentGold} style={{ marginTop: 40 }} />
        ) : selectedPos === 'ALL' ? (
          <View>
            <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]} onPress={() => setForwardsOpen(!forwardsOpen)}>
              <Text style={[styles.accordionTitle, { color: theme.accentGold }]}>FORWARDS ({forwardsList.length})</Text>
              <Text style={{ color: theme.accentGold, fontWeight: 'bold' }}>{forwardsOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {forwardsOpen && forwardsList.map(renderPlayerCard)}

            <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 10 }]} onPress={() => setDefenseOpen(!defenseOpen)}>
              <Text style={[styles.accordionTitle, { color: theme.accentGold }]}>DEFENSEMEN ({defenseList.length})</Text>
              <Text style={{ color: theme.accentGold, fontWeight: 'bold' }}>{defenseOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {defenseOpen && defenseList.map(renderPlayerCard)}

            <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 10 }]} onPress={() => setGoaliesOpen(!goaliesOpen)}>
              <Text style={[styles.accordionTitle, { color: theme.accentGold }]}>GOALTENDERS ({goaliesList.length})</Text>
              <Text style={{ color: theme.accentGold, fontWeight: 'bold' }}>{goaliesOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {goaliesOpen && goaliesList.map(renderPlayerCard)}
          </View>
        ) : (
          (selectedPos === 'F' ? forwardsList : selectedPos === 'D' ? defenseList : goaliesList).map(renderPlayerCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, gap: 6 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabBtnText: { fontSize: 11, fontWeight: '800' },
  contentPadding: { padding: 14, paddingBottom: 40 },
  headerCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  accordionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  playerCard: { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  playerTop: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  numberBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  numberText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  playerName: { fontSize: 15, fontWeight: '800' },
  playerPos: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  bioText: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  gpContainer: { alignItems: 'center', paddingHorizontal: 6 },
  gpVal: { fontSize: 16, fontWeight: '900' },
  gpLabel: { fontSize: 9, fontWeight: '700' },
  statRow: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: 8, paddingHorizontal: 6 },
  statCol: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 13, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '700', marginTop: 1 },
});