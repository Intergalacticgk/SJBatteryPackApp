// app/(tabs)/chants.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ChantsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chants Page - Coming Soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#007f85' },
});
