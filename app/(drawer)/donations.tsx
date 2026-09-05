import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabase';

// REPLACE THIS with your actual Stripe Payment Link
const STRIPE_DONATION_LINK = 'https://buy.stripe.com/fZu3cxaYYbCw1lE0SvfrW00';

export default function DonationsScreen() {
  const { theme } = useAppTheme();

  // Volunteer Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [causes, setCauses] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDonate = async () => {
    await WebBrowser.openBrowserAsync(STRIPE_DONATION_LINK);
  };

  const handleSubmitVolunteer = async () => {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert('Missing Fields', 'Please provide at least your full name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('community_volunteers').insert([
        {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          causes_interested: causes.trim() || null,
        },
      ]);

      if (error) throw error;

      Alert.alert(
        'Thank You! 🪸',
        'Your interest has been received! We will reach out when new community service initiatives, clean-ups, and drives are scheduled.'
      );

      // Reset Form & Close
      setFullName('');
      setEmail('');
      setPhone('');
      setCauses('');
      setModalVisible(false);
    } catch (err: any) {
      console.warn('Volunteer submit error:', err);
      Alert.alert('Submission Error', err.message || 'Could not save your information. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner Section */}
        <View style={[styles.bannerCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>THE PACK GIVES BACK</Text>
          <Text style={[styles.bannerSub, { color: theme.text }]}>
            Support SJ Battery Pack – a 501(c)(3) non-profit organization run by dedicated San Jose Barracuda fans!
          </Text>
        </View>

        {/* Primary Donation Ask */}
        <View style={[styles.contentCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>Amplify The Gameday Experience</Text>
          <Text style={[styles.bodyText, { color: theme.text }]}>
            100% of donations made directly to the SJ Battery Pack are used to elevate our collective game day experience. Your contributions fund Theme Night Flags, concourse decorations, Win Pins, Friendship Bracelets, away watch parties, and special supporter initiatives.
          </Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 10, marginBottom: 14 }]}>
            Join us in making every game more meaningful! Check out securely using Apple Pay, Google Pay, or a major credit card.
          </Text>

          <TouchableOpacity
            style={[styles.donateButton, { backgroundColor: theme.accentOrange }]}
            onPress={handleDonate}
            activeOpacity={0.85}
          >
            <Text style={styles.donateButtonText}>💳 Donate to the SJ Battery Pack</Text>
          </TouchableOpacity>
        </View>

        {/* Impact In Action */}
        <View style={[styles.contentCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold, marginBottom: 12 }]}>Our Impact in Action</Text>
          <Text style={[styles.bodyText, { color: theme.subText, marginBottom: 16 }]}>
            More than just a hockey supporters' club, the SJ Battery Pack is a community force. Through targeted initiatives, volunteer efforts, and fan-driven fundraising, we are proving that Teal Bites Back in the most positive ways.
          </Text>

          <View style={[styles.initiativeBlock, { borderLeftColor: theme.accentOrange }]}>
            <Text style={[styles.initiativeTitle, { color: theme.text }]}>🏒 Pink in the Rink for a Cause</Text>
            <Text style={[styles.bodyText, { color: theme.subText }]}>
              For a special 'Pink in the Rink' game, we designed and heat-pressed limited-edition t-shirts. Thanks to our amazing fans, we raised nearly $300, donated directly to the Asian American Cancer Society.
            </Text>
          </View>

          <View style={[styles.initiativeBlock, { borderLeftColor: theme.accentOrange }]}>
            <Text style={[styles.initiativeTitle, { color: theme.text }]}>🦃 Second Harvest Food Bank Drive</Text>
            <Text style={[styles.bodyText, { color: theme.subText }]}>
              During the season of giving, we rallied the Teal Family to fight hunger. Through donations, we provided the equivalent of 250 meals for families in need. From Nov 1st to Dec 15th, we're aiming to smash that goal!
            </Text>
          </View>

          <View style={[styles.initiativeBlock, { borderLeftColor: theme.accentOrange }]}>
            <Text style={[styles.initiativeTitle, { color: theme.text }]}>🧔 Movember: Men's Health</Text>
            <Text style={[styles.bodyText, { color: theme.subText }]}>
              We joined the global Movember movement to raise critical funds for men's health, focusing on prostate/testicular cancer and mental health through fundraising and fitness challenges.
            </Text>
          </View>

          <View style={[styles.initiativeBlock, { borderLeftColor: theme.accentOrange }]}>
            <Text style={[styles.initiativeTitle, { color: theme.text }]}>🌈 Unity in Pride</Text>
            <Text style={[styles.bodyText, { color: theme.subText }]}>
              In a powerful display of cross-sport solidarity, we teamed up with supporters from the Earthquakes, Bay FC, Sharks, and Barracuda to raise over $5,000 for the Billy DeFrank LGBTQ+ Community Center.
            </Text>
          </View>

          <View style={[styles.initiativeBlock, { borderLeftColor: theme.accentOrange }]}>
            <Text style={[styles.initiativeTitle, { color: theme.text }]}>❤️ Street Level Support</Text>
            <Text style={[styles.bodyText, { color: theme.subText }]}>
              Partnering with the Earthquakes' Fault Liners, we assembled hundreds of food and sanitation kits in the arena parking lot, distributing them directly to those in need at St. James Park.
            </Text>
          </View>

          <View style={[styles.initiativeBlock, { borderLeftColor: theme.accentOrange, marginBottom: 0 }]}>
            <Text style={[styles.initiativeTitle, { color: theme.text }]}>🎊 Silicon Valley Pride Parade</Text>
            <Text style={[styles.bodyText, { color: theme.subText }]}>
              For the past five years, we have proudly marched to send a clear, unwavering message: Hockey Is For Everyone, and our support doesn't end at the rink doors.
            </Text>
          </View>
        </View>

        {/* Future of Our Mission & Volunteer Sign-Up CTA */}
        <View style={[styles.contentCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>The Future of Our Mission</Text>
          <Text style={[styles.bodyText, { color: theme.text }]}>
            Our work is just getting started. We are actively building partnerships and planning new ways to give back, including:
          </Text>
          <Text style={[styles.bodyText, { color: theme.subText, marginTop: 8 }]}>
            • Regular Creek Clean Ups to preserve San Jose & Santa Clara waterways.
          </Text>
          <Text style={[styles.bodyText, { color: theme.subText, marginTop: 4 }]}>
            • Community Blood Drives to help save lives.
          </Text>

          <Text style={[styles.sectionTitle, { color: theme.accentGold, marginTop: 16 }]}>Want to get involved?</Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 4, marginBottom: 14 }]}>
            If you have a cause you're passionate about or would like to volunteer, we'd love to hear from you. Together, we are more than fans; we are a force for good.
          </Text>

          <TouchableOpacity
            style={[styles.volunteerButton, { backgroundColor: theme.accentGold }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.volunteerButtonText}>🙋 Sign Up for Community Events</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Volunteer Intake Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            <Text style={[styles.modalHeaderTitle, { color: theme.accentGold }]}>🤝 COMMUNITY VOLUNTEER SIGN-UP</Text>
            <Text style={[styles.modalHeaderSub, { color: theme.subText }]}>
              Join the volunteer roster for upcoming creek clean-ups, drives, and community events!
            </Text>

            <Text style={[styles.inputLabel, { color: theme.subText }]}>Full Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="e.g. Alex Teal"
              placeholderTextColor="#80B3B8"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={[styles.inputLabel, { color: theme.subText }]}>Email Address *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="e.g. alex@example.com"
              placeholderTextColor="#80B3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={[styles.inputLabel, { color: theme.subText }]}>Phone Number (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="e.g. (408) 555-0199"
              placeholderTextColor="#80B3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={[styles.inputLabel, { color: theme.subText }]}>Causes / Volunteer Interests (Optional)</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              placeholder="e.g. Creek clean-ups, food drives, blood drives, event coordination..."
              placeholderTextColor="#80B3B8"
              multiline
              numberOfLines={3}
              value={causes}
              onChangeText={setCauses}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.borderColor }]}
                onPress={() => setModalVisible(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalCancelText, { color: theme.subText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.accentOrange }]}
                onPress={handleSubmitVolunteer}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit ➔</Text>
                )}
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
  scrollContent: { padding: 14, paddingBottom: 40 },
  bannerCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
  bannerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  bannerSub: { fontSize: 13, textAlign: 'center', fontWeight: '600', lineHeight: 18 },
  contentCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 8 },
  bodyText: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  donateButton: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  donateButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  volunteerButton: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  volunteerButtonText: { color: '#001417', fontSize: 15, fontWeight: '900' },
  initiativeBlock: { paddingLeft: 12, borderLeftWidth: 3, marginBottom: 16 },
  initiativeTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 18 },
  modalHeaderTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  modalHeaderSub: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 14, lineHeight: 16 },
  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: { padding: 10, borderRadius: 8, borderWidth: 1, fontSize: 13, marginBottom: 10 },
  textArea: { padding: 10, borderRadius: 8, borderWidth: 1, fontSize: 13, minHeight: 70, textAlignVertical: 'top', marginBottom: 14 },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '700' },
  modalSubmitBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});