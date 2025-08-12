// app/(tabs)/_layout.tsx
import { Montserrat_400Regular, Montserrat_700Bold, useFonts } from '@expo-google-fonts/montserrat';
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabsLayout() {
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_700Bold,
  });

  if (!fontsLoaded) {
    return <Text>Loading...</Text>;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007f85',  // Teal active tab color
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontFamily: 'Montserrat_700Bold',
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#007f85',
          borderTopWidth: 2,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="chants" options={{ title: 'Chants' }} />
      <Tabs.Screen name="membership" options={{ title: 'Membership' }} />
      <Tabs.Screen name="store" options={{ title: 'Store' }} />
      <Tabs.Screen name="donate" options={{ title: 'Donate' }} />
      <Tabs.Screen name="about" options={{ title: 'About Us' }} />
    </Tabs>
  );
}
