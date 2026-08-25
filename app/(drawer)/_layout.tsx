import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch, StatusBar } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from '../../context/ThemeContext';

function CustomDrawerContent(props: any) {
  const { theme, toggleTheme } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.cardBg }}>
      {/* Top Safe Area Container to prevent notch collision */}
      <View style={{ height: insets.top, backgroundColor: theme.cardBg }} />
      
      <DrawerContentScrollView 
        {...props} 
        contentContainerStyle={{ paddingTop: 8 }}
      >
        {/* Header Branding */}
        <View style={[styles.drawerHeader, { borderBottomColor: theme.borderColor }]}>
          <Text style={[styles.drawerHeaderTitle, { color: theme.accentGold }]}>🪸 SJ BATTERY PACK</Text>
          <Text style={[styles.drawerHeaderSub, { color: theme.subText }]}>Section 108 • Official Supporters</Text>
        </View>

        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* 🌗 Bottom Left Theme Toggle Bar */}
      <View style={[
        styles.bottomBar, 
        { 
          borderTopColor: theme.borderColor, 
          backgroundColor: theme.bg,
          paddingBottom: Math.max(insets.bottom, 12) 
        }
      ]}>
        <TouchableOpacity style={styles.themeToggleBtn} onPress={toggleTheme} activeOpacity={0.8}>
          <Text style={styles.themeIcon}>{theme.isDark ? '🌙' : '☀️'}</Text>
          <View>
            <Text style={[styles.themeTitle, { color: theme.text }]}>
              {theme.isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
            <Text style={[styles.themeSub, { color: theme.subText }]}>Tap to switch</Text>
          </View>
        </TouchableOpacity>
        <Switch
          value={theme.isDark}
          onValueChange={toggleTheme}
          thumbColor={theme.accentGold}
          trackColor={{ false: '#CCD6D8', true: '#00424A' }}
        />
      </View>
    </View>
  );
}

function DrawerNavigation() {
  const { theme } = useAppTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar 
        barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.cardBg} 
      />
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: theme.cardBg },
          headerTintColor: theme.accentGold,
          headerTitleStyle: { fontWeight: '900', fontSize: 18, color: theme.accentGold },
          drawerStyle: { backgroundColor: theme.cardBg, width: 285 },
          drawerActiveTintColor: theme.accentGold,
          drawerActiveBackgroundColor: theme.isDark ? 'rgba(0, 66, 74, 0.7)' : 'rgba(255, 184, 0, 0.18)',
          drawerInactiveTintColor: theme.subText,
          drawerLabelStyle: { fontWeight: '800', fontSize: 15, marginLeft: -8 },
          drawerItemStyle: { borderRadius: 10, marginVertical: 3, paddingHorizontal: 6 },
        }}
      >
        {/* 1. 🏠 Home */}
        <Drawer.Screen name="index" options={{ drawerLabel: 'Home', title: 'Home' }} />

        {/* 2. 🛂 Digital Passport */}
        <Drawer.Screen name="passport" options={{ drawerLabel: 'Digital Passport', title: 'Digital Passport' }} />

        {/* 3. 📅 Schedule */}
        <Drawer.Screen name="schedule" options={{ drawerLabel: 'Schedule', title: 'Barracuda Schedule' }} />

        {/* 4. 🏒 Current Roster */}
        <Drawer.Screen name="roster" options={{ drawerLabel: 'Current Roster', title: 'Barracuda Roster' }} />

        {/* 5. 🌟 Prospects Tracker */}
        <Drawer.Screen name="prospects" options={{ drawerLabel: 'Prospects', title: 'Sharks System Prospects' }} />

        {/* 6. 🗣️ Chants */}
        <Drawer.Screen name="fanzone" options={{ drawerLabel: 'Chants', title: 'Section 108 Chants' }} />

        {/* 7. 📅 Events & Meetups */}
        <Drawer.Screen name="events" options={{ drawerLabel: 'Events', title: 'Supporter Events' }} />

        {/* 8. 💬 Chat */}
        <Drawer.Screen name="chat" options={{ drawerLabel: 'Chat', title: 'Supporter Chat' }} />

        {/* 8. 📸 Fan Gallery */}
        <Drawer.Screen name="gallery" options={{ drawerLabel: 'Fan Gallery', title: 'Reef Fan Gallery' }} />

        {/* 9. 🗳️ Polls */}
        <Drawer.Screen name="polls" options={{ drawerLabel: 'Polls', title: 'Supporter Polls' }} />

        {/* 10. 👤 Account */}
        <Drawer.Screen name="info" options={{ drawerLabel: 'Account', title: 'My Account & Auth' }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}

export default function RootDrawerLayout() {
  return (
    <ThemeProvider>
      <DrawerNavigation />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  drawerHeader: { paddingHorizontal: 16, paddingBottom: 12, marginBottom: 8, borderBottomWidth: 1 },
  drawerHeaderTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.8 },
  drawerHeaderSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  themeToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeIcon: { fontSize: 20 },
  themeTitle: { fontSize: 13, fontWeight: '800' },
  themeSub: { fontSize: 10, fontWeight: '600' },
});