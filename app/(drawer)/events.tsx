import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StatusBar,
} from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';

export interface SupporterEvent {
  id: string;
  title: string;
  category: 'Road Trips' | 'Watch Parties' | 'Group Photos' | 'Community & Tabling';
  date: string;
  time: string;
  location: string;
  badge: string;
  description: string;
  schedule?: { time: string; detail: string }[];
  faqs?: { q: string; a: string }[];
}

const CATEGORIES = ['All', 'Road Trips', 'Watch Parties', 'Group Photos', 'Community & Tabling'] as const;

const SUPPORTER_EVENTS: SupporterEvent[] = [
  // 🌈 1. COMMUNITY: SILICON VALLEY PRIDE PARADE
  {
    id: 'pride-2026',
    title: 'Silicon Valley Pride Parade 2026',
    category: 'Community & Tabling',
    badge: 'PRIDE MARCH',
    date: 'Sunday, August 30, 2026',
    time: '11:00 AM – 12:30 PM (Step-Off)',
    location: 'Downtown San Jose (Julian & Market St ➔ Plaza Park)',
    description: 'March alongside the SJ Battery Pack, Sharks & Barracuda players, and local hockey fans through the heart of Downtown San Jose to celebrate LGBTQ+ visibility and over 50 years of progress!',
    schedule: [
      { time: '10:15 AM', detail: 'Supporter staging & banner assembly at Julian St & Market St' },
      { time: '11:00 AM', detail: 'Official Parade Step-Off & March' },
      { time: '12:30 PM', detail: 'Arrival at Plaza Park celebration, festival & live entertainment' },
    ],
    faqs: [
      { q: 'Who can march with the Battery Pack?', a: 'Open to all individuals, members, friends, family, and allies who wish to celebrate and support equality.' },
      { q: 'What should I wear?', a: 'Wear your favorite Battery Pack teal, orange, pride supporter shirts, or hockey jerseys!' },
      { q: 'Is registration required?', a: 'Free to march with our group! Connect in the #watch-parties / community chat for staging updates.' },
    ],
  },

  // 🚌 2. ROAD TRIPS (AWAY INVASIONS)
  {
    id: 'road-gulls-2026',
    title: 'Road Invasion: Barracuda at San Diego Gulls',
    category: 'Road Trips',
    badge: 'AWAY TRIP',
    date: 'Saturday, October 24, 2026',
    time: '7:00 PM Puck Drop',
    location: 'Pechanga Arena • San Diego, CA',
    description: 'Our first major away invasion of the season! Join the traveling Battery Pack contingent down south to take over Pechanga Arena against the Gulls.',
    schedule: [
      { time: '4:30 PM', detail: 'Pre-game supporter tailgate & meetup outside arena' },
      { time: '6:00 PM', detail: 'Doors open & march into Section 108 away booster block' },
      { time: '7:00 PM', detail: 'Puck drop: Barracuda vs. Gulls' },
    ],
    faqs: [
      { q: 'How do I sit with the Battery Pack away section?', a: 'Group discount away block links are shared directly in the Merch & Tickets chat room.' },
    ],
  },
  {
    id: 'road-bako-2026',
    title: 'Road Trip: Barracuda at Bakersfield Condors',
    category: 'Road Trips',
    badge: 'AWAY TRIP',
    date: 'Saturday, December 19, 2026',
    time: '7:00 PM Puck Drop',
    location: 'Mechanics Bank Arena • Bakersfield, CA',
    description: 'Holiday road battle! Pack the cars and travel down Highway 99 to rally the Cuda against the division rival Condors.',
    schedule: [
      { time: '5:00 PM', detail: 'Pre-game dinner and rally meetup' },
      { time: '6:15 PM', detail: 'Arena entry & drum setup' },
      { time: '7:00 PM', detail: 'Puck drop: Barracuda vs. Condors' },
    ],
  },
  {
    id: 'road-reign-2027',
    title: 'Road Trip: Barracuda at Ontario Reign',
    category: 'Road Trips',
    badge: 'AWAY TRIP',
    date: 'Saturday, January 30, 2027',
    time: '6:00 PM Puck Drop',
    location: 'Toyota Arena • Ontario, CA',
    description: 'Southern California invasion part 2! Bringing northern California noise to the Inland Empire against the Kings AHL affiliate.',
    schedule: [
      { time: '4:00 PM', detail: 'SoCal supporter meetup' },
      { time: '5:15 PM', detail: 'Toyota Arena entry' },
      { time: '6:00 PM', detail: 'Puck drop: Barracuda vs. Reign' },
    ],
  },
  {
    id: 'road-henderson-2027',
    title: 'Vegas Weekend: Barracuda at Henderson Silver Knights',
    category: 'Road Trips',
    badge: 'WEEKEND INVASION',
    date: 'Saturday, February 13, 2027',
    time: '7:00 PM Puck Drop',
    location: 'The Dollar Loan Center (Lee\'s Family Forum) • Henderson, NV',
    description: 'Our annual Nevada road weekend! Catch the Cuda taking on the Silver Knights, followed by member group dinners and Vegas weekend activities.',
    schedule: [
      { time: '4:30 PM', detail: 'Pre-game Henderson meetup & drinks' },
      { time: '6:00 PM', detail: 'Arena march-in' },
      { time: '7:00 PM', detail: 'Puck drop: Barracuda vs. Henderson' },
    ],
  },

  // 📸 3. ON-ICE & GROUP PHOTOS
  {
    id: 'photo-oct-2026',
    title: 'Opening Month On-Ice Group Photo',
    category: 'Group Photos',
    badge: 'POST-GAME ON ICE',
    date: 'October 2026 (Date TBA)',
    time: 'Immediately Following Final Horn',
    location: 'Tech CU Arena Rink',
    description: 'Step onto the ice with fellow Battery Pack boosters for our official season kickoff group photo!',
    schedule: [
      { time: '3rd Period 5:00 min', detail: 'Meet group photo coordinator at top of Section 108' },
      { time: 'Post-Game', detail: 'Escorted down tunnel to Tech CU Arena ice surface' },
    ],
    faqs: [
      { q: 'Are special shoes required?', a: 'Flat-soled sneakers or closed-toe athletic shoes only (no heels/ice skates).' },
      { q: 'Can children participate?', a: 'Yes! All Section 108 members and family in attendance are welcome.' },
    ],
  },
  {
    id: 'photo-dec-2026',
    title: 'Holiday Season On-Ice Photo',
    category: 'Group Photos',
    badge: 'POST-GAME ON ICE',
    date: 'December 2026 (Date TBA)',
    time: 'Post-Game',
    location: 'Tech CU Arena Rink',
    description: 'Celebrate the holidays on the ice with the Battery Pack! Bring your ugly sweaters and festive scarves.',
  },
  {
    id: 'photo-feb-2027',
    title: 'Mid-Season Banner On-Ice Photo',
    category: 'Group Photos',
    badge: 'POST-GAME ON ICE',
    date: 'Tuesday, February 16, 2027',
    time: 'Post-Game',
    location: 'Tech CU Arena Rink',
    description: 'Join the pack on the ice surface for our mid-season supporter banner and scarf showcase photo.',
  },
  {
    id: 'photo-apr-2027',
    title: 'Fan Appreciation & Playoff Push Photo',
    category: 'Group Photos',
    badge: 'POST-GAME ON ICE',
    date: 'April 2027 (Date TBA)',
    time: 'Post-Game',
    location: 'Tech CU Arena Rink',
    description: 'Our final regular season group photo on the ice to commemorate the 2026-27 campaign and gear up for the Calder Cup Playoffs.',
  },

  // 🍻 4. AWAY GAME WATCH PARTIES
  {
    id: 'watch-oct-2026',
    title: 'Season Opener Away Watch Party',
    category: 'Watch Parties',
    badge: 'WATCH PARTY',
    date: 'Friday, October 23, 2026',
    time: '6:30 PM Pre-Show • 7:00 PM Puck Drop',
    location: 'Local Partner Bar (Downtown SJ / Willow Glen TBA)',
    description: 'Cheer on the Barracuda with sound-on broadcast, raffle prizes, and Section 108 chant energy while the team is on the road!',
  },
  {
    id: 'watch-nov-2026',
    title: 'November Away Watch Party',
    category: 'Watch Parties',
    badge: 'WATCH PARTY',
    date: 'Saturday, November 21, 2026',
    time: 'Puck Drop TBA',
    location: 'Local Partner Bar TBA',
    description: 'Gather with fellow boosters for a Saturday night road broadcast watch party.',
  },
  {
    id: 'watch-dec-2026',
    title: 'December Road Watch Party',
    category: 'Watch Parties',
    badge: 'WATCH PARTY',
    date: 'Saturday, December 12, 2026',
    time: 'Puck Drop TBA',
    location: 'Local Partner Bar TBA',
    description: 'Holiday road watch party with member food & beverage specials.',
  },
  {
    id: 'watch-jan-2027',
    title: 'New Year Away Watch Party',
    category: 'Watch Parties',
    badge: 'WATCH PARTY',
    date: 'Saturday, January 9, 2027',
    time: 'Puck Drop TBA',
    location: 'Local Partner Bar TBA',
    description: 'Kick off the new calendar year rallying the Cuda from home.',
  },
  {
    id: 'watch-feb-2027',
    title: 'February Road Watch Party',
    category: 'Watch Parties',
    badge: 'WATCH PARTY',
    date: 'Saturday, February 20, 2027',
    time: 'Puck Drop TBA',
    location: 'Local Partner Bar TBA',
    description: 'Mid-season divisional clash watch party with fellow Section 108 fans.',
  },
  {
    id: 'watch-mar-2027',
    title: 'March Road Watch Party',
    category: 'Watch Parties',
    badge: 'WATCH PARTY',
    date: 'Saturday, March 6, 2027',
    time: 'Puck Drop TBA',
    location: 'Local Partner Bar TBA',
    description: 'Spring stretch run watch party as the Barracuda battle for postseason seeding.',
  },
  {
    id: 'watch-apr-2027',
    title: 'Final Regular Season Watch Party',
    category: 'Watch Parties',
    badge: 'WATCH PARTY',
    date: 'Sunday, April 4, 2027',
    time: 'Puck Drop TBA',
    location: 'Local Partner Bar TBA',
    description: 'Season finale road watch party before playoff hockey arrives!',
  },

  // ⛺ 5. CONCOURSE TABLING & BOOSTER EVENTS
  {
    id: 'table-nov-2026',
    title: 'Section 108 Concourse Info & Merch Tabling',
    category: 'Community & Tabling',
    badge: 'CONCOURSE TABLING',
    date: 'Sunday, November 1, 2026',
    time: 'Doors Open to End of 2nd Intermission',
    location: 'Tech CU Arena Concourse (Near Section 108)',
    description: 'Visit the official Battery Pack table to pick up membership stickers, learn game chants, sign up for away trips, and meet club leadership!',
  },
  {
    id: 'table-jan-2027',
    title: 'Winter Concourse Booster Tabling',
    category: 'Community & Tabling',
    badge: 'CONCOURSE TABLING',
    date: 'Saturday, January 23, 2027',
    time: 'Doors Open to End of 2nd Intermission',
    location: 'Tech CU Arena Concourse (Near Section 108)',
    description: 'Stop by our concourse table to check in, claim passport stamp information, and get info on upcoming away road trips.',
  },
  {
    id: 'table-mar-2027',
    title: 'Playoff Push Concourse Tabling',
    category: 'Community & Tabling',
    badge: 'CONCOURSE TABLING',
    date: 'Sunday, March 21, 2027',
    time: 'Doors Open to End of 2nd Intermission',
    location: 'Tech CU Arena Concourse (Near Section 108)',
    description: 'Gear up for the postseason with the Battery Pack! Tabling on the concourse with booster swag, songbooks, and rally signs.',
  },
];

export default function EventsScreen() {
  const { theme } = useAppTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const filteredEvents = selectedCategory === 'All'
    ? SUPPORTER_EVENTS
    : SUPPORTER_EVENTS.filter((e) => e.category === selectedCategory);

  const toggleExpand = (id: string) => {
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* Category Filter Pills */}
      <View style={[styles.filterBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 10 }}
          renderItem={({ item }) => {
            const isActive = item === selectedCategory;
            return (
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                  isActive && { backgroundColor: theme.accentGold, borderColor: theme.accentGold },
                ]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: theme.text },
                    isActive && { color: '#001417', fontWeight: '900' },
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Events Feed */}
      <ScrollView contentContainerStyle={styles.contentPadding}>
        <View style={[styles.bannerCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>📅 2026-27 SUPPORTER CALENDAR</Text>
          <Text style={[styles.bannerSub, { color: theme.subText }]}>
            Road trips, watch parties, on-ice group photos, and concourse meetups.
          </Text>
        </View>

        {filteredEvents.map((item) => {
          const isExpanded = expandedEventId === item.id;

          return (
            <View
              key={item.id}
              style={[styles.eventCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              {/* Category Badge & Date */}
              <View style={styles.cardTopRow}>
                <View style={[styles.badge, { backgroundColor: theme.accentOrange }]}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
                <Text style={[styles.eventDate, { color: theme.accentGold }]}>{item.date}</Text>
              </View>

              <Text style={[styles.eventTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.eventMeta, { color: theme.subText }]}>📍 {item.location}</Text>
              <Text style={[styles.eventMeta, { color: theme.accentGold, marginBottom: 8 }]}>⏰ {item.time}</Text>
              <Text style={[styles.eventDesc, { color: theme.text }]}>{item.description}</Text>

              {/* Expandable Itinerary & FAQs */}
              {isExpanded && (
                <View style={[styles.expandedSection, { borderTopColor: theme.borderColor }]}>
                  {item.schedule && item.schedule.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={[styles.sectionHeading, { color: theme.accentGold }]}>🕒 Schedule & Key Times:</Text>
                      {item.schedule.map((s, idx) => (
                        <View key={idx} style={styles.scheduleRow}>
                          <Text style={[styles.scheduleTime, { color: theme.accentOrange }]}>{s.time}</Text>
                          <Text style={[styles.scheduleDetail, { color: theme.text }]}>{s.detail}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {item.faqs && item.faqs.length > 0 && (
                    <View>
                      <Text style={[styles.sectionHeading, { color: theme.accentGold }]}>❓ Event FAQs:</Text>
                      {item.faqs.map((faq, idx) => (
                        <View key={idx} style={styles.faqBlock}>
                          <Text style={[styles.faqQ, { color: theme.text }]}>Q: {faq.q}</Text>
                          <Text style={[styles.faqA, { color: theme.subText }]}>A: {faq.a}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Expand Button */}
              <TouchableOpacity
                style={[styles.expandBtn, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}
                onPress={() => toggleExpand(item.id)}
              >
                <Text style={[styles.expandBtnText, { color: theme.accentGold }]}>
                  {isExpanded ? 'Hide Details ▲' : 'View Schedule & FAQs ▼'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: { borderBottomWidth: 1 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: '700' },
  contentPadding: { padding: 16, paddingBottom: 40 },
  bannerCard: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 14, alignItems: 'center' },
  bannerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  bannerSub: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  eventCard: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  eventDate: { fontSize: 12, fontWeight: '800' },
  eventTitle: { fontSize: 17, fontWeight: '900', marginBottom: 4 },
  eventMeta: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  eventDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  expandedSection: { borderTopWidth: 1, paddingTop: 12, marginTop: 6 },
  sectionHeading: { fontSize: 13, fontWeight: '900', marginBottom: 6 },
  scheduleRow: { flexDirection: 'row', marginBottom: 4 },
  scheduleTime: { width: 100, fontSize: 12, fontWeight: '800' },
  scheduleDetail: { flex: 1, fontSize: 12, fontWeight: '600' },
  faqBlock: { marginBottom: 8 },
  faqQ: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  faqA: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  expandBtn: { paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', marginTop: 6 },
  expandBtnText: { fontSize: 12, fontWeight: '800' },
});