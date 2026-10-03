import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  RefreshControl,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser'; 
import { useRouter } from 'expo-router'; 
import { supabase } from '../../supabase'; 
import NextMatchups from '../../components/NextMatchups';
import LastEncounter from '../../components/LastEncounter';
import Standings from '../../components/Standings';
import { useAppTheme } from '../../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

interface MatchedSupporterEvent {
  id: string;
  title: string;
  category: string;
  badge: string;
  event_time: string;
  location: string;
  description: string;
  icon?: string;
}

type GuideTab = 'TIMELINE' | 'PARKING' | 'SECURITY' | 'FOOD';

export default function HomeScreen() {
  const router = useRouter(); 
  const { theme } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nextGame, setNextGame] = useState<UpcomingGame | null>(null);
  const [matchedEvents, setMatchedEvents] = useState<MatchedSupporterEvent[]>([]);
  const [isGameWindowOpen, setIsGameWindowOpen] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>('TIMELINE');

  const SPOT_HERO_URL = "https://spothero.com/search?kind=destination&id=98853";

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
    if (!timeStr) return { memberTime: '1:45 PM', generalTime: '2:00 PM' };
    
    let hours = 15;
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
    setIsGameWindowOpen(todayLocalStr === gameDateStr);
  };

  const fetchNextMatchupAndEvents = useCallback(async (isMounted = true) => {
    try {
      const todayString = new Date().toLocaleDateString('sv-SE'); 

      const { data, error } = await supabase
        .from('schedule')
        .select('*')
        .gte('game_date', todayString)              
        .order('game_date', { ascending: true })   
        .limit(1);                                  

      if (error) throw error;

      if (isMounted) {
        if (data && data.length > 0) {
          const game = data[0];
          setNextGame(game);
          checkGamedayActive(game.game_date);

          const { data: eventsData } = await supabase
            .from('supporter_events')
            .select('*')
            .eq('event_date', game.game_date);

          if (Array.isArray(eventsData)) {
            setMatchedEvents(
              eventsData.map((e: any) => ({
                id: String(e.id),
                title: e.title,
                category: e.category,
                badge: e.badge,
                event_time: e.event_time,
                location: e.location,
                description: e.description,
                icon: e.icon || '🏒',
              }))
            );
          } else {
            setMatchedEvents([]);
          }
        } else {
          setNextGame(null);
          setMatchedEvents([]);
        }
      }
    } catch (err) {
      console.warn("Supabase schedule fetch fallback engaged:", err);
      if (isMounted) {
        setNextGame(null);
        setMatchedEvents([]);
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNextMatchupAndEvents(true);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.warn("Pull to refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchNextMatchupAndEvents]);

  useEffect(() => {
    let mounted = true;
    fetchNextMatchupAndEvents(mounted);
    return () => {
      mounted = false;
    };
  }, [fetchNextMatchupAndEvents]);

  const handleCheckInPress = () => {
    setActiveTab('TIMELINE');
    setInfoModalVisible(true);
  };

  const doorTimes = getCalculatedDoorTimes(nextGame?.game_time || '');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'TIMELINE': {
        const tablingEvent = matchedEvents.find(
          (evt) => evt.category?.toLowerCase() === 'tabling'
        );

        return (
          <View>
            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🕒 Gameday Entry & Gate Times</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>
                • <Text style={[styles.boldText, { color: theme.accentGold }]}>{doorTimes.memberTime}</Text> – Co-Branded Card Holders & Season Ticket Members early gate entry opens.
              </Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>
                • <Text style={[styles.boldText, { color: theme.accentGold }]}>{doorTimes.generalTime}</Text> – General Public doors open across Tech CU Arena access channels.
              </Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>
                • <Text style={[styles.boldText, { color: theme.accentGold }]}>Puck Drop</Text> – Scheduled for <Text style={[styles.boldText, { color: theme.accentOrange }]}>{formatGameTimeDisplay(nextGame?.game_time)}</Text> vs {nextGame?.opponent || 'Opponent'}.
              </Text>
            </View>

            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🏒 Player Warm-Ups & Glass Access</Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>
                • <Text style={[styles.boldText, { color: theme.accentGold }]}>Barracuda Warm-Up Zone:</Text> Home players warm up between <Text style={[styles.boldText, { color: theme.accentOrange }]}>Sections 106 – 110</Text> for the best close-up views!
              </Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>
                • <Text style={[styles.boldText, { color: theme.accentGold }]}>Opponent Warm-Up Zone:</Text> Opponents warm up on the opposite end between <Text style={[styles.boldText, { color: theme.text }]}>Sections 102 – 114</Text>.
              </Text>
              <Text style={[styles.infoBody, { color: theme.subText }]}>
                • <Text style={[styles.boldText, { color: theme.accentGold }]}>Timing:</Text> The glass line crowds exactly 25 minutes prior to initial puck drop. Fans of all ages are welcome down at the glass during warm-ups.
              </Text>
            </View>

            {(nextGame?.theme_night || nextGame?.promo) && (
              <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.accentOrange }]}>
                <View style={styles.foHeaderRow}>
                  <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🎟️ Theme Night & Arena Giveaways</Text>
                  <View style={[styles.foBadge, { backgroundColor: theme.accentOrange }]}>
                    <Text style={styles.foBadgeText}>SAN JOSE BARRACUDA FRONT OFFICE</Text>
                  </View>
                </View>
                {nextGame.theme_night && (
                  <Text style={[styles.infoBody, { color: theme.text, marginTop: 4 }]}>
                    • <Text style={[styles.boldText, { color: theme.accentGold }]}>Theme:</Text> {nextGame.theme_night}
                  </Text>
                )}
                {nextGame.promo && (
                  <Text style={[styles.infoBody, { color: theme.text }]}>
                    • <Text style={[styles.boldText, { color: theme.accentGold }]}>Giveaway Promo:</Text> {nextGame.promo}
                  </Text>
                )}
                <Text style={[styles.disclaimerText, { color: theme.subText }]}>
                  * Note: All official arena giveaways, gate distributions, and theme night activations are organized independently by the San Jose Barracuda Front Office. Supplies are limited to designated ticket holders or while supplies last.
                </Text>
              </View>
            )}

            {matchedEvents.length > 0 && (
              <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🪸 SJ Battery Pack Gameday Events</Text>
                {matchedEvents.map((evt) => (
                  <View key={evt.id} style={[styles.matchedEventCard, { borderLeftColor: theme.accentOrange }]}>
                    <View style={styles.matchedEventTop}>
                      <Text style={[styles.matchedEventBadge, { color: theme.accentGold }]}>
                        {evt.icon} {evt.badge}
                      </Text>
                    </View>
                    <View style={styles.matchedEventTimeRow}>
                      <Text style={[styles.matchedEventTime, { color: theme.accentOrange }]}>
                        🕒 {evt.event_time}
                      </Text>
                    </View>
                    <Text style={[styles.matchedEventLoc, { color: theme.subText }]}>📍 {evt.location}</Text>
                    <Text style={[styles.matchedEventTitle, { color: theme.text }]}>{evt.title}</Text>
                    <Text style={[styles.matchedEventDesc, { color: theme.text }]}>{evt.description}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={[styles.infoBox, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🥁 SJ Battery Pack Operations & Traditions</Text>
              
              {tablingEvent ? (
                <Text style={[styles.infoBody, { color: theme.text }]}>
                  • <Text style={[styles.boldText, { color: theme.accentGold }]}>Booster Table Active:</Text> Stop by the SJ Battery Pack booster table {tablingEvent.location?.toLowerCase() || 'outside Section 108'} ({tablingEvent.event_time}) for free stickers, pins, and friendship bracelets!
                </Text>
              ) : null}

              <Text style={[styles.infoBody, { color: theme.text, marginTop: tablingEvent ? 4 : 0 }]}>
                • SJ Battery Pack Supporter chants begin as soon as the opening face off drops! Check out our chant book or suggest chants under Fan Zone!
              </Text>
            </View>
          </View>
        );
      }
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
              <Text style={[styles.infoTitle, { color: theme.accentGold }]}>🍻 The Cove (Section 108)</Text>
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['left', 'right']}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      
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
        <View style={[styles.welcomeBanner, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>SJ BATTERY PACK</Text>
          <Text style={[styles.bannerSubtitle, { color: theme.text }]}>The Loudest Supporter Group in the AHL 🪸</Text>
        </View>

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

        <View style={[styles.aboutCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionHeader, { color: theme.accentGold }]}>🦈 DEFEND THE REEF. GIVE BACK.</Text>
          <Text style={[styles.aboutText, { color: theme.subText }]}>
            Established in 2021, the SJ Battery Pack is the Official Supporter Group for the San Jose Barracuda. We are a fan-made, fan-run 501(c)(3) non-profit dedicated to turning Section 108 into the loudest "No Quiet Zone" in the AHL.
          </Text>
          <Text style={[styles.aboutText, { color: theme.subText, marginTop: 6 }]}>
            Over the last five years, we’ve raised thousands for local causes like the Asian American Cancer Society and Second Harvest Food Bank because we believe that The Future Is Teal. Whether you’re a Day 1 fin-atic or a newcomer to Cuda Country, you have a place in our family.
          </Text>
        </View>

        <NextMatchups key={`next-matchups-${refreshKey}`} />

        {React.createElement(LastEncounter, { key: `last-encounter-${refreshKey}` })}


        <Standings key={`standings-${refreshKey}`} />

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
            <Text style={[styles.gridButtonText, { color: theme.text }]} numberOfLines={1}>📸 Fan Gallery</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* REEF KNOW BEFORE YOU GO MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={infoModalVisible}
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            
            <View style={styles.modalTopHeaderBar}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalHeader, { color: theme.accentGold }]}>🏟️ REEF KNOW BEFORE YOU GO</Text>
                <Text style={[styles.modalSub, { color: theme.subText }]}>
                  {nextGame 
                    ? (nextGame.home_away === 'HOME'
                        ? `San Jose Barracuda vs ${nextGame.opponent}`
                        : `${nextGame.opponent} vs San Jose Barracuda`)
                    : 'Tech CU Arena Gameday Information'}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setInfoModalVisible(false)}
                style={styles.modalCloseIconBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.modalCloseIconText, { color: theme.accentGold }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
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

            {/* Scrollable Container with exact flex bounds */}
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <ScrollView 
                style={styles.modalScrollView} 
                contentContainerStyle={styles.modalScrollPadding}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                {renderTabContent()}
              </ScrollView>
            </View>

            <TouchableOpacity 
              style={[styles.closeModalButton, { backgroundColor: theme.subCardBg, borderTopColor: theme.borderColor }]}
              onPress={() => setInfoModalVisible(false)}
              activeOpacity={0.8}
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
  gridButtonText: { fontSize: 13, fontWeight: '900' },

  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 16,
  },
  modalContainer: { 
    width: '100%', 
    height: SCREEN_HEIGHT * 0.82, 
    borderRadius: 16, 
    borderWidth: 1.5, 
    overflow: 'hidden', 
    flexDirection: 'column',
  },
  
  modalTopHeaderBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    paddingBottom: 10 
  },
  modalHeader: { fontSize: 15, fontWeight: '900', textAlign: 'left', letterSpacing: 0.5 },
  modalSub: { fontSize: 11, textAlign: 'left', fontWeight: '700', marginTop: 2 },
  modalCloseIconBtn: { padding: 4 },
  modalCloseIconText: { fontSize: 20, fontWeight: '900' },
  
  tabBarRow: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    paddingHorizontal: 12, 
    paddingBottom: 8,
    paddingTop: 2,
  },
  tabItemButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, marginRight: 8, borderWidth: 1 },
  tabItemText: { fontSize: 11, fontWeight: '700' },

  modalScrollView: { 
    flex: 1, 
  },
  modalScrollPadding: { 
    padding: 16, 
    paddingBottom: 24, 
  },
  
  infoBox: { padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1 },
  infoTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  infoBody: { fontSize: 12, lineHeight: 18, fontWeight: '500', marginBottom: 4 },
  boldText: { fontWeight: 'bold' },

  foHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  foBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  foBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  disclaimerText: { fontSize: 11, fontStyle: 'italic', marginTop: 6, lineHeight: 15 },

  matchedEventCard: { borderLeftWidth: 3, paddingLeft: 10, marginVertical: 6 },
  matchedEventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchedEventBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  matchedEventTimeRow: { marginTop: 2, marginBottom: 2 },
  matchedEventTime: { fontSize: 12, fontWeight: '800' },
  matchedEventTitle: { fontSize: 15, fontWeight: '900', marginTop: 2, marginBottom: 4 },
  matchedEventLoc: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  matchedEventDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },

  actionLinkButton: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 4, marginBottom: 10 },
  actionLinkText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  
  closeModalButton: { 
    paddingVertical: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  closeModalButtonText: { fontSize: 14, fontWeight: '900' }
});