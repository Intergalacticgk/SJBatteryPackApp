import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import { fetchBarracudaSchedule, GameScheduleItem } from '../../services/ahlApi';

export default function ScheduleScreen() {
  const { theme } = useAppTheme();
  const [filter, setFilter] = useState<'ALL' | 'HOME' | 'AWAY'>('ALL');
  const [schedule, setSchedule] = useState<GameScheduleItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadSchedule = async () => {
      try {
        const data = await fetchBarracudaSchedule();
        if (isMounted && Array.isArray(data)) {
          setSchedule(data);
        }
      } catch (err) {
        console.warn('Schedule fallback active', err);
      }
    };
    loadSchedule();
    return () => {
      isMounted = false;
    };
  }, []);

  const safeSchedule = Array.isArray(schedule) ? schedule : [];
  const filtered = filter === 'ALL' ? safeSchedule : safeSchedule.filter((g) => g && g.homeAway === filter);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* Filter Tabs */}
      <View style={[styles.filterBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'ALL' && { backgroundColor: theme.accentGold }]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterBtnText, { color: filter === 'ALL' ? '#001417' : theme.text }]}>ALL GAMES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'HOME' && { backgroundColor: theme.accentGold }]}
          onPress={() => setFilter('HOME')}
        >
          <Text style={[styles.filterBtnText, { color: filter === 'HOME' ? '#001417' : theme.text }]}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'AWAY' && { backgroundColor: theme.accentGold }]}
          onPress={() => setFilter('AWAY')}
        >
          <Text style={[styles.filterBtnText, { color: filter === 'AWAY' ? '#001417' : theme.text }]}>AWAY</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.contentPadding}>
        <View style={[styles.headerCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.headerTitle, { color: theme.accentGold }]}>📅 2026–27 BARRACUDA SCHEDULE</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>Section 108 Rally Schedule & Theme Nights</Text>
        </View>

        {filtered.map((game) => {
          if (!game) return null;
          const isHome = game.homeAway === 'HOME';

          return (
            <View
              key={game.id || Math.random().toString()}
              style={[styles.gameCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <View style={styles.topRow}>
                <View style={[styles.homeAwayBadge, { backgroundColor: isHome ? theme.accentGold : theme.subCardBg }]}>
                  <Text style={[styles.homeAwayText, { color: isHome ? '#001417' : theme.subText }]}>
                    {game.homeAway}
                  </Text>
                </View>
                <Text style={[styles.gameDate, { color: theme.accentGold }]}>{game.date}</Text>
              </View>

              <Text style={[styles.opponentText, { color: theme.text }]}>
                {isHome ? 'vs.' : '@'} {game.opponent}
              </Text>
              <Text style={[styles.metaText, { color: theme.subText }]}>📍 {game.venue} • ⏰ {game.time}</Text>

              {game.themeNight && (
                <View style={[styles.themePill, { backgroundColor: 'rgba(255, 184, 0, 0.15)', borderColor: theme.accentGold }]}>
                  <Text style={[styles.themePillText, { color: theme.accentGold }]}>🎉 {game.themeNight}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  filterBtnText: { fontSize: 12, fontWeight: '800' },
  contentPadding: { padding: 14, paddingBottom: 40 },
  headerCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  gameCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  homeAwayBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  homeAwayText: { fontSize: 10, fontWeight: '900' },
  gameDate: { fontSize: 12, fontWeight: '800' },
  opponentText: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  metaText: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  themePill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start', marginTop: 2 },
  themePillText: { fontSize: 11, fontWeight: '800' },
});