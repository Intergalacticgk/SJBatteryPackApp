import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  SafeAreaView, 
  StatusBar, 
  RefreshControl 
} from 'react-native';
import * as WebBrowser from 'expo-web-browser'; 
import { useRouter } from 'expo-router'; 
import { supabase } from '../../supabase'; 
import NextMatchups from '../../components/NextMatchups';
import LastEncounter from '../../components/LastEncounter';
import Standings from '../../components/Standings';
import { useAppTheme } from '../../context/ThemeContext';

interface UpcomingGame {
  id: string;
  game_date: string;
  date_display?: string;
  game_time: string;
  opponent: string;
  opponent_abbr: string;
  home_away: 'HOME' | 'AWAY';
  theme_night?: string;
  promo?: string;
}

type GuideTab = 'TIMELINE' | 'PARKING' | 'SECURITY' | 'FOOD';

export default function HomeScreen() {
  const router = useRouter(); 
  const { theme } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nextGame, setNextGame] = useState<UpcomingGame | null>(null);
  const [isGameWindowOpen, setIsGameWindowOpen] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>('TIMELINE');

  const SPOT_HERO_URL = "https://spothero.com/search?kind=destination&id=98853&%243p=a_hasoffers&%24affiliate_json=http%3A%2F%2Ftracking.spothero.com%2Faff_c%3Foffer_id%3D1%26aff_id%3D1822%26source%3Dtechcu%26aff_sub2%3Dparkingpage%26aff_sub3%3Dlink%26format%3Djson&operator_id=16236&_branch_match_id=1160313675964026424&utm_source=Partnerships&utm_campaign=Tune_Platform&utm_medium=paid+advertising&_branch_referrer=H4sIAAAAAAAAA32RwW7CMBBEvyY%2BQmJDCJWsqiri2AvqOXKcDXZJYtd2WnHh27sONIVSVfJlZ%2B2dfWMVgvUP87m3JihwZiasnbW6P8yDzyx9ed9B9njQfc1r8EH3ImjTE13zdVEsGUnoglkuSiW8aRpw%2Fm9FNI1utQhQvnnTc4WmCXtK6BZPcEKiwX42rSBNhzq%2BKWXCtuOUUxK4T22QJzaN8LgpKsfZmcBKwDiCVHC43%2FFBR1KxwcbQVe%2FhpMGxEQlQa4zoRsI5rEWPBiWCiGc9yynIyuHZc1k%2Fb3uUUCaakcN2ELmMCOPMqA7T6hXGSrZaHS53SVQNpwYq8qvIqX7C0kNWqksVyUazHy8aHUg7OQS%2BP%2BOJ1t5nkD9EOkT%2BNigdp%2Blq4Y2mHqtUeV8VWjEmJcvqFi3SX3N6INsZGiZcKOjizE4U2%2FA6cWBEUv8En4wBOyTcsz8jZhZ89yITN%2F4cmt8gcgckVLk%2FJyQF6OPzdsnLm04Pjz8qZDr4An%2F32gtICAAA%3D&view=dl&sc_src=email_810903&sc_lid=115904702&sc_uid=EylLZSAwqa&sc_llid=868&sc_eh=8a76f9a613a0bf8c1";

  const formatGameTimeDisplay = (timeStr?: string) => {
    if (!timeStr) return 'TBD';
    if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
      return `${timeStr} PST`;
    }
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; 
    return `${hours}:${minutesStr} ${ampm} PST`;
  };

  const getCalculatedDoorTimes = (timeStr?: string) => {
    if (!timeStr) return { memberTime: '5:45 PM', generalTime: '6:00 PM' };
    
    let hours = 19;
    let minutes = 0;

    const cleanTime = timeStr.trim().toUpperCase();
    if (cleanTime.includes('AM') || cleanTime.includes('PM')) {
      const parts = cleanTime.replace('PST', '').trim().split(':');
      hours = parseInt(parts[0], 10);
      const minParts = parts[1].split(' ');
      minutes = parseInt(minParts[0], 10);
      if (cleanTime.includes('PM') && hours < 12) hours += 12;
      if (cleanTime.includes('AM') && hours === 12) hours = 0;
    } else {
      const parts = cleanTime.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    }

    const gameDateObj = new Date();
    gameDateObj.setHours(hours, minutes, 0, 0);

    const memberDate = new Date(gameDateObj.getTime() - 75 * 60 * 1000);
    const generalDate = new Date(gameDateObj.getTime() - 60 * 60 * 1000);

    const formatTimeObj = (d: Date) => {
      let h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    };

    return {
      memberTime: formatTimeObj(memberDate),
      generalTime: formatTimeObj(generalDate)
    };
  };

  const checkGamedayActive = (gameDateStr: string) => {
    if (!gameDateStr) return;
    const todayLocalStr = new Date().toLocaleDateString('sv-SE');
    if (todayLocalStr === gameDateStr) {
      setIsGameWindowOpen(true);
    } else {
      setIsGameWindowOpen(false);
    }
  };

  const fetchNextMatchup = async () => {
    try {
      const todayString = new Date().toLocaleDateString('sv-SE'); 

      const { data, error } = await supabase
        .from('schedule')
        .select('*')
        .gte('game_date', todayString)              
        .order('game_date', { ascending: true })   
        .limit(1);                                  

      if (error) throw error;

      if (data && data.length > 0) {
        const game = data[0];
        setNextGame(game);
        checkGamedayActive(game.game_date);
      } else {
        setNextGame(null);
      }
    } catch (err) {
      console.warn("Supabase schedule fetch fallback engaged:", err);
      setNextGame(null);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNextMatchup();
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.warn("Pull to refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNextMatchup();
  }, []);

  // Issue 6 Fix: Always opens directly when pressed
  const handleCheckInPress = () => {
    setInfoModalVisible(true);
  };

  const doorTimes = getCalculatedDoorTimes(nextGame?.game_time || '');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'TIMELINE':
        return (
          <View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🕒 Gameday Entry Schedule</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>{doorTimes.memberTime}</Text> – Co-Branded Card Holders & Season Ticket Members early gate entry opens.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>{doorTimes.generalTime}</Text> – General Public doors open across Tech CU Arena access channels.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>Warm-ups</Text> – Glass lines crowd exactly 25 minutes prior to initial puck drop.</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🎁 Section 108 Operations & Promos</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Towel, promotional schedules, and banner distribution setups are live at the main booster table.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Stick around post-game for scheduled team events, jersey distributions, or player handshakes.</Text>
            </View>
          </View>
        );
      case 'PARKING':
        return (
          <View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🚗 Arena Lots & Garage Spaces</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Approximately 600 spaces surround the main facility with layout gates accessible via 10th Street or Alma Avenue.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Spaces open exactly <Text style={[styles.boldText, { color: theme.accentGold }]}>2 hours</Text> before the event start time.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Parking spots vanish fast near game time, so it's always recommended to reserve space options early.</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🅿️ SJSU South Campus Garage (Overflow)</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Offers 1,500 additional spaces directly across the street from the complexes off 10th St.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Run simple mobile parking validation checks through ParkMobile using <Text style={[styles.boldText, { color: theme.accentGold }]}>Zone Code #9033</Text>.</Text>
            </View>
            <TouchableOpacity 
              style={[styles.actionLinkButton, { backgroundColor: theme.accentOrange }]}
              onPress={() => WebBrowser.openBrowserAsync(SPOT_HERO_URL)}
            >
              <Text style={styles.actionLinkText}>🎟️ Reserve SpotHero Tracking Parking</Text>
            </TouchableOpacity>
          </View>
        );
      case 'SECURITY':
        return (
          <View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🔒 Bag Constraints & Clearance Guidelines</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Bags smaller than <Text style={[styles.boldText, { color: theme.accentGold }]}>5” x 9” x 2”</Text> ensure express lane clearance.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Accommodations remain open for larger styles up to <Text style={[styles.boldText, { color: theme.accentGold }]}>20” x 14” x 11”</Text>, but they require extended secondary physical check scans.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Bags must fit flat underneath stadium seats. Storage lockers are not available on-site.</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🏒 Hockey Arena Etiquette</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• Entry lines remain open on both the West Side/10th Street gates and back East Side layouts.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>Crucial Rule:</Text> Please wait for complete whistle stoppages in play before climbing down stairs to access seats.</Text>
            </View>
          </View>
        );
      case 'FOOD':
        return (
          <View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🍻 💡 The Cove (Section 108)</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>Open Every Game!</Text> The Cove is our biggest destination bar, right at home directly adjacent to our home base in Section 108.</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🍟 Kitchen Stands & Concourse Specials</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>Active Dining:</Text> Cuda Café, Slice x Craft, Classix, 408 Grill, Frenzy’s Faves, and TLC.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>Portables:</Text> Sec 113 (Chicken Skewers over Teal Rice), Sec 116 (The Kernel Popcorn), Sec 111 (Dessert Cart), and Sec 103/215 (Fast Beer Stands).</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🛑 Strict Ordering Deadlines</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>Food Kitchens:</Text> All primary concessions shut down right at the start of the 3rd period.</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>• <Text style={[styles.boldText, { color: theme.accentGold }]}>Alcohol Outlets:</Text> Taps close strictly at the 10-minute mark of the 3rd period.</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />
      
      <ScrollView 
        contentContainerStyle={styles.contentPadding}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accentGold}
            colors={[theme.accentGold, theme.accentOrange]}
          />
        }
      >
        {/* Banner */}
        <View style={[styles.welcomeBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>THE SJ BATTERY PACK</Text>
          <Text style={[styles.bannerSubtitle, { color: theme.text }]}>The Loudest Supporter Group in the AHL 🪸</Text>
        </View>

        {/* 1. 📍 GAMEDAY HQ */}
        {loading ? (
          <View style={[styles.loaderContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <ActivityIndicator size="small" color={theme.accentGold} />
          </View>
        ) : nextGame ? (
          <View style={[styles.checkInCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.checkInHeader}>
              <Text style={[styles.checkInTitle, { color: theme.accentGold }]}>📍 GAMEDAY HQ</Text>
              <Text style={[styles.checkInSubtitle, { color: theme.subText }]}>
                {nextGame.home_away === 'HOME'
                  ? `San Jose Barracuda vs ${nextGame.opponent}`
                  : `${nextGame.opponent} vs San Jose Barracuda`}
              </Text>
              <Text style={[styles.gameDetailsText, { color: theme.text }]}>
                📅 {nextGame.date_display || nextGame.game_date} | ⏰ {formatGameTimeDisplay(nextGame.game_time)}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.checkInButton, { backgroundColor: theme.accentOrange }]}
              onPress={handleCheckInPress}
              activeOpacity={0.85}
            >
              <Text style={styles.checkInButtonText}>
                {isGameWindowOpen ? "🪸 Gameday Guide Active!" : "🏟️ View Know Before You Go"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.checkInCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.checkInHeader}>
              <Text style={[styles.checkInTitle, { color: theme.accentGold }]}>📍 GAMEDAY HQ</Text>
              <Text style={[styles.checkInSubtitle, { color: theme.subText }]}>Next Home Game at Tech CU Arena</Text>
            </View>
            <TouchableOpacity 
              style={[styles.checkInButton, { backgroundColor: theme.accentOrange }]}
              onPress={handleCheckInPress}
              activeOpacity={0.85}
            >
              <Text style={styles.checkInButtonText}>🏟️ View Arena & Entry Guide</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. 🦈 DEFEND THE REEF */}
        <View style={[styles.aboutCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionHeader, { color: theme.accentGold }]}>🦈 DEFEND THE REEF. GIVE BACK.</Text>
          <Text style={[styles.aboutText, { color: theme.subText }]}>
            Established in 2021, the SJ Battery Pack is the Official Supporter Group for the San Jose Barracuda. We are a fan-made, fan-run 501(c)(3) non-profit dedicated to turning Section 108 into the loudest "No Quiet Zone" in the AHL.
          </Text>
          <Text style={[styles.aboutText, { color: theme.subText, marginTop: 6 }]}>
            Over the last five years, we’ve raised thousands for local causes like the Asian American Cancer Society and Second Harvest Food Bank because we believe that The Future Is Teal. Whether you’re a Day 1 fin-atic or a newcomer to Cuda Country, you have a place in our family.
          </Text>
        </View>

        {/* 3. 🏒 NEXT 3 MATCHUPS */}
        <NextMatchups key={`next-matchups-${refreshKey}`} />

        {/* 4. 📊 LAST ENCOUNTER */}
        <LastEncounter 
          key={`last-encounter-${refreshKey}`}
          opponentAbbr="BAK"
          opponentName="Bakersfield Condors"
          gameDate="JAN 21, 2026"
          scoreSJ={4}
          scoreOpp={2}
          isWin={true}
          gameFact="Barracuda recorded 34 shots on goal and held Bakersfield scoreless on 3 power play opportunities."
        />

        {/* 5. 🏆 AHL STANDINGS */}
        <Standings key={`standings-${refreshKey}`} />

        {/* 6. 🪸 FAN HUB */}
        <Text style={[styles.blockTitleCentered, { color: theme.accentGold }]}>⚡️ FAN HUB</Text>
        
        <View style={styles.gridRow}>
          <TouchableOpacity 
            style={[styles.gridButton, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]} 
            onPress={() => router.push('/passport')}
          >
            <Text style={[styles.gridButtonText, { color: theme.text }]}>🛂 Digital Passport</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.gridButton, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]} 
            onPress={() => router.push('/game/puckdrop')}
          >
            <Text style={[styles.gridButtonText, { color: theme.text }]}>🏒 Puck Drop Game</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.gridRow, { marginTop: 10 }]}>
          <TouchableOpacity 
            style={[styles.gridButton, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]} 
            onPress={() => WebBrowser.openBrowserAsync('https://sjbatterypack.com/shop')}
          >
            <Text style={[styles.gridButtonText, { color: theme.text }]}>👕 Swag Store</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.gridButton, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]} 
            onPress={() => router.push('/(drawer)/gallery')}
          >
            <Text style={[styles.gridButtonText, { color: theme.text }]}>📸 Fan Gallery</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Interactive Game Day Overlay Guide Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={infoModalVisible}
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            
            <Text style={[styles.modalHeader, { color: theme.accentGold }]}>🏟️ REEF KNOW BEFORE YOU GO</Text>
            <Text style={[styles.modalSub, { color: theme.subText }]}>
              {nextGame 
                ? (nextGame.home_away === 'HOME'
                    ? `San Jose Barracuda vs ${nextGame.opponent}`
                    : `${nextGame.opponent} vs San Jose Barracuda`)
                : 'Tech CU Arena Gameday Information'}
            </Text>
            
            <View style={[styles.tabBarRow, { borderColor: theme.borderColor }]}>
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                {(['TIMELINE', 'PARKING', 'SECURITY', 'FOOD'] as GuideTab[]).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.tabItemButton, 
                      { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                      activeTab === tab && { backgroundColor: theme.accentGold, borderColor: theme.accentGold }
                    ]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[
                      styles.tabItemText, 
                      { color: theme.subText },
                      activeTab === tab && { color: '#001417', fontWeight: '900' }
                    ]}>
                      {tab === 'TIMELINE' && '🕒 Schedule'}
                      {tab === 'PARKING' && '🚗 Parking'}
                      {tab === 'SECURITY' && '🔒 Entry'}
                      {tab === 'FOOD' && '🍔 Concessions'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollPadding}>
              {renderTabContent()}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.closeModalButton, { backgroundColor: theme.bg, borderTopColor: theme.borderColor }]}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={[styles.closeModalButtonText, { color: theme.accentGold }]}>Return to Home</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentPadding: { padding: 14, paddingBottom: 40 }, 
  welcomeBanner: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1 },
  bannerTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 }, 
  bannerSubtitle: { fontSize: 12, textAlign: 'center', fontWeight: '600', marginTop: 2 },
  
  checkInCard: { padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1 },
  checkInHeader: { marginBottom: 10, alignItems: 'center' },
  checkInTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  checkInSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  gameDetailsText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  checkInButton: { padding: 12, borderRadius: 10, alignItems: 'center' },
  checkInButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  loaderContainer: { height: 100, justifyContent: 'center', alignItems: 'center', borderRadius: 14, borderWidth: 1, marginBottom: 12 },

  aboutCard: { padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1 },
  sectionHeader: { fontSize: 14, fontWeight: '900', marginBottom: 6, textAlign: 'center', letterSpacing: 0.5 },
  aboutText: { fontSize: 12, lineHeight: 18, fontWeight: '500', textAlign: 'center' },
  
  blockTitleCentered: { fontSize: 14, fontWeight: '900', marginVertical: 10, textAlign: 'center', letterSpacing: 1 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between' },
  gridButton: { width: '48%', padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  gridButtonText: { fontSize: 14, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  modalContainer: { width: '92%', height: '85%', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  modalHeader: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 16, marginBottom: 2 },
  modalSub: { fontSize: 12, textAlign: 'center', marginBottom: 12, fontWeight: '700', paddingHorizontal: 10 },
  
  tabBarRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 8, paddingBottom: 6 },
  tabItemButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, borderWidth: 1 },
  tabItemText: { fontSize: 12, fontWeight: '700' },

  modalScrollView: { flex: 1 },
  modalScrollPadding: { padding: 16, paddingBottom: 30 },
  
  infoBox: { padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1 },
  infoTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  infoBody: { fontSize: 13, lineHeight: 18, fontWeight: '500', marginBottom: 4 },
  boldText: { fontWeight: 'bold' },

  actionLinkButton: { padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 4, marginBottom: 10 },
  actionLinkText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  
  closeModalButton: { padding: 14, alignItems: 'center', borderTopWidth: 1 },
  closeModalButtonText: { fontSize: 14, fontWeight: 'bold' }
});