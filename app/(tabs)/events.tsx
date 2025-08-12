// app/(tabs)/events.tsx
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

const events = [
  {
    id: '1',
    title: 'Pre-Season Watch Party',
    date: 'September 15, 2025',
    location: 'Downtown San Jose Sports Bar',
  },
  {
    id: '2',
    title: 'Home Game Group Photo',
    date: 'October 10, 2025',
    location: 'Tech CU Arena - Fireball Cove',
  },
  // Add more events here or load dynamically later
];

export default function EventsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Upcoming Events</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventDate}>{item.date}</Text>
            <Text style={styles.eventLocation}>{item.location}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#007f85',
    marginBottom: 15,
  },
  eventCard: {
    marginBottom: 15,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#e0f7f9', // light teal background
    shadowColor: '#007f85',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#004d51',
  },
  eventDate: {
    fontSize: 14,
    color: '#00666a',
    marginTop: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#00666a',
  },
});
