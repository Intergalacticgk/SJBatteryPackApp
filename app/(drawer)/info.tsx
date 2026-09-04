import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

const SECTIONS = [
  '101', '102', '103', '104', '105', '106', '107', '108', '109', '110',
  '111', '112', '113', '114', '115', '116', '117',
  '201', '207', '209', '210', '211', '212', '213', '214', '215', '216', '217'
];

const ROWS = Array.from({ length: 13 }, (_, i) => String(i + 1));
const SEATS = Array.from({ length: 22 }, (_, i) => String(i + 1));

// Lightweight helper to decode JWT payload without external dependencies
function extractNonceFromJwt(token: string): string | undefined {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return undefined;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    for (let i = 0; i < base64.length; i += 4) {
      const b0 = chars.indexOf(base64.charAt(i));
      const b1 = chars.indexOf(base64.charAt(i + 1));
      const b2 = chars.indexOf(base64.charAt(i + 2));
      const b3 = chars.indexOf(base64.charAt(i + 3));
      const c0 = (b0 << 2) | (b1 >> 4);
      const c1 = ((b1 & 15) << 4) | (b2 >> 2);
      const c2 = ((b2 & 3) << 6) | b3;
      str += String.fromCharCode(c0);
      if (b2 !== 64 && b2 !== -1) str += String.fromCharCode(c1);
      if (b3 !== 64 && b3 !== -1) str += String.fromCharCode(c2);
    }
    const parsed = JSON.parse(str);
    return parsed?.nonce;
  } catch {
    return undefined;
  }
}

export default function AccountScreen() {
  const { theme } = useAppTheme();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Accordions
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [stmExpanded, setStmExpanded] = useState(false);
  const [gamesExpanded, setGamesExpanded] = useState(false);

  // Profile Form Fields
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [dob, setDob] = useState('');

  // STM Fields
  const [isSTM, setIsSTM] = useState(false);
  const [sectionNum, setSectionNum] = useState('');
  const [rowNum, setRowNum] = useState('');
  const [seatNum, setSeatNum] = useState('');

  // Dropdown Picker Modal State
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerData, setPickerData] = useState<string[]>([]);
  const [pickerSelected, setPickerSelected] = useState<string>('');
  const [pickerOnSelect, setPickerOnSelect] = useState<(val: string) => void>(() => () => {});

  const [highScore, setHighScore] = useState(0);

  // Phone SMS Auth States
  const [authPhone, setAuthPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');

  // Delete Account Modal States
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // 🌐 Configure Native Google Sign-In with both Android/Web and iOS Client IDs
    GoogleSignin.configure({
      scopes: ['email', 'profile'],
      webClientId: '766194485121-p51pktavs4t1rbcti5t5nnbs5taftunk.apps.googleusercontent.com',
      iosClientId: '766194485121-oagm77katqfkibgri9qjan93t4dqe9so.apps.googleusercontent.com',
      offlineAccess: true,
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (user: any) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data && !error) {
      setUsername(data.username || (data.email ? data.email.split('@')[0] : 'Supporter108'));
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setPhoneInput(data.phone || user.phone || '');
      setEmailInput(data.email || user.email || '');
      setDob(data.date_of_birth || '');
      setIsSTM(!!data.is_season_ticket_holder);
      setSectionNum(data.section_number || '');
      setRowNum(data.row_number || '');
      setSeatNum(data.seat_number || '');
      setHighScore(data.puck_drop_high_score || data.high_score || 0);
    } else {
      const defaultName = user.email ? user.email.split('@')[0] : 'Supporter108';
      setUsername(defaultName);
      setEmailInput(user.email || '');
      setPhoneInput(user.phone || '');
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!session?.user) return;

    setSaving(true);
    const generatedUsername = username.trim() || (emailInput ? emailInput.split('@')[0] : 'Supporter108');

    const updates = {
      id: session.user.id,
      username: generatedUsername,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phoneInput.trim(),
      email: emailInput.trim(),
      date_of_birth: dob.trim(),
      is_season_ticket_holder: isSTM,
      section_number: isSTM ? sectionNum : null,
      row_number: isSTM ? rowNum : null,
      seat_number: isSTM ? seatNum : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    setSaving(false);

    if (error) {
      Alert.alert('Error Saving Profile', error.message);
    } else {
      setUsername(generatedUsername);
      Alert.alert('Success! 🪸', 'Your Battery Pack profile and seat details have been updated.');
    }
  };

  const openPicker = (title: string, data: string[], selected: string, onSelect: (val: string) => void) => {
    setPickerTitle(title);
    setPickerData(data);
    setPickerSelected(selected);
    setPickerOnSelect(() => (val: string) => {
      onSelect(val);
      setPickerVisible(false);
    });
    setPickerVisible(true);
  };

  const handleSendCode = async () => {
    const cleaned = authPhone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    const formatted = cleaned.startsWith('1') && cleaned.length === 11 ? `+${cleaned}` : `+1${cleaned}`;

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    setLoading(false);

    if (error) {
      Alert.alert('Error Sending Code', error.message);
    } else {
      setStep('OTP');
      Alert.alert('Code Sent! 🪸', `Verification code sent to ${formatted}`);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code.');
      return;
    }
    const cleaned = authPhone.replace(/\D/g, '');
    const formatted = cleaned.startsWith('1') && cleaned.length === 11 ? `+${cleaned}` : `+1${cleaned}`;

    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp.trim(),
      type: 'sms',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Verification Failed', error.message);
    } else {
      setSession(data.session);
      setStep('PHONE');
      setAuthPhone('');
      setOtp('');
      Alert.alert('Welcome! 🪸', 'Signed in successfully.');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken || (response as any).idToken;

      if (!idToken) throw new Error('No ID token received from Google');

      // Extract internal nonce if Google embedded one in the JWT on iOS/iPadOS
      const extractedNonce = extractNonceFromJwt(idToken);

      const authPayload: { provider: 'google'; token: string; nonce?: string } = {
        provider: 'google',
        token: idToken,
      };

      if (extractedNonce) {
        authPayload.nonce = extractedNonce;
      }

      const { data, error } = await supabase.auth.signInWithIdToken(authPayload);

      if (error) throw error;
      setSession(data.session);
      Alert.alert('Welcome! 🪸', 'Signed in successfully with Google.');
    } catch (err: any) {
      if (err.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google Sign-In Error', err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      const rawNonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });

        if (error) throw error;

        if (data?.user) {
          const userGivenName = credential.fullName?.givenName;
          const userFamilyName = credential.fullName?.familyName;
          const userEmail = credential.email || data.user.email;
          const autoUser = userEmail ? userEmail.split('@')[0] : 'Supporter108';

          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: autoUser,
            first_name: userGivenName || firstName,
            last_name: userFamilyName || lastName,
            email: userEmail || emailInput,
            updated_at: new Date().toISOString(),
          });

          setUsername(autoUser);
          if (userGivenName) setFirstName(userGivenName);
          if (userFamilyName) setLastName(userFamilyName);
          if (userEmail) setEmailInput(userEmail);
        }

        setSession(data.session);
        Alert.alert('Welcome to the Battery Pack! 🪸', 'Signed in successfully with Apple.');
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign-In Error', err.message || 'Failed to sign in with Apple.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    try {
      await GoogleSignin.signOut();
    } catch {}
    setSession(null);
  };

  const handlePermanentAccountDelete = async () => {
    if (deleteInputText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Verification Failed', 'Please type DELETE in all caps to confirm.');
      return;
    }

    if (!session?.user) return;

    try {
      setDeleting(true);
      const userId = session.user.id;

      // 1. Wipe user records across tables
      await supabase.from('chat_messages').delete().eq('user_id', userId);
      await supabase.from('fan_gallery').delete().eq('user_id', userId);
      await supabase.from('gallery_likes').delete().eq('user_id', userId);
      await supabase.from('poll_votes').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);

      // 2. Clear Google & Supabase sessions
      await supabase.auth.signOut();
      try {
        await GoogleSignin.signOut();
      } catch {}

      setDeleteModalVisible(false);
      setDeleteInputText('');
      setSession(null);

      Alert.alert(
        'Account Deleted',
        'Your profile, scores, and associated supporter data have been permanently removed.'
      );
    } catch (err: any) {
      Alert.alert('Delete Error', err.message || 'Could not complete account deletion.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.cardBg} />

      <ScrollView contentContainerStyle={styles.contentPadding}>
        {session ? (
          <>
            <View style={[styles.header, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.headerTitle, { color: theme.accentGold }]}>MY LOCKER ROOM</Text>
              <Text style={[styles.headerSub, { color: theme.subText }]}>Section 108 Supporter Profile 🪸</Text>
            </View>

            {/* 1. Basic Information Accordion */}
            <TouchableOpacity
              style={[styles.accordionHeader, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              onPress={() => setProfileExpanded(!profileExpanded)}
              activeOpacity={0.8}
            >
              <Text style={[styles.accordionTitle, { color: theme.text }]}>👤 Basic Information</Text>
              <Text style={[styles.accordionIcon, { color: theme.accentGold }]}>{profileExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>

            {profileExpanded && (
              <View style={[styles.accordionContent, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.label, { color: theme.accentGold }]}>Chat Handle / Username</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.accentGold }]}
                  placeholder="e.g. TealFinatic108"
                  placeholderTextColor="#80B3B8"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />

                <View style={styles.nameRow}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={[styles.label, { color: theme.subText }]}>First Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
                      placeholder="e.g. John"
                      placeholderTextColor="#80B3B8"
                      value={firstName}
                      onChangeText={setFirstName}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={[styles.label, { color: theme.subText }]}>Last Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
                      placeholder="e.g. Doe"
                      placeholderTextColor="#80B3B8"
                      value={lastName}
                      onChangeText={setLastName}
                    />
                  </View>
                </View>

                <Text style={[styles.label, { color: theme.subText }]}>Email Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
                  placeholder="supporter@sjbatterypack.com"
                  placeholderTextColor="#80B3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={emailInput}
                  onChangeText={setEmailInput}
                />

                <Text style={[styles.label, { color: theme.subText }]}>Phone Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
                  placeholder="(408) 555-0108"
                  placeholderTextColor="#80B3B8"
                  keyboardType="phone-pad"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                />

                <Text style={[styles.label, { color: theme.subText }]}>Date of Birth (MM/DD/YYYY)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor="#80B3B8"
                  value={dob}
                  onChangeText={setDob}
                />
              </View>
            )}

            {/* 2. Season Ticket Holder (STM) Accordion */}
            <TouchableOpacity
              style={[styles.accordionHeader, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              onPress={() => setStmExpanded(!stmExpanded)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.accordionTitle, { color: theme.text }]}>🎟️ Season Ticket Holder (STM)</Text>
                {isSTM && <Text style={{ color: theme.accentGold, fontSize: 11, fontWeight: '900' }}>• ACTIVE</Text>}
              </View>
              <Text style={[styles.accordionIcon, { color: theme.accentGold }]}>{stmExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>

            {stmExpanded && (
              <View style={[styles.accordionContent, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Are you a Barracuda Season Ticket Holder?</Text>
                  <Switch
                    value={isSTM}
                    onValueChange={setIsSTM}
                    thumbColor={theme.accentGold}
                    trackColor={{ false: '#CCD6D8', true: '#00424A' }}
                  />
                </View>

                {isSTM && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={[styles.hintText, { color: theme.subText, marginBottom: 12, textAlign: 'left' }]}>
                      Select your Tech CU Arena seat details from the dropdowns below:
                    </Text>

                    <View style={styles.seatRow}>
                      {/* Section Dropdown */}
                      <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={[styles.label, { color: theme.subText }]}>Section</Text>
                        <TouchableOpacity
                          style={[styles.dropdownBtn, { backgroundColor: theme.subCardBg, borderColor: sectionNum ? theme.accentGold : theme.borderColor }]}
                          onPress={() => openPicker('Select Section', SECTIONS, sectionNum, setSectionNum)}
                        >
                          <Text style={[styles.dropdownBtnText, { color: sectionNum ? theme.text : '#80B3B8' }]}>
                            {sectionNum ? `Sec ${sectionNum}` : 'Select'}
                          </Text>
                          <Text style={{ color: theme.accentGold, fontSize: 10 }}>▼</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Row Dropdown */}
                      <View style={{ flex: 1, marginHorizontal: 4 }}>
                        <Text style={[styles.label, { color: theme.subText }]}>Row</Text>
                        <TouchableOpacity
                          style={[styles.dropdownBtn, { backgroundColor: theme.subCardBg, borderColor: rowNum ? theme.accentGold : theme.borderColor }]}
                          onPress={() => openPicker('Select Row', ROWS, rowNum, setRowNum)}
                        >
                          <Text style={[styles.dropdownBtnText, { color: rowNum ? theme.text : '#80B3B8' }]}>
                            {rowNum ? `Row ${rowNum}` : 'Select'}
                          </Text>
                          <Text style={{ color: theme.accentGold, fontSize: 10 }}>▼</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Seat Dropdown */}
                      <View style={{ flex: 1, marginLeft: 4 }}>
                        <Text style={[styles.label, { color: theme.subText }]}>Seat</Text>
                        <TouchableOpacity
                          style={[styles.dropdownBtn, { backgroundColor: theme.subCardBg, borderColor: seatNum ? theme.accentGold : theme.borderColor }]}
                          onPress={() => openPicker('Select Seat', SEATS, seatNum, setSeatNum)}
                        >
                          <Text style={[styles.dropdownBtnText, { color: seatNum ? theme.text : '#80B3B8' }]}>
                            {seatNum ? `Seat ${seatNum}` : 'Select'}
                          </Text>
                          <Text style={{ color: theme.accentGold, fontSize: 10 }}>▼</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 3. Arcade High Scores Accordion */}
            <TouchableOpacity
              style={[styles.accordionHeader, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              onPress={() => setGamesExpanded(!gamesExpanded)}
              activeOpacity={0.8}
            >
              <Text style={[styles.accordionTitle, { color: theme.text }]}>🕹️ Arcade High Scores</Text>
              <Text style={[styles.accordionIcon, { color: theme.accentGold }]}>{gamesExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>

            {gamesExpanded && (
              <View style={[styles.accordionContent, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={[styles.scoreRow, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.scoreLabel, { color: theme.text }]}>🏒 Puck Drop Personal Best:</Text>
                  <Text style={[styles.scoreValue, { color: theme.accentGold }]}>{highScore} pts</Text>
                </View>
                <Text style={[styles.hintText, { color: theme.subText }]}>Keep playing to climb the Pack Leaderboard!</Text>
              </View>
            )}

            {/* 4. Save Profile Updates Button */}
            <TouchableOpacity
              style={[styles.saveProfileBtn, { backgroundColor: theme.accentOrange }]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveProfileBtnText}>Save Profile Updates 🪸</Text>
              )}
            </TouchableOpacity>

            {/* 5. Account Security & Sign Out Actions */}
            <View style={styles.accountActionWrapper}>
              <TouchableOpacity
                style={styles.deleteAccountBtn}
                onPress={() => {
                  setDeleteInputText('');
                  setDeleteModalVisible(true);
                }}
              >
                <Text style={styles.deleteAccountText}>🗑️ Delete Account</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* ======================== 🔐 LOGGED OUT AUTH VIEW ======================== */
          <View style={[styles.authCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.authHeader, { color: theme.accentGold }]}>🦈 SECTION 108 ACCESS</Text>
            <Text style={[styles.authSub, { color: theme.subText }]}>
              Sign in with your mobile number, Google, or Apple account to claim win stamps and access your supporter profile.
            </Text>

            {step === 'PHONE' ? (
              <>
                <Text style={[styles.label, { color: theme.subText }]}>Mobile Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
                  placeholder="(408) 555-0108"
                  placeholderTextColor="#80B3B8"
                  keyboardType="phone-pad"
                  value={authPhone}
                  onChangeText={setAuthPhone}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.accentOrange }]}
                  onPress={handleSendCode}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Send SMS Code</Text>}
                </TouchableOpacity>

                <Text style={[styles.disclaimerText, { color: theme.subText }]}>
                  By tapping "Send SMS Code", you agree to receive a single 2FA verification SMS from SJ Battery Pack. Msg & data rates may apply. Reply STOP to cancel. Terms at sjbatterypack.com/terms.
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: theme.subText }]}>Enter 6-Digit Verification Code</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.accentGold }]}
                  placeholder="123456"
                  placeholderTextColor="#80B3B8"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.accentGold }]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#001E22" /> : <Text style={[styles.primaryBtnText, { color: '#001E22' }]}>Verify & Sign In</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setStep('PHONE')} style={{ marginTop: 14, alignItems: 'center' }}>
                  <Text style={{ color: theme.subText, fontSize: 12, fontWeight: '700' }}>Change Phone Number</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.borderColor }]} />
              <Text style={[styles.dividerText, { color: theme.subText }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.borderColor }]} />
            </View>

            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={theme.isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={10}
                style={styles.appleBtn}
                onPress={handleAppleSignIn}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* 📋 Dropdown Selection Modal */}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalContent, { backgroundColor: theme.cardBg, borderColor: theme.accentGold }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: theme.accentGold }]}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={[styles.pickerCloseBtn, { color: theme.subText }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={pickerData}
              keyExtractor={(item) => item}
              numColumns={3}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => {
                const isSelected = item === pickerSelected;
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerGridItem,
                      { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                      isSelected && { backgroundColor: theme.accentGold, borderColor: theme.accentGold }
                    ]}
                    onPress={() => pickerOnSelect(item)}
                  >
                    <Text style={[
                      styles.pickerGridItemText,
                      { color: theme.text },
                      isSelected && { color: '#001417', fontWeight: '900' }
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ⚠️ DELETE ACCOUNT CONFIRMATION MODAL */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: '#e74c3c' }]}>
            <Text style={styles.modalWarningIcon}>⚠️</Text>
            <Text style={[styles.modalTitle, { color: theme.accentGold }]}>DELETE ACCOUNT</Text>
            
            <Text style={[styles.modalWarningText, { color: theme.text }]}>
              This action is <Text style={{ fontWeight: '900', color: '#e74c3c' }}>permanent</Text>. All your supporter passport stamps, chat posts, arcade high scores, and profile data will be permanently deleted.
            </Text>

            <Text style={[styles.modalInstructionText, { color: theme.subText }]}>
              To confirm deletion, type <Text style={{ fontWeight: '900', color: theme.text }}>DELETE</Text> in the box below:
            </Text>

            <TextInput
              style={[styles.deleteInput, { backgroundColor: theme.subCardBg, color: theme.text, borderColor: theme.borderColor }]}
              value={deleteInputText}
              onChangeText={setDeleteInputText}
              placeholder="DELETE"
              placeholderTextColor="#80B3B8"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmDeleteBtn,
                  deleteInputText.trim().toUpperCase() === 'DELETE'
                    ? { backgroundColor: '#e74c3c' }
                    : { backgroundColor: 'rgba(231, 76, 60, 0.4)' },
                ]}
                onPress={handlePermanentAccountDelete}
                disabled={deleting || deleteInputText.trim().toUpperCase() !== 'DELETE'}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmDeleteText}>Confirm Delete</Text>
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
  contentPadding: { padding: 16, paddingBottom: 40 },
  header: { padding: 18, borderRadius: 14, marginBottom: 14, borderWidth: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  accordionHeader: { padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderWidth: 1 },
  accordionTitle: { fontSize: 15, fontWeight: '800' },
  accordionIcon: { fontSize: 12, fontWeight: '900' },
  accordionContent: { padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between' },
  seatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  dropdownBtnText: { fontSize: 13, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  switchLabel: { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 10 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  saveProfileBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 14, marginBottom: 10 },
  saveProfileBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1 },
  scoreLabel: { fontSize: 14, fontWeight: '700' },
  scoreValue: { fontSize: 18, fontWeight: '900' },
  hintText: { fontSize: 11, marginTop: 8, fontStyle: 'italic', textAlign: 'center' },
  accountActionWrapper: { gap: 10, marginTop: 8 },
  deleteAccountBtn: { padding: 14, backgroundColor: 'rgba(231, 76, 60, 0.12)', borderWidth: 1, borderColor: '#e74c3c', borderRadius: 10, alignItems: 'center' },
  deleteAccountText: { color: '#e74c3c', fontWeight: '900', fontSize: 14 },
  signOutButton: { padding: 14, backgroundColor: 'rgba(128, 179, 184, 0.12)', borderWidth: 1, borderColor: '#80B3B8', borderRadius: 10, alignItems: 'center' },
  signOutText: { color: '#80B3B8', fontWeight: '900', fontSize: 14 },
  authCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginTop: 10 },
  authHeader: { fontSize: 18, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  authSub: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 18, lineHeight: 18 },
  primaryBtn: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disclaimerText: { fontSize: 10, textAlign: 'center', marginTop: 10, lineHeight: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 10, fontSize: 11, fontWeight: '800' },
  googleBtn: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#D0DADC' },
  googleBtnText: { color: '#000000', fontSize: 14, fontWeight: '700' },
  appleBtn: { height: 48, marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerModalContent: { width: '100%', maxHeight: '65%', borderRadius: 16, borderWidth: 1, padding: 16 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2B4A4F', paddingBottom: 10 },
  pickerTitle: { fontSize: 16, fontWeight: '900' },
  pickerCloseBtn: { fontSize: 18, fontWeight: '900', paddingHorizontal: 6 },
  pickerGridItem: { flex: 1, margin: 4, paddingVertical: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pickerGridItemText: { fontSize: 13, fontWeight: '700' },
  modalCard: { width: '100%', borderRadius: 16, borderWidth: 1.5, padding: 20, alignItems: 'center' },
  modalWarningIcon: { fontSize: 36, marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  modalWarningText: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 12 },
  modalInstructionText: { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  deleteInput: { width: '100%', borderRadius: 10, borderWidth: 1, paddingVertical: 10, textAlign: 'center', fontSize: 16, fontWeight: '900', letterSpacing: 2, marginBottom: 16 },
  modalBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '800' },
  modalConfirmDeleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalConfirmDeleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});