import React, { useState, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  ImageBackground,
  Image, 
  Alert,
  useWindowDimensions,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';
import { useRouter, useFocusEffect } from 'expo-router';

// 📚 STAMP ASSETS DICTIONARY
const STAMP_IMAGES: Record<string, any> = {
  cudawin1: require('../../assets/images/stamps/cudawin1.png'),
  frenzyhead: require('../../assets/images/stamps/frenzyhead.png'),
};

export default function PassportScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions(); 
  
  const scrollViewRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [stamps, setStamps] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const fetchStamps = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data, error } = await supabase
            .from('passport_stamps')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

          if (data && !error) setStamps(data);
        } else {
          setStamps([]);
        }
        setLoading(false);
      };
      fetchStamps();
    }, [])
  );

  const TOTAL_TRACKER_PAGES = 9;
  const STAMPS_PER_PAGE = 4;
  const trackerPages = [];

  for (let i = 0; i < TOTAL_TRACKER_PAGES; i++) {
    const pageStamps = stamps.slice(i * STAMPS_PER_PAGE, (i + 1) * STAMPS_PER_PAGE);
    trackerPages.push(pageStamps);
  }

  const goToPage = (pageIndex: number) => {
    setCurrentPage(pageIndex);
    scrollViewRef.current?.scrollTo({ x: pageIndex * width, animated: true });
  };

  const handleScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slide !== currentPage) {
      setCurrentPage(slide);
    }
  };

  const handleScanPress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      Alert.alert(
        'Sign In Required 🦈',
        'You need a Battery Pack account to collect and save digital passport stamps!',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Sign In / Sign Up', 
            onPress: () => router.push('/(auth)/login') 
          }
        ]
      );
      return;
    }

    router.push('/scanner');
  };

  const navLabels = ['Cover', 'Rules', 'Pg 3', 'Pg 4', 'Pg 5', 'Pg 6', 'Pg 7', 'Pg 8', 'Pg 9', 'Pg 10', 'Pg 11', 'Back'];

  const renderPageBadge = (pageNum: number) => (
    <View style={styles.pageBadge}>
      <Text style={styles.pageBadgeText}>{pageNum} / 12</Text>
    </View>
  );

  const pageStyle = { width, flex: 1, justifyContent: 'center' as const };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#001E22" />

      {/* 🧭 Tight, Flush Top Navigation Bar */}
      <View style={styles.navMenuContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
          {navLabels.map((label, index) => {
            const isActive = currentPage === index;
            return (
              <TouchableOpacity 
                key={index} 
                style={[styles.navButton, isActive && styles.navButtonActive]} 
                onPress={() => goToPage(index)}
              >
                <Text style={[styles.navButtonText, isActive && styles.navButtonTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFB800" />
          <Text style={styles.loadingText}>Opening Passport...</Text>
        </View>
      ) : (
        <View style={styles.bookWrapper}>
          <ScrollView 
            ref={scrollViewRef}
            horizontal={true} 
            pagingEnabled={true} 
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            bounces={false}
            style={styles.bookScrollView}
          >
            {/* Page 1: Cover */}
            <ImageBackground source={require('../../assets/images/cover.png')} style={pageStyle} resizeMode="contain">
              {renderPageBadge(1)}
            </ImageBackground>

            {/* Page 2: Rules */}
            <ImageBackground source={require('../../assets/images/welcome.png')} style={pageStyle} resizeMode="contain">
              {renderPageBadge(2)}
            </ImageBackground>

            {/* Pages 3 to 11: 4-Slot Win Tracker Pages */}
            {trackerPages.map((pageOfStamps, pageIndex) => (
              <ImageBackground 
                key={`page-${pageIndex}`}
                source={require('../../assets/images/wintracker.png')} 
                style={pageStyle} 
                resizeMode="contain"
              >
                {renderPageBadge(pageIndex + 3)}
                
                <View style={styles.trackerContainer}>
                  <View style={styles.grid2x2}>
                    {[0, 1, 2, 3].map((slotIndex) => {
                      const stamp = pageOfStamps[slotIndex];
                      return (
                        <View key={slotIndex} style={styles.stampBoxSlot}>
                          {stamp ? (
                            <View style={styles.stampWrapper}>
                              <Image 
                                source={STAMP_IMAGES[stamp.stamp_type] || STAMP_IMAGES['cudawin1']} 
                                style={styles.stampGraphic}
                                resizeMode="contain"
                              />
                              <View style={styles.gameInfoBadge}>
                                <Text style={styles.badgeGameText} numberOfLines={1}>
                                  {stamp.game_name || 'WIN'}
                                </Text>
                                <Text style={styles.badgeOpponentText} numberOfLines={1}>
                                  vs {stamp.opponent || 'Opponent'}
                                </Text>
                                <Text style={styles.badgeScoreText}>
                                  {stamp.score} • {stamp.game_date}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <View style={styles.emptySlotPlaceholder} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ImageBackground>
            ))}

            {/* Page 12: Back Cover */}
            <ImageBackground source={require('../../assets/images/backcover.png')} style={pageStyle} resizeMode="contain">
              {renderPageBadge(12)}
            </ImageBackground>

          </ScrollView>

          {/* Floating Scan Button */}
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity style={styles.scanButton} onPress={handleScanPress}>
              <Text style={styles.scanButtonIcon}>📷</Text>
              <Text style={styles.scanButtonText}>SCAN WIN STAMP</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#001417' 
  }, 
  navMenuContainer: { 
    height: 38, 
    backgroundColor: '#001E22', 
    borderBottomWidth: 1, 
    borderColor: 'rgba(255, 184, 0, 0.25)', 
    justifyContent: 'center',
    paddingVertical: 2
  },
  navScroll: { 
    paddingHorizontal: 8, 
    alignItems: 'center' 
  },
  navButton: { 
    backgroundColor: '#002F35', 
    paddingVertical: 4, 
    paddingHorizontal: 11, 
    borderRadius: 14, 
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.2)'
  },
  navButtonActive: {
    backgroundColor: '#FFB800',
    borderColor: '#FFB800'
  },
  navButtonText: { 
    color: '#80B3B8', 
    fontWeight: '800', 
    fontSize: 11 
  },
  navButtonTextActive: {
    color: '#001417',
    fontWeight: '900'
  },
  pageBadge: { 
    position: 'absolute', 
    top: 6, 
    right: 18, 
    backgroundColor: 'rgba(0, 30, 34, 0.92)', 
    paddingVertical: 3, 
    paddingHorizontal: 8, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#FFB800', 
    zIndex: 10 
  },
  pageBadgeText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 10 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    color: '#FFB800', 
    marginTop: 10, 
    fontWeight: 'bold' 
  },
  bookWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bookScrollView: {
    flex: 1,
  },
  trackerContainer: { 
    flex: 1, 
    justifyContent: 'flex-start',
    alignItems: 'center', 
    paddingTop: '20%', 
    paddingBottom: '6%' 
  },
  grid2x2: { 
    width: '84%', 
    height: '74%', 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    alignContent: 'space-between' 
  },
  stampBoxSlot: { 
    width: '47%', 
    height: '47%', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  emptySlotPlaceholder: { 
    width: '100%', 
    height: '100%' 
  },
  stampWrapper: { 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  stampGraphic: { 
    width: 65, 
    height: 65, 
    transform: [{ rotate: '-6deg' }] 
  },
  gameInfoBadge: { 
    marginTop: 2, 
    backgroundColor: 'rgba(0, 30, 34, 0.95)', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#FFB800', 
    alignItems: 'center', 
    width: '92%' 
  },
  badgeGameText: { color: '#FFB800', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  badgeOpponentText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  badgeScoreText: { color: '#80B3B8', fontSize: 7, fontWeight: '600' },
  actionButtonContainer: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#001417',
  },
  scanButton: { 
    backgroundColor: '#DD8943', 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: 11, 
    paddingHorizontal: 24, 
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 4, 
    elevation: 6 
  },
  scanButtonIcon: { fontSize: 16, marginRight: 8 },
  scanButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }
});