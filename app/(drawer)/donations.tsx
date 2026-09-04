import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme } from '../../context/ThemeContext';

// REPLACE THIS with your actual Stripe Payment Link
const STRIPE_DONATION_LINK = 'https://buy.stripe.com/fZu3cxaYYbCw1lE0SvfrW00';

export default function DonationsScreen() {
  const { theme } = useAppTheme();

  const handleDonate = async () => {
    await WebBrowser.openBrowserAsync(STRIPE_DONATION_LINK);
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

        {/* Future of Our Mission */}
        <View style={[styles.contentCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>The Future of Our Mission</Text>
          <Text style={[styles.bodyText, { color: theme.text }]}>
            Our work is just getting started. We are actively building partnerships and planning new ways to give back, including:
          </Text>
          <Text style={[styles.bodyText, { color: theme.subText, marginTop: 8 }]}>• Regular Creek Clean Ups to preserve San Jose & Santa Clara waterways.</Text>
          <Text style={[styles.bodyText, { color: theme.subText, marginTop: 4 }]}>• Community Blood Drives to help save lives.</Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 12, fontWeight: '700' }]}>
            Want to get involved?
          </Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 4 }]}>
            If you have a cause you're passionate about or would like to volunteer, we’d love to hear from you. Together, we are more than fans; we are a force for good.
          </Text>
        </View>

      </ScrollView>
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
  initiativeBlock: { paddingLeft: 12, borderLeftWidth: 3, marginBottom: 16 },
  initiativeTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 }
});