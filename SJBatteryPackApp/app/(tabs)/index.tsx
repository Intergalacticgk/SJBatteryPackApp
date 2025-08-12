// app/(tabs)/index.tsx
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Welcome to SJ Battery Pack</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',  // optional, white background
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF', // nice blue color, you can change it
  },
});
