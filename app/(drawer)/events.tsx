import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  Alert
} from 'react-native';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

export interface SupporterEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  badge: string;
  icon?: string;
  description: string;
  schedule?: { time: string; detail: string }[];
  faqs?: { q: string; a: string }[];
}

const CATEGORIES = ['All', 'Road Trips', 'Watch Parties', 'Group Photos', 'Community & Tabling'] as const;

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr || dateStr.includes('TBA') || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const d = new Date(year, month, day);
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function EventsScreen() {
  const { theme } = useAppTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<SupporterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Road Trip Intake Form State (Default partySize to empty string)
  const [formVisible, setFormVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoadTrip, setSelectedRoadTrip] = useState<SupporterEvent | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', partySize: '', hotelInterest: false });

  const safeParseJSON = (data: any) => {
    if (!data) return undefined;
    if (typeof data === 'object') return data;
    try {
      return JSON.parse(data);
    } catch {
      return undefined;
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('supporter_events')
        .select('*')
        .order('event_date', { ascending: true });

      if (error) {
        console.warn('Supabase supporter_events error:', error.message);
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        const mapped: SupporterEvent[] = data.map((item: any) => ({
          id: String(item.id),
          title: item.title || 'Supporter Event',
          category: item.category || 'Community & Tabling',
          badge: item.badge || 'EVENT',
          icon: item.icon || '🏒',
          date: item.event_date || item.date || 'Date TBA',
          time: item.event_time || item.time || 'Time TBA',
          location: item.location || 'Tech CU Arena',
          description: item.description || '',
          schedule: safeParseJSON(item.schedule),
          faqs: safeParseJSON(item.faqs),
        }));
        setEvents(mapped);
      }
    } catch (err) {
      console.warn('Supporter events query error:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Filter matching that handles singular/plural variants seamlessly
  const filteredEvents = events.filter((item) => {
    if (selectedCategory === 'All') return true;

    const cat = item.category?.trim().toLowerCase();

    if (selectedCategory === 'Road Trips') {
      return cat === 'road trips' || cat === 'road trip';
    }
    if (selectedCategory === 'Watch Parties') {
      return cat === 'watch party' || cat === 'watch parties';
    }
    if (selectedCategory === 'Group Photos') {
      return cat === 'group photos' || cat === 'group photo' || cat === 'intermission group photos' || cat === 'on ice group photo';
    }
    if (selectedCategory === 'Community & Tabling') {
      return cat === 'community & tabling' || cat === 'tabling' || cat === 'trade night';
    }

    return cat === selectedCategory.toLowerCase();
  });

  const toggleExpand = (id: string) => {
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  const openIntakeForm = (event: SupporterEvent) => {
    setSelectedRoadTrip(event);
    setFormData({ name: '', email: '', partySize: '', hotelInterest: false });
    setFormVisible(true);
  };

  const submitIntakeForm = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.partySize.trim()) {
      Alert.alert('Missing Fields', 'Please fill out your name, email, and party size.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('road_trip_interest').insert([{
        event_id: selectedRoadTrip?.id,
        event_name: selectedRoadTrip?.title,
        fan_name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        party_size: parseInt(formData.partySize, 10) || 1,
        hotel_interest: formData.hotelInterest
      }]);

      if (error) throw error;
      
      Alert.alert('Success!', 'Your interest has been logged. We will email you ticket & hotel details soon!');
      setFormVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not submit your form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      {/* Filter Tabs */}
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

      {/* Event List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accentGold} />
        </View>
      ) : (
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
          <View style={[styles.bannerCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>📅 2026-27 SUPPORTER CALENDAR</Text>
            <Text style={[styles.bannerSub, { color: theme.subText }]}>
              Road trips, watch parties, on-ice group photos, and concourse meetups.
            </Text>
          </View>

          {filteredEvents.length === 0 ? (
            <View style={[styles.emptyStateCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.emptyStateText, { color: theme.subText }]}>
                No events currently scheduled under this category.
              </Text>
            </View>
          ) : (
            filteredEvents.map((item) => {
              const isExpanded = expandedEventId === item.id;
              const isRoadTrip = item.category?.toLowerCase().includes('road trip');

              return (
                <View
                  key={item.id}
                  style={[styles.eventCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.badge, { backgroundColor: theme.accentOrange }]}>
                      <Text style={styles.badgeText}>{item.icon ? `${item.icon} ` : ''}{item.badge}</Text>
                    </View>
                    <Text style={[styles.eventDate, { color: theme.accentGold }]}>{formatDateDisplay(item.date)}</Text>
                  </View>

                  <Text style={[styles.eventTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.eventMeta, { color: theme.subText }]}>📍 {item.location}</Text>
                  <Text style={[styles.eventMeta, { color: theme.accentGold, marginBottom: 8 }]}>⏰ {item.time}</Text>
                  <Text style={[styles.eventDesc, { color: theme.text }]}>{item.description}</Text>

                  {isRoadTrip && (
                    <TouchableOpacity
                      style={[styles.intakeBtn, { backgroundColor: theme.accentOrange }]}
                      onPress={() => openIntakeForm(item)}
                    >
                      <Text style={styles.intakeBtnText}>🚌 Group Tickets & Hotel Interest</Text>
                    </TouchableOpacity>
                  )}

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
            })
          )}
        </ScrollView>
      )}

      {/* Road Trip Intake Modal */}
      <Modal visible={formVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            <Text style={[styles.modalTitle, { color: theme.accentGold }]}>Join the Invasion!</Text>
            <Text style={[styles.modalSub, { color: theme.text }]}>{selectedRoadTrip?.title}</Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="Full Name"
              placeholderTextColor={theme.subText}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="Email Address"
              placeholderTextColor={theme.subText}
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
            />

            {/* Blank default allows placeholder to clearly instruct the user */}
            <TextInput
              style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="Party Size (Number of Tickets)"
              placeholderTextColor={theme.subText}
              keyboardType="numeric"
              value={formData.partySize}
              onChangeText={(text) => setFormData({ ...formData, partySize: text })}
            />

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>Interested in Group Hotel Discounts?</Text>
              <Switch
                value={formData.hotelInterest}
                onValueChange={(val) => setFormData({ ...formData, hotelInterest: val })}
                trackColor={{ false: theme.borderColor, true: theme.accentGold }}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: theme.borderColor }]} onPress={() => setFormVisible(false)}>
                <Text style={[styles.modalCancelText, { color: theme.subText }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: theme.accentGold }]} onPress={submitIntakeForm} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#001417" /> : <Text style={styles.modalSubmitText}>Submit Interest</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: { borderBottomWidth: 1 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: '700' },
  contentPadding: { padding: 16, paddingBottom: 40 },
  bannerCard: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 14, alignItems: 'center' },
  bannerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  bannerSub: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  emptyStateCard: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  emptyStateText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
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
  scheduleTime: { width: 130, fontSize: 12, fontWeight: '800' },
  scheduleDetail: { flex: 1, fontSize: 12, fontWeight: '600' },
  faqBlock: { marginBottom: 8 },
  faqQ: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  faqA: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  expandBtn: { paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', marginTop: 6 },
  expandBtnText: { fontSize: 12, fontWeight: '800' },
  intakeBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 4 },
  intakeBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 20 },
  modalContainer: { padding: 20, borderRadius: 16, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
  modalSub: { fontSize: 13, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12, fontSize: 14, fontWeight: '500' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '800' },
  modalSubmitBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalSubmitText: { color: '#001417', fontSize: 14, fontWeight: '900' }
});