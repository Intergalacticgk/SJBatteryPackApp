import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  StatusBar 
} from 'react-native';
import { fetchBarracudaRoster, RosterPlayer } from '../../services/ahlApi';
import { useAppTheme } from '../../context/ThemeContext';

export default function RosterScreen() {
  const { theme } = useAppTheme();
  const [tab, setTab] = useState<'F' | 'D' | 'G'>('F');
  const [roster, setRoster] = useState<{
    forwards: RosterPlayer[];
    defensemen: RosterPlayer[];
    goalies: RosterPlayer[];
  }>({ forwards: [], defensemen: [], goalies: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchBarracudaRoster();
      setRoster(data);
      setLoading(false);
    }
    loadData();
  }, []);

  const activePlayers = tab === 'F' ? roster.forwards : tab === 'D' ? roster.defensemen : roster.goalies;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* Position Selector Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'F' && { backgroundColor: theme.subCardBg, borderColor: theme.accentGold, borderWidth: 1 }]}
          onPress={() => setTab('F')}
        >
          <Text style={[styles.tabText, { color: tab === 'F' ? theme.accentGold : theme.subText }]}>🏒 Forwards ({roster.forwards.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'D' && { backgroundColor: theme.subCardBg, borderColor: theme.accentGold, borderWidth: 1 }]}
          onPress={() => setTab('D')}
        >
          <Text style={[styles.tabText, { color: tab === 'D' ? theme.accentGold : theme.subText }]}>🛡️ Defense ({roster.defensemen.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'G' && { backgroundColor: theme.subCardBg, borderColor: theme.accentGold, borderWidth: 1 }]}
          onPress={() => setTab('G')}
        >
          <Text style={[styles.tabText, { color: tab === 'G' ? theme.accentGold : theme.subText }]}>🥅 Goalies ({roster.goalies.length})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.accentGold} />
          <Text style={[styles.loadingText, { color: theme.accentGold }]}>Loading Roster Stats...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList}>
          {activePlayers.map((player) => (
            <View key={player.id} style={[styles.playerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              
              <View style={styles.cardTop}>
                <View style={[styles.numberCircle, { backgroundColor: theme.subCardBg, borderColor: theme.accentGold }]}>
                  <Text style={[styles.numberText, { color: theme.accentGold }]}>#{player.number}</Text>
                </View>
                <View style={styles.nameBlock}>
                  <Text style={[styles.playerName, { color: theme.text }]}>{player.name}</Text>
                  <Text style={[styles.playerPos, { color: theme.subText }]}>
                    {player.position === 'F' ? 'Forward' : player.position === 'D' ? 'Defenseman' : 'Goaltender'}
                  </Text>
                </View>
              </View>

              {/* Stats Grid */}
              <View style={[styles.statsGrid, { backgroundColor: theme.isDark ? '#001417' : '#E6ECEE' }]}>
                {player.position === 'G' ? (
                  <>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{player.gp}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>GP</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.accentGold }]}>{player.wins}-{player.losses}-{player.otl}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>W-L-OTL</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{player.gaa}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>GAA</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: '#2ecc71' }]}>{player.svPct}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>SV%</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.accentGold }]}>{player.so}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>SO</Text></View>
                  </>
                ) : (
                  <>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{player.gp}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>GP</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{player.goals}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>G</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{player.assists}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>A</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.accentGold }]}>{player.points}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>PTS</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: (player.plusMinus || 0) >= 0 ? '#2ecc71' : '#e74c3c' }]}>{(player.plusMinus || 0) > 0 ? `+${player.plusMinus}` : player.plusMinus}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>+/-</Text></View>
                    <View style={styles.statCol}><Text style={[styles.statNum, { color: theme.text }]}>{player.pim}</Text><Text style={[styles.statLbl, { color: theme.subText }]}>PIM</Text></View>
                  </>
                )}
              </View>

            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', marginHorizontal: 14, marginTop: 10, marginBottom: 8, borderRadius: 12, padding: 3, borderWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '800' },
  scrollList: { padding: 14, paddingBottom: 40 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontWeight: '800' },
  playerCard: { borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  numberCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  numberText: { fontSize: 13, fontWeight: '900' },
  nameBlock: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '900' },
  playerPos: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderRadius: 8 },
  statCol: { alignItems: 'center' },
  statNum: { fontSize: 13, fontWeight: '900' },
  statLbl: { fontSize: 9, fontWeight: '700', marginTop: 1 },
});