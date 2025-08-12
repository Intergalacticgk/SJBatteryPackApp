// app/(tabs)/index.tsx (Home)
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to the SJ Battery Pack</Text>
      <Text style={styles.subtitle}>
        The official supporters club of the San Jose Barracuda!
      </Text>
      <Text style={styles.bodyText}>
        Join us as we cheer on the Barracuda every game and build our hockey community.
      </Text>

      {/* Add more sections or images here from your website */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007f85', // Your teal color
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#005f66',
    marginBottom: 15,
  },
  bodyText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
});
